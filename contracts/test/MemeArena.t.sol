// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MemeArena} from "../src/MemeArena.sol";
import {LpLocker} from "../src/LpLocker.sol";
import {MemeToken} from "../src/MemeToken.sol";
import {INonfungiblePositionManager, ISwapRouter02} from "../src/interfaces/IUniswapV3.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

interface IV3Factory {
    function getPool(address, address, uint24) external view returns (address);
}

/// Runs against a fork of Arc mainnet so launches go through the real Uniswap v3 deployment.
/// USDC is a mock placed at a chosen address so both pool orderings (coin as token0 / token1) are exercised.
contract MemeArenaTest is Test {
    INonfungiblePositionManager constant NPM = INonfungiblePositionManager(0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377);
    ISwapRouter02 constant ROUTER = ISwapRouter02(0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77);
    IV3Factory constant FACTORY = IV3Factory(0xf0db7b58379503491d857dB50AC9ece64c653918);

    MockUSDC usdc;
    LpLocker locker;
    MemeArena arena;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address host = makeAddr("host");
    address pitcherA = makeAddr("pitcherA");
    address pitcherB = makeAddr("pitcherB");
    uint256 attesterKey = 0xA77E57;
    address attester;

    function params() internal pure returns (MemeArena.LaunchParams memory) {
        return MemeArena.LaunchParams({
            tickA: -398_200,
            sqrtA: 178849218479976202948,
            tickB: 398_200,
            sqrtB: 35097171733459150718731692347568318357
        });
    }

    function setUp() public {
        vm.createSelectFork("arc");
        _deploy(address(0x00000000000000000000000000000000000000AA)); // low USDC => coin is token1 (variant B)
    }

    function _deploy(address usdcAt) internal {
        deployCodeTo("MemeArena.t.sol:MockUSDC", usdcAt);
        usdc = MockUSDC(usdcAt);
        attester = vm.addr(attesterKey);
        locker = new LpLocker(NPM, treasury, owner);
        arena = new MemeArena(IERC20(address(usdc)), NPM, ROUTER, locker, owner, treasury, params());
        vm.startPrank(owner);
        locker.setArena(address(arena));
        arena.setHost(host, true);
        arena.setAttester(attester);
        // Production-like target so multi-backer tests have room: $100, $20 per person, 24h.
        arena.setConfig(MemeArena.Config({target: 100e6, minBack: 1e6, maxPerPerson: 20e6, pitchFee: 0, lifetime: 1 days}));
        vm.stopPrank();
    }

    // ------------------------------------------------------------ helpers

    function _prompt() internal returns (uint256) {
        vm.prank(host);
        return arena.createPrompt(1 days, "ipfs://prompt");
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(arena), type(uint256).max);
    }

    function _pitch(uint256 promptId, address who, string memory name, string memory symbol) internal returns (uint256) {
        vm.prank(who);
        return arena.pitch(promptId, name, symbol, "ipfs://pitch");
    }

    function _back(uint256 pitchId, address who, uint256 amount) internal {
        _fund(who, amount);
        vm.prank(who);
        arena.back(pitchId, amount, 0, 0, "");
    }

    function _pass(address wallet, uint256 identityId) internal view returns (uint256 deadline, bytes memory sig) {
        deadline = block.timestamp + 1 days;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attesterKey, arena.passDigest(wallet, identityId, deadline));
        sig = abi.encodePacked(r, s, v);
    }

    function _backers(uint256 pitchId, uint256 n, uint256 idBase, uint256 amount) internal returns (address[] memory who) {
        who = new address[](n);
        for (uint256 i; i < n; ++i) {
            who[i] = makeAddr(string(abi.encodePacked("backer", vm.toString(idBase + i))));
            _back(pitchId, who[i], amount);
        }
    }

    function _status(uint256 pitchId) internal view returns (MemeArena.Status) {
        return arena.statusOf(pitchId);
    }

    // ------------------------------------------------------------ ripening

    function test_RipeningBackLaunches_variantB() public {
        _ripenAndClaim();
    }

    function test_RipeningBackLaunches_variantA() public {
        _deploy(address(0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF)); // high USDC => coin is token0
        _ripenAndClaim();
    }

    function _ripenAndClaim() internal {
        uint256 id = _pitch(0, pitcherA, "Money Printer", "BRRR");
        address[] memory early = _backers(id, 4, 1, 20e6); // $80, not ripe yet
        assertEq(uint8(_status(id)), uint8(MemeArena.Status.Live));

        // The last $20 ripens the pitch: the coin launches in this transaction, nobody presses close.
        address last = makeAddr("last");
        _fund(last, 20e6);
        vm.prank(last);
        uint256 taken = arena.back(id, 20e6, 0, 0, "");
        assertEq(taken, 20e6);
        assertEq(uint8(_status(id)), uint8(MemeArena.Status.Launched));
        assertEq(arena.launchCount(), 1);

        MemeArena.Pitch memory p = arena.getPitch(id);
        assertEq(p.total, 100e6);
        assertGt(p.tokensBought, 0);
        assertEq(NPM.ownerOf(p.lpTokenId), address(locker));
        assertTrue(FACTORY.getPool(p.token, address(usdc), 10_000) != address(0));
        assertEq(IERC20(p.token).balanceOf(address(arena)), p.tokensBought);
        assertEq(MemeToken(p.token).pitchId(), id);

        uint256 claimed;
        for (uint256 i; i < early.length; ++i) {
            vm.prank(early[i]);
            (uint256 tokens, uint256 refund) = arena.claim(id);
            assertEq(refund, 0);
            claimed += tokens;
        }
        vm.prank(last);
        (uint256 lastTokens,) = arena.claim(id);
        claimed += lastTokens;
        assertApproxEqAbs(claimed, p.tokensBought, 5); // rounding dust only

        // Backing a launched pitch is impossible; claims are one-shot.
        _fund(last, 1e6);
        vm.prank(last);
        vm.expectRevert(MemeArena.BadState.selector);
        arena.back(id, 1e6, 0, 0, "");
        vm.prank(last);
        vm.expectRevert(MemeArena.NothingToClaim.selector);
        arena.claim(id);
    }

    function test_OvershootIsNotTaken() public {
        uint256 id = _pitch(0, pitcherA, "Arc Duck", "QUACK");
        _backers(id, 4, 1, 20e6);
        _back(id, makeAddr("x"), 15e6); // $95
        address big = makeAddr("big");
        _fund(big, 20e6);
        vm.prank(big);
        uint256 taken = arena.back(id, 20e6, 0, 0, "");
        assertEq(taken, 5e6);
        assertEq(usdc.balanceOf(big), 15e6);
        assertEq(uint8(_status(id)), uint8(MemeArena.Status.Launched));
    }

    function test_FinalTopUpMayBeBelowMinBack() public {
        uint256 id = _pitch(0, pitcherA, "Arc Duck", "QUACK");
        _backers(id, 4, 1, 20e6);
        _back(id, makeAddr("x"), 19.5e6); // $99.50
        address tiny = makeAddr("tiny");
        _back(id, tiny, 0.5e6);
        assertEq(uint8(_status(id)), uint8(MemeArena.Status.Launched));
    }

    function test_ConvictionBonus_earlyDollarsGetMoreTokens() public {
        uint256 id = _pitch(0, pitcherA, "Money Printer", "BRRR");
        address early = makeAddr("early");
        _back(id, early, 20e6);
        vm.warp(vm.getBlockTimestamp() + 1 days - 1); // just before the deadline: ~1.0x
        _backers(id, 4, 100, 20e6);
        vm.prank(early);
        (uint256 earlyTokens,) = arena.claim(id);
        vm.prank(makeAddr("backer100"));
        (uint256 lateTokens,) = arena.claim(id);
        assertApproxEqRel(earlyTokens * 1e18 / lateTokens, 1.25e18, 0.001e18);
    }

    // ------------------------------------------------------------ expiry, withdraw, veto

    function test_ExpiredPitchRefunds() public {
        uint256 id = _pitch(0, pitcherA, "Alpha", "AAA");
        address w = makeAddr("w");
        _back(id, w, 10e6);
        vm.prank(w);
        vm.expectRevert(MemeArena.BadState.selector);
        arena.claim(id); // still live

        vm.warp(vm.getBlockTimestamp() + 1 days);
        assertEq(uint8(_status(id)), uint8(MemeArena.Status.Expired));
        _fund(w, 1e6);
        vm.prank(w);
        vm.expectRevert(MemeArena.BadState.selector);
        arena.back(id, 1e6, 0, 0, "");
        vm.prank(w);
        (, uint256 refund) = arena.claim(id);
        assertEq(refund, 10e6);
        assertEq(usdc.balanceOf(w), 11e6);
    }

    function test_WithdrawWhileLive() public {
        uint256 id = _pitch(0, pitcherA, "Alpha", "AAA");
        address w = makeAddr("w");
        _back(id, w, 10e6);
        assertEq(arena.getPitch(id).backers, 1);
        vm.prank(w);
        arena.withdraw(id);
        assertEq(usdc.balanceOf(w), 10e6);
        MemeArena.Pitch memory p = arena.getPitch(id);
        assertEq(p.total, 0);
        assertEq(p.weighted, 0);
        assertEq(p.backers, 0);
        vm.prank(w);
        vm.expectRevert(MemeArena.BadAmount.selector);
        arena.withdraw(id);
    }

    function test_VetoRefunds() public {
        uint256 id = _pitch(0, pitcherA, "Celebrity Coin", "CELEB");
        _backers(id, 2, 1, 20e6);
        vm.prank(pitcherA);
        vm.expectRevert(MemeArena.NotGuardian.selector);
        arena.veto(id, "nope");
        vm.prank(owner);
        arena.veto(id, "impersonation");
        assertEq(uint8(_status(id)), uint8(MemeArena.Status.Vetoed));
        vm.prank(makeAddr("backer1"));
        (, uint256 refund) = arena.claim(id);
        assertEq(refund, 20e6);
        // The ticker is free again.
        _pitch(0, pitcherB, "Celebrity Coin", "CELEB");
    }

    // ------------------------------------------------------------ prompts

    function test_PromptRace_firstToRipenWins_othersRefund() public {
        uint256 pr = _prompt();
        uint256 a = _pitch(pr, pitcherA, "Money Printer", "BRRR");
        uint256 b = _pitch(pr, pitcherB, "Rate Snip", "SNIP");
        uint256 free = _pitch(0, pitcherB, "Unrelated", "FREE");
        _backers(b, 3, 100, 20e6); // b leads with $60 ...
        _backers(free, 1, 300, 20e6);
        _backers(a, 5, 1, 20e6); // ... but a ripens first

        assertEq(arena.getPrompt(pr).winner, a);
        assertEq(uint8(_status(a)), uint8(MemeArena.Status.Launched));
        assertEq(uint8(_status(b)), uint8(MemeArena.Status.Lost));
        assertEq(uint8(_status(free)), uint8(MemeArena.Status.Live)); // freestyle pitches are not in the race

        vm.prank(makeAddr("backer100"));
        (, uint256 refund) = arena.claim(b);
        assertEq(refund, 20e6);

        vm.expectRevert(MemeArena.BadState.selector);
        _pitch(pr, pitcherA, "Too Late", "LATE"); // a won prompt takes no new pitches

        // The prompt's host earns the host share of the locker fees.
        (, address lockedHost,,) = locker.positions(arena.getPitch(a).lpTokenId);
        assertEq(lockedHost, host);
    }

    function test_PromptCancelRefundsAll() public {
        uint256 pr = _prompt();
        uint256 a = _pitch(pr, pitcherA, "Alpha", "AAA");
        _backers(a, 2, 1, 10e6);
        vm.prank(owner);
        arena.cancelPrompt(pr, "story was false");
        assertEq(uint8(_status(a)), uint8(MemeArena.Status.Lost));
        vm.prank(makeAddr("backer1"));
        (, uint256 refund) = arena.claim(a);
        assertEq(refund, 10e6);
    }

    function test_PromptClosesForPitchesAtEnd() public {
        uint256 pr = _prompt();
        vm.warp(vm.getBlockTimestamp() + 1 days);
        vm.expectRevert(MemeArena.BadTiming.selector);
        _pitch(pr, pitcherA, "Late", "LATE");
    }

    function test_OnlyHostsOpenPrompts_unlessOpen() public {
        address judge = makeAddr("judge");
        vm.prank(judge);
        vm.expectRevert(MemeArena.NotHost.selector);
        arena.createPrompt(1 hours, "");
        vm.prank(owner);
        arena.setOpenPrompts(true);
        vm.prank(judge);
        uint256 pr = arena.createPrompt(1 hours, "");
        assertEq(arena.getPrompt(pr).host, judge);
    }

    // ------------------------------------------------------------ identity

    function test_VerifiedBackersCounted_andIdentityBound() public {
        uint256 id = _pitch(0, pitcherA, "Alpha", "AAA");
        address w1 = makeAddr("w1");
        _fund(w1, 5e6);
        (uint256 d1, bytes memory s1) = _pass(w1, 42);
        vm.prank(w1);
        arena.back(id, 5e6, 42, d1, s1);
        assertEq(arena.getPitch(id).verifiedBackers, 1);

        address w2 = makeAddr("w2");
        _fund(w2, 5e6);
        (uint256 d2, bytes memory s2) = _pass(w2, 42);
        vm.prank(w2);
        vm.expectRevert(MemeArena.IdentityUsedByOtherWallet.selector);
        arena.back(id, 5e6, 42, d2, s2);

        (uint256 d3, bytes memory s3) = _pass(makeAddr("someoneElse"), 9);
        vm.prank(w2);
        vm.expectRevert(MemeArena.BadPass.selector);
        arena.back(id, 5e6, 9, d3, s3);
    }

    // ------------------------------------------------------------ rules

    function test_Caps() public {
        uint256 id = _pitch(0, pitcherA, "Alpha", "AAA");
        address w = makeAddr("w");
        _fund(w, 100e6);
        vm.startPrank(w);
        vm.expectRevert(MemeArena.BadAmount.selector);
        arena.back(id, 0.5e6, 0, 0, "");
        vm.expectRevert(MemeArena.CapExceeded.selector);
        arena.back(id, 21e6, 0, 0, "");
        arena.back(id, 20e6, 0, 0, "");
        vm.expectRevert(MemeArena.CapExceeded.selector);
        arena.back(id, 1e6, 0, 0, "");
        vm.stopPrank();
    }

    function test_TickerAndNameUniqueAmongLiveAndLaunched() public {
        uint256 a = _pitch(0, pitcherA, "Money Printer", "BRRR");
        vm.expectRevert(MemeArena.Taken.selector);
        _pitch(0, pitcherB, "Other", "BRRR");
        vm.expectRevert(MemeArena.Taken.selector);
        _pitch(0, pitcherB, "money printer", "MONEY");

        _backers(a, 5, 1, 20e6); // launches: taken forever
        vm.warp(vm.getBlockTimestamp() + 2 days);
        vm.expectRevert(MemeArena.Taken.selector);
        _pitch(0, pitcherB, "Other", "BRRR");

        // An expired pitch frees its ticker.
        uint256 c = _pitch(0, pitcherA, "Cee", "CCC");
        vm.warp(vm.getBlockTimestamp() + 1 days);
        assertEq(uint8(_status(c)), uint8(MemeArena.Status.Expired));
        _pitch(0, pitcherB, "Cee", "CCC");
    }

    function test_InvalidSymbolRejected() public {
        vm.startPrank(pitcherA);
        vm.expectRevert(MemeArena.InvalidSymbol.selector);
        arena.pitch(0, "x", "brrr", "");
        vm.expectRevert(MemeArena.InvalidSymbol.selector);
        arena.pitch(0, "x", "TOOLONGTICKER", "");
        vm.stopPrank();
    }

    function test_PitchingIsFreeByDefault_feeGoesToTreasuryWhenSet() public {
        _pitch(0, pitcherA, "Free", "FREE"); // no USDC, no approval
        vm.prank(owner);
        arena.setConfig(MemeArena.Config({target: 100e6, minBack: 1e6, maxPerPerson: 20e6, pitchFee: 0.1e6, lifetime: 1 days}));
        _fund(pitcherA, 0.1e6);
        _pitch(0, pitcherA, "Paid", "PAID");
        assertEq(arena.credits(treasury), 0.1e6);
    }

    function test_DemoConfig_singleBackerLaunches() public {
        vm.prank(owner);
        arena.setConfig(MemeArena.Config({target: 5e6, minBack: 1e6, maxPerPerson: 20e6, pitchFee: 0, lifetime: 1 days}));
        uint256 id = _pitch(0, pitcherA, "Arc Duck", "QUACK");
        address solo = makeAddr("solo");
        _back(id, solo, 5e6);
        assertEq(uint8(_status(id)), uint8(MemeArena.Status.Launched));
        vm.prank(solo);
        (uint256 tokens,) = arena.claim(id);
        assertGt(tokens, 0);
    }

    function test_PreInitializedPoolBlocksLaunchUntilNextBlock() public {
        uint256 id = _pitch(0, pitcherA, "Money Printer", "BRRR");
        _backers(id, 4, 1, 20e6);

        bytes memory init = abi.encodePacked(
            type(MemeToken).creationCode, abi.encode("Money Printer", "BRRR", "ipfs://pitch", id, address(arena))
        );
        address predicted =
            vm.computeCreate2Address(keccak256(abi.encode(id, block.number)), keccak256(init), address(arena));
        (address t0, address t1) = predicted < address(usdc) ? (predicted, address(usdc)) : (address(usdc), predicted);
        NPM.createAndInitializePoolIfNecessary(t0, t1, 10_000, 2 ** 96);

        address last = makeAddr("last");
        _fund(last, 20e6);
        vm.prank(last);
        vm.expectRevert(MemeArena.PoolPreInitialized.selector);
        arena.back(id, 20e6, 0, 0, "");

        vm.roll(block.number + 1);
        vm.prank(last);
        arena.back(id, 20e6, 0, 0, "");
        assertEq(uint8(_status(id)), uint8(MemeArena.Status.Launched));
    }

    // ------------------------------------------------------------ fees

    function test_LockerSplitsTradingFees() public {
        uint256 id = _pitch(0, pitcherA, "Money Printer", "BRRR");
        _backers(id, 5, 1, 20e6);
        MemeArena.Pitch memory p = arena.getPitch(id);

        address trader = makeAddr("trader");
        usdc.mint(trader, 1_000e6);
        vm.startPrank(trader);
        usdc.approve(address(ROUTER), type(uint256).max);
        ROUTER.exactInputSingle(ISwapRouter02.ExactInputSingleParams(address(usdc), p.token, 10_000, trader, 1_000e6, 0, 0));
        vm.stopPrank();

        locker.collect(p.lpTokenId);
        // 1% of the backers' $100 first buy + 1% of the $1,000 buy. Freestyle: the treasury is the host.
        uint256 usdcFees = locker.credits(address(usdc), pitcherA) + locker.credits(address(usdc), treasury);
        assertApproxEqAbs(usdcFees, 11e6, 2);
        assertEq(locker.credits(address(usdc), pitcherA), usdcFees * 5_000 / 10_000);
    }
}
