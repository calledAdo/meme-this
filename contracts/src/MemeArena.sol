// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import {MemeToken} from "./MemeToken.sol";
import {LpLocker} from "./LpLocker.sol";
import {INonfungiblePositionManager, ISwapRouter02, IUniswapV3Pool} from "./interfaces/IUniswapV3.sol";

/// @title MemeArena
/// @notice The Meme This game, without rounds. Anyone pitches a coin (name, ticker, image) for free; players back
///         pitches with USDC. The back that takes a pitch to its target launches the coin in that same transaction:
///         token, locked Uniswap v3 pool, and every backer's USDC as the first buy. Nobody has to press "close".
///         A pitch that is not ripe before it expires is refunded in full.
///         Pitches may answer a prompt (a news event or theme): the first pitch in a prompt to ripen wins it, and
///         every other pitch in that prompt becomes refundable at once, so each event gets exactly one coin.
/// @dev Arc notes: USDC is used only through its 6-decimal ERC-20 interface; no randomness (PREVRANDAO is 0);
///      payouts are pulled by their recipient so a blocklisted address cannot freeze anything.
contract MemeArena is Ownable2Step, ReentrancyGuard, Pausable, EIP712 {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------- constants

    uint24 public constant POOL_FEE = 10_000; // 1% tier, tick spacing 200
    int24 public constant MIN_TICK = -887_200; // full-range bounds aligned to spacing 200
    int24 public constant MAX_TICK = 887_200;
    uint256 public constant WEIGHT_ONE = 1_000_000; // 1.0x
    uint256 public constant WEIGHT_BONUS = 250_000; // +0.25x for a dollar added the second a pitch appears
    uint32 public constant MIN_LIFETIME = 10 minutes;
    uint32 public constant MAX_LIFETIME = 7 days;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;

    bytes32 public constant PASS_TYPEHASH = keccak256("Pass(address wallet,uint256 identityId,uint256 deadline)");

    // ---------------------------------------------------------------- types

    /// @dev Derived, never stored: see `statusOf`.
    enum Status {
        None,
        Live, // collecting backing
        Launched, // ripened: the coin exists
        Expired, // not ripe before its deadline: refundable
        Vetoed, // removed by the guardian: refundable
        Lost // its prompt was won by another pitch, or cancelled: refundable
    }

    struct Config {
        uint96 target; // USDC (6 decimals) that makes a pitch ripe
        uint96 minBack; // smallest backing a wallet may hold (the final top-up to target is exempt)
        uint96 maxPerPerson; // cap on one wallet's backing of one pitch
        uint96 pitchFee; // paid to the treasury; zero means free pitching
        uint32 lifetime; // seconds a pitch has to ripen
    }

    /// @notice Launch geometry. Variant A: coin is token0, liquidity [tickA, MAX_TICK], pool starts at sqrtA
    ///         (just below tickA). Variant B: coin is token1, liquidity [MIN_TICK, tickB], pool starts at sqrtB
    ///         (just above tickB). Either way the position holds only the coin and the pool needs no seed USDC.
    struct LaunchParams {
        int24 tickA;
        uint160 sqrtA;
        int24 tickB;
        uint160 sqrtB;
    }

    struct Prompt {
        address host;
        uint64 created;
        uint64 end; // no new pitches after this
        bool cancelled;
        uint256 winner; // pitch id, 0 while unwon
        string uri; // title, kind, source links
    }

    struct Pitch {
        uint256 promptId; // 0 = freestyle
        address pitcher;
        uint64 created;
        uint64 expires;
        bool vetoed;
        uint16 verifiedBackers;
        uint16 backers;
        uint96 target;
        uint96 maxPerPerson;
        uint256 total; // USDC backing
        uint256 weighted; // conviction-weighted USDC
        string name;
        string symbol;
        string uri; // image + lore
        address token;
        uint256 tokensBought;
        uint256 lpTokenId;
    }

    struct Backing {
        uint256 amount;
        uint256 weighted;
        bool verified;
        bool claimed;
    }

    // ---------------------------------------------------------------- storage

    IERC20 public immutable usdc;
    INonfungiblePositionManager public immutable positionManager;
    ISwapRouter02 public immutable router;
    LpLocker public immutable locker;

    address public guardian;
    address public attester; // Meme This pass signer (Coinbase Verifications / Human Passport); zero disables
    address public treasury;
    Config public config;
    LaunchParams public launchParams;

    mapping(address => bool) public isHost;
    bool public openPrompts; // anyone may open a prompt (they become its host)

    uint256 public promptCount;
    uint256 public pitchCount;
    uint256 public launchCount;
    mapping(uint256 promptId => Prompt) internal _prompts;
    mapping(uint256 pitchId => Pitch) internal _pitches;
    mapping(uint256 promptId => uint256[]) internal _promptPitches;
    mapping(uint256 pitchId => mapping(address wallet => Backing)) public backings;
    mapping(uint256 pitchId => mapping(uint256 identityId => address wallet)) public walletOfIdentity;

    /// @notice Pitch currently holding a ticker / name. A launched pitch holds it forever; a dead one frees it.
    mapping(bytes32 => uint256) public symbolHolder;
    mapping(bytes32 => uint256) public nameHolder;

    mapping(address => uint256) public credits; // USDC owed to the treasury (pitch fees)

    // ---------------------------------------------------------------- events

    event PromptCreated(uint256 indexed promptId, address indexed host, uint64 end, string uri);
    event PromptCancelled(uint256 indexed promptId, string reason);
    event Pitched(
        uint256 indexed pitchId,
        uint256 indexed promptId,
        address indexed pitcher,
        string name,
        string symbol,
        string uri,
        uint96 target,
        uint64 expires
    );
    event Backed(uint256 indexed pitchId, address indexed wallet, uint256 amount, uint256 weighted, bool verified, uint256 total);
    event Withdrawn(uint256 indexed pitchId, address indexed wallet, uint256 amount, uint256 total);
    event Vetoed(uint256 indexed pitchId, string reason);
    event Launched(
        uint256 indexed pitchId,
        uint256 indexed promptId,
        address token,
        address pool,
        uint256 lpTokenId,
        uint256 raised,
        uint256 tokensBought
    );
    event Claimed(uint256 indexed pitchId, address indexed wallet, uint256 tokens, uint256 refund);
    event CreditWithdrawn(address indexed account, uint256 amount);
    event ConfigUpdated();

    // ---------------------------------------------------------------- errors

    error NotHost();
    error NotGuardian();
    error BadTiming();
    error BadState();
    error BadAmount();
    error CapExceeded();
    error InvalidSymbol();
    error InvalidName();
    error Taken();
    error NothingToClaim();
    error BadPass();
    error IdentityUsedByOtherWallet();
    error PoolPreInitialized();
    error ZeroAddress();

    // ---------------------------------------------------------------- setup

    constructor(
        IERC20 usdc_,
        INonfungiblePositionManager positionManager_,
        ISwapRouter02 router_,
        LpLocker locker_,
        address owner_,
        address treasury_,
        LaunchParams memory params_
    ) Ownable(owner_) EIP712("MemeThis", "2") {
        if (treasury_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
        positionManager = positionManager_;
        router = router_;
        locker = locker_;
        treasury = treasury_;
        guardian = owner_;
        config = Config({target: 5e6, minBack: 1e6, maxPerPerson: 20e6, pitchFee: 0, lifetime: 1 days});
        launchParams = params_;
    }

    // ---------------------------------------------------------------- admin

    function setHost(address host, bool allowed) external onlyOwner {
        isHost[host] = allowed;
        emit ConfigUpdated();
    }

    function setOpenPrompts(bool open) external onlyOwner {
        openPrompts = open;
        emit ConfigUpdated();
    }

    function setGuardian(address guardian_) external onlyOwner {
        guardian = guardian_;
        emit ConfigUpdated();
    }

    function setAttester(address attester_) external onlyOwner {
        attester = attester_;
        emit ConfigUpdated();
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit ConfigUpdated();
    }

    /// @notice Applies to pitches created after this call; live pitches keep their target, cap and deadline.
    function setConfig(Config calldata c) external onlyOwner {
        if (c.minBack == 0 || c.target < c.minBack || c.maxPerPerson < c.minBack) revert BadAmount();
        if (c.lifetime < MIN_LIFETIME || c.lifetime > MAX_LIFETIME) revert BadTiming();
        config = c;
        emit ConfigUpdated();
    }

    function setLaunchParams(LaunchParams calldata params_) external onlyOwner {
        launchParams = params_;
        emit ConfigUpdated();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------- guardian

    /// @notice Remove a pitch (impersonation, tragedy, hate). Its backers can claim a refund immediately.
    function veto(uint256 pitchId, string calldata reason) external {
        if (msg.sender != guardian) revert NotGuardian();
        if (statusOf(pitchId) != Status.Live) revert BadState();
        _pitches[pitchId].vetoed = true;
        emit Vetoed(pitchId, reason);
    }

    /// @notice Cancel an unwon prompt (false story, emergency). Every pitch in it becomes refundable.
    function cancelPrompt(uint256 promptId, string calldata reason) external {
        if (msg.sender != guardian) revert NotGuardian();
        Prompt storage pr = _prompts[promptId];
        if (pr.host == address(0) || pr.cancelled || pr.winner != 0) revert BadState();
        pr.cancelled = true;
        emit PromptCancelled(promptId, reason);
    }

    // ---------------------------------------------------------------- hosts

    /// @notice Open a prompt for `duration` seconds of pitching. The first pitch in it to ripen wins it.
    function createPrompt(uint32 duration, string calldata uri) external whenNotPaused returns (uint256 id) {
        if (!isHost[msg.sender] && !openPrompts) revert NotHost();
        if (duration < MIN_LIFETIME || duration > MAX_LIFETIME) revert BadTiming();
        id = ++promptCount;
        Prompt storage pr = _prompts[id];
        pr.host = msg.sender;
        pr.created = uint64(block.timestamp);
        pr.end = uint64(block.timestamp) + duration;
        pr.uri = uri;
        emit PromptCreated(id, msg.sender, pr.end, uri);
    }

    // ---------------------------------------------------------------- players

    /// @notice Pitch a coin. `promptId` 0 is freestyle. Tickers and names are unique among live and launched pitches.
    function pitch(uint256 promptId, string calldata name, string calldata symbol, string calldata uri)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 id)
    {
        if (promptId != 0) {
            Prompt storage pr = _prompts[promptId];
            if (pr.host == address(0) || pr.cancelled || pr.winner != 0) revert BadState();
            if (block.timestamp >= pr.end) revert BadTiming();
        }
        _checkSymbol(symbol);
        if (bytes(name).length == 0 || bytes(name).length > 32) revert InvalidName();
        bytes32 sKey = keccak256(bytes(symbol));
        bytes32 nKey = _nameKey(name);
        if (_holds(symbolHolder[sKey]) || _holds(nameHolder[nKey])) revert Taken();

        Config memory c = config;
        id = ++pitchCount;
        Pitch storage p = _pitches[id];
        p.promptId = promptId;
        p.pitcher = msg.sender;
        p.created = uint64(block.timestamp);
        p.expires = uint64(block.timestamp) + c.lifetime;
        p.target = c.target;
        p.maxPerPerson = c.maxPerPerson;
        p.name = name;
        p.symbol = symbol;
        p.uri = uri;
        symbolHolder[sKey] = id;
        nameHolder[nKey] = id;
        if (promptId != 0) _promptPitches[promptId].push(id);

        if (c.pitchFee > 0) {
            credits[treasury] += c.pitchFee;
            usdc.safeTransferFrom(msg.sender, address(this), c.pitchFee);
        }
        emit Pitched(id, promptId, msg.sender, name, symbol, uri, c.target, p.expires);
    }

    /// @notice Back a live pitch. Anything beyond what the pitch needs to ripen is not taken.
    ///         When this backing makes the pitch ripe, the coin launches in this transaction.
    ///         Pass `identityId = 0` to back unverified.
    function back(uint256 pitchId, uint256 amount, uint256 identityId, uint256 deadline, bytes calldata sig)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 taken)
    {
        if (statusOf(pitchId) != Status.Live) revert BadState();
        Pitch storage p = _pitches[pitchId];
        Backing storage b = backings[pitchId][msg.sender];

        uint256 remaining = p.target - p.total;
        taken = amount < remaining ? amount : remaining;
        bool ripens = taken == remaining;
        if (taken == 0 || (b.amount + taken < config.minBack && !ripens)) revert BadAmount();
        if (b.amount + taken > p.maxPerPerson) revert CapExceeded();

        if (b.amount == 0) p.backers++;
        if (identityId != 0 && !b.verified) {
            _verifyPass(pitchId, identityId, deadline, sig);
            b.verified = true;
            p.verifiedBackers++;
        }

        uint256 w = taken * weightAt(pitchId, block.timestamp) / WEIGHT_ONE;
        b.amount += taken;
        b.weighted += w;
        p.total += taken;
        p.weighted += w;

        usdc.safeTransferFrom(msg.sender, address(this), taken);
        emit Backed(pitchId, msg.sender, taken, w, b.verified, p.total);

        if (ripens) _launch(pitchId, p);
    }

    /// @notice Take your backing out of a pitch that is still live. Dead pitches use `claim`.
    function withdraw(uint256 pitchId) external nonReentrant returns (uint256 amount) {
        if (statusOf(pitchId) != Status.Live) revert BadState();
        Pitch storage p = _pitches[pitchId];
        Backing storage b = backings[pitchId][msg.sender];
        amount = b.amount;
        if (amount == 0) revert BadAmount();

        p.total -= amount;
        p.weighted -= b.weighted;
        p.backers--;
        if (b.verified) p.verifiedBackers--;
        b.amount = 0;
        b.weighted = 0;
        b.verified = false; // the identity stays bound to this wallet for this pitch
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(pitchId, msg.sender, amount, p.total);
    }

    /// @notice Claim your share of a launched coin, or your full USDC refund from an expired, vetoed or lost pitch.
    function claim(uint256 pitchId) external nonReentrant returns (uint256 tokens, uint256 refund) {
        Status s = statusOf(pitchId);
        if (s == Status.Live || s == Status.None) revert BadState();
        Backing storage b = backings[pitchId][msg.sender];
        if (b.amount == 0 || b.claimed) revert NothingToClaim();
        b.claimed = true;

        if (s == Status.Launched) {
            Pitch storage p = _pitches[pitchId];
            tokens = p.tokensBought * b.weighted / p.weighted;
            IERC20(p.token).safeTransfer(msg.sender, tokens);
        } else {
            refund = b.amount;
            usdc.safeTransfer(msg.sender, refund);
        }
        emit Claimed(pitchId, msg.sender, tokens, refund);
    }

    /// @notice Withdraw USDC credited to you (pitch fees, for the treasury).
    function withdrawCredit() external nonReentrant returns (uint256 amount) {
        amount = credits[msg.sender];
        if (amount == 0) revert NothingToClaim();
        credits[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit CreditWithdrawn(msg.sender, amount);
    }

    // ---------------------------------------------------------------- views

    function statusOf(uint256 pitchId) public view returns (Status) {
        Pitch storage p = _pitches[pitchId];
        if (p.pitcher == address(0)) return Status.None;
        if (p.token != address(0)) return Status.Launched;
        if (p.vetoed) return Status.Vetoed;
        if (p.promptId != 0) {
            Prompt storage pr = _prompts[p.promptId];
            if (pr.cancelled || pr.winner != 0) return Status.Lost;
        }
        if (block.timestamp >= p.expires) return Status.Expired;
        return Status.Live;
    }

    /// @notice Conviction weight (1e6 = 1.0x) for a dollar added at time `t`: 1.25x at the pitch's birth,
    ///         falling linearly to 1.0x at its deadline.
    function weightAt(uint256 pitchId, uint256 t) public view returns (uint256) {
        Pitch storage p = _pitches[pitchId];
        if (t >= p.expires) return WEIGHT_ONE;
        if (t < p.created) t = p.created;
        return WEIGHT_ONE + WEIGHT_BONUS * (p.expires - t) / (p.expires - p.created);
    }

    function getPitch(uint256 pitchId) external view returns (Pitch memory) {
        return _pitches[pitchId];
    }

    function getPrompt(uint256 promptId) external view returns (Prompt memory) {
        return _prompts[promptId];
    }

    function getPromptPitches(uint256 promptId) external view returns (uint256[] memory) {
        return _promptPitches[promptId];
    }

    function passDigest(address wallet, uint256 identityId, uint256 deadline) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(PASS_TYPEHASH, wallet, identityId, deadline)));
    }

    // ---------------------------------------------------------------- internals

    function _launch(uint256 pitchId, Pitch storage p) private {
        LaunchParams memory lp = launchParams;
        address host = treasury;
        if (p.promptId != 0) {
            Prompt storage pr = _prompts[p.promptId];
            pr.winner = pitchId; // every rival pitch in this prompt is now Lost
            host = pr.host;
        }

        MemeToken token = new MemeToken{salt: keccak256(abi.encode(pitchId, block.number))}(
            p.name, p.symbol, p.uri, pitchId, address(this)
        );
        uint256 supply = token.SUPPLY();
        bool coinIsToken0 = address(token) < address(usdc);

        INonfungiblePositionManager.MintParams memory mp;
        uint160 sqrtPrice;
        if (coinIsToken0) {
            (mp.token0, mp.token1, mp.tickLower, mp.tickUpper, mp.amount0Desired) =
                (address(token), address(usdc), lp.tickA, MAX_TICK, supply);
            sqrtPrice = lp.sqrtA;
        } else {
            (mp.token0, mp.token1, mp.tickLower, mp.tickUpper, mp.amount1Desired) =
                (address(usdc), address(token), MIN_TICK, lp.tickB, supply);
            sqrtPrice = lp.sqrtB;
        }
        mp.fee = POOL_FEE;
        mp.recipient = address(locker);
        mp.deadline = block.timestamp;

        address pool = positionManager.createAndInitializePoolIfNecessary(mp.token0, mp.token1, POOL_FEE, sqrtPrice);
        // Someone could pre-create the pool at a hostile price once the coin address is known. Refuse to launch
        // into it; the ripening back reverts and succeeds in a later block (a new block gives a new coin address).
        (uint160 current,,,,,,) = IUniswapV3Pool(pool).slot0();
        if (current != sqrtPrice) revert PoolPreInitialized();

        IERC20(address(token)).forceApprove(address(positionManager), supply);
        (uint256 lpTokenId,, uint256 used0, uint256 used1) = positionManager.mint(mp);
        uint256 leftover = supply - (coinIsToken0 ? used0 : used1);
        if (leftover > 0) IERC20(address(token)).safeTransfer(DEAD, leftover);
        locker.register(lpTokenId, p.pitcher, host);

        // Backers' escrow is the pool's very first trade, in the same transaction that created it.
        uint256 raised = p.total;
        usdc.forceApprove(address(router), raised);
        uint256 bought = router.exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: address(usdc),
                tokenOut: address(token),
                fee: POOL_FEE,
                recipient: address(this),
                amountIn: raised,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );

        p.token = address(token);
        p.tokensBought = bought;
        p.lpTokenId = lpTokenId;
        launchCount++;
        emit Launched(pitchId, p.promptId, address(token), pool, lpTokenId, raised, bought);
    }

    /// @dev A holder blocks a ticker / name while it is live or launched.
    function _holds(uint256 pitchId) private view returns (bool) {
        if (pitchId == 0) return false;
        Status s = statusOf(pitchId);
        return s == Status.Live || s == Status.Launched;
    }

    function _verifyPass(uint256 pitchId, uint256 identityId, uint256 deadline, bytes calldata sig) private {
        if (attester == address(0) || deadline < block.timestamp) revert BadPass();
        if (ECDSA.recover(passDigest(msg.sender, identityId, deadline), sig) != attester) revert BadPass();
        address bound = walletOfIdentity[pitchId][identityId];
        if (bound == address(0)) walletOfIdentity[pitchId][identityId] = msg.sender;
        else if (bound != msg.sender) revert IdentityUsedByOtherWallet();
    }

    function _checkSymbol(string calldata symbol) private pure {
        bytes calldata s = bytes(symbol);
        if (s.length == 0 || s.length > 10) revert InvalidSymbol();
        for (uint256 i; i < s.length; ++i) {
            bytes1 c = s[i];
            if (!((c >= 0x41 && c <= 0x5A) || (c >= 0x30 && c <= 0x39))) revert InvalidSymbol();
        }
    }

    function _nameKey(string memory name) private pure returns (bytes32) {
        bytes memory s = bytes(name);
        for (uint256 i; i < s.length; ++i) {
            if (s[i] >= 0x41 && s[i] <= 0x5A) s[i] = bytes1(uint8(s[i]) + 32);
        }
        return keccak256(s);
    }
}
