// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {MemeArena} from "../src/MemeArena.sol";
import {LpLocker} from "../src/LpLocker.sol";
import {INonfungiblePositionManager, ISwapRouter02} from "../src/interfaces/IUniswapV3.sol";

/// Deploys LpLocker + MemeArena to Arc mainnet and wires them.
///
/// Env:
///   TREASURY      protocol fee recipient (required)
///   HOST          address allowed to open prompts, e.g. the news desk (required)
///   ATTESTER      Meme This pass signer (required)
///   TARGET        USDC (6 decimals) that makes a pitch ripe and launches it (default 2e6 for the demo)
///   LIFETIME      seconds a pitch has to ripen before it is refundable (default 86400)
///   PITCH_FEE     USDC, 6 decimals (default 0: free pitching)
///   OPEN_PROMPTS  anyone may open a prompt (default false)
///   USDC          local forks only; defaults to Arc USDC 0x3600…0000
///
/// Run (the broadcaster becomes owner and guardian):
///   forge script script/Deploy.s.sol --rpc-url arc --private-key $DEPLOYER_PRIVATE_KEY --broadcast
contract Deploy is Script {
    INonfungiblePositionManager constant NPM = INonfungiblePositionManager(0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377);
    ISwapRouter02 constant ROUTER = ISwapRouter02(0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77);

    function run() external returns (MemeArena arena, LpLocker locker) {
        require(block.chainid == 5042, "Arc mainnet (or a local fork of it) only");
        // USDC override exists only for local forks, where Arc's native USDC predeploy is unavailable.
        IERC20 usdc = IERC20(vm.envOr("USDC", address(0x3600000000000000000000000000000000000000)));
        address treasury = vm.envAddress("TREASURY");
        address host = vm.envAddress("HOST");
        address attester = vm.envAddress("ATTESTER");
        MemeArena.Config memory cfg = MemeArena.Config({
            target: uint96(vm.envOr("TARGET", uint256(2e6))),
            minBack: 1e6,
            maxPerPerson: 20e6,
            pitchFee: uint96(vm.envOr("PITCH_FEE", uint256(0))),
            lifetime: uint32(vm.envOr("LIFETIME", uint256(1 days)))
        });

        // Starting value ~$5,100 for the 1B supply; see README for the derivation.
        MemeArena.LaunchParams memory lp = MemeArena.LaunchParams({
            tickA: -398_200,
            sqrtA: 178849218479976202948,
            tickB: 398_200,
            sqrtB: 35097171733459150718731692347568318357
        });

        vm.startBroadcast();
        address owner = msg.sender;
        locker = new LpLocker(NPM, treasury, owner);
        arena = new MemeArena(usdc, NPM, ROUTER, locker, owner, treasury, lp);
        locker.setArena(address(arena));
        arena.setHost(host, true);
        arena.setAttester(attester);
        arena.setConfig(cfg);
        if (vm.envOr("OPEN_PROMPTS", false)) arena.setOpenPrompts(true);
        vm.stopBroadcast();

        console.log("LpLocker ", address(locker));
        console.log("MemeArena", address(arena));
    }
}
