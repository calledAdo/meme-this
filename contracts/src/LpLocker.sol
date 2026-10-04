// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {INonfungiblePositionManager} from "./interfaces/IUniswapV3.sol";

/// @title LpLocker
/// @notice Holds every Meme This liquidity position forever and splits its trading fees.
///         There is deliberately no function that removes liquidity or transfers a position out.
///         Fees are credited, then pulled by each recipient (a blocklisted recipient cannot block others).
contract LpLocker is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant PITCHER_BPS = 5_000;
    uint256 public constant HOST_BPS = 2_000;
    // The protocol treasury receives the remainder (30%), including rounding dust.

    struct Position {
        address pitcher;
        address host;
        address token0;
        address token1;
    }

    INonfungiblePositionManager public immutable positionManager;
    address public arena;
    address public treasury;

    mapping(uint256 tokenId => Position) public positions;
    mapping(address token => mapping(address account => uint256)) public credits;

    event ArenaSet(address arena);
    event TreasurySet(address treasury);
    event Registered(uint256 indexed tokenId, address pitcher, address host);
    event FeesCollected(uint256 indexed tokenId, uint256 amount0, uint256 amount1);
    event Withdrawn(address indexed token, address indexed account, uint256 amount);

    error OnlyArena();
    error ArenaAlreadySet();
    error UnknownPosition();
    error NotHeld();
    error ZeroAddress();

    constructor(INonfungiblePositionManager positionManager_, address treasury_, address owner_) Ownable(owner_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        positionManager = positionManager_;
        treasury = treasury_;
    }

    /// @notice One-time wiring to the arena that mints positions into this locker.
    function setArena(address arena_) external onlyOwner {
        if (arena != address(0)) revert ArenaAlreadySet();
        if (arena_ == address(0)) revert ZeroAddress();
        arena = arena_;
        emit ArenaSet(arena_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function register(uint256 tokenId, address pitcher, address host) external {
        if (msg.sender != arena) revert OnlyArena();
        if (positionManager.ownerOf(tokenId) != address(this)) revert NotHeld();
        (,, address token0, address token1,,,,,,,,) = positionManager.positions(tokenId);
        positions[tokenId] = Position(pitcher, host, token0, token1);
        emit Registered(tokenId, pitcher, host);
    }

    /// @notice Pull accrued pool fees for a position and credit the 50/20/30 split. Callable by anyone.
    function collect(uint256 tokenId) public nonReentrant returns (uint256 amount0, uint256 amount1) {
        Position memory p = positions[tokenId];
        if (p.pitcher == address(0)) revert UnknownPosition();
        (amount0, amount1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams(tokenId, address(this), type(uint128).max, type(uint128).max)
        );
        _split(p, p.token0, amount0);
        _split(p, p.token1, amount1);
        emit FeesCollected(tokenId, amount0, amount1);
    }

    /// @notice Withdraw everything credited to the caller in `token`.
    function withdraw(address token) external nonReentrant returns (uint256 amount) {
        amount = credits[token][msg.sender];
        if (amount == 0) return 0;
        credits[token][msg.sender] = 0;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(token, msg.sender, amount);
    }

    function _split(Position memory p, address token, uint256 amount) private {
        if (amount == 0) return;
        uint256 toPitcher = amount * PITCHER_BPS / 10_000;
        uint256 toHost = amount * HOST_BPS / 10_000;
        credits[token][p.pitcher] += toPitcher;
        credits[token][p.host] += toHost;
        credits[token][treasury] += amount - toPitcher - toHost;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
