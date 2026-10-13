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
///   ATTESTER      Meme This pass signer (required)
///   TARGET        USDC (6 decimals) that makes a pitch ripe and launches it (default 2e6 for the demo)
///   PITCH_FEE     USDC, 6 decimals (default 0: free pitching)
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
        address attester = vm.envAddress("ATTESTER");
        MemeArena.Config memory cfg = MemeArena.Config({
            target: uint96(vm.envOr("TARGET", uint256(2e6))),
            minBack: 1e6,
            maxPerPerson: 20e6,
            pitchFee: uint96(vm.envOr("PITCH_FEE", uint256(0)))
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
        arena.setAttester(attester);
        arena.setConfig(cfg);
        _seedEntities(arena);
        vm.stopBroadcast();

        console.log("LpLocker ", address(locker));
        console.log("Block    ", block.number);
        console.log("MemeArena", address(arena));
    }

    /// Starting entities. People and companies: one race at a time, 24h races, 6h cooldown after a birth.
    /// Culture: up to 3 parallel 72h races, no cooldown. Ids are keccak256 of "x:<handle lowercased>" or "culture".
    function _seedEntities(MemeArena arena) internal {
        string[7] memory handles = ["elonmusk", "realDonaldTrump", "OpenAI", "Google", "Apple", "cz_binance", "circle"];
        string[7] memory names = ["Elon Musk", "Donald Trump", "OpenAI", "Google", "Apple", "CZ", "Circle"];
        string[7] memory kinds = ["person", "person", "org", "org", "org", "person", "org"];
        for (uint256 i; i < handles.length; ++i) {
            arena.setEntity(
                keccak256(bytes(string.concat("x:", vm.toLowercase(handles[i])))),
                true,
                1,
                1 days,
                6 hours,
                string.concat(
                    "data:application/json,%7B%22name%22%3A%22", _enc(names[i]), "%22%2C%22kind%22%3A%22", kinds[i],
                    "%22%2C%22x%22%3A%22", handles[i], "%22%7D"
                )
            );
        }
        arena.setEntity(
            keccak256("culture"), true, 3, 3 days, 0,
            "data:application/json,%7B%22name%22%3A%22Culture%22%2C%22kind%22%3A%22culture%22%7D"
        );
    }

    /// Percent-encode spaces (the only special character in the seeded names).
    function _enc(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out;
        for (uint256 i; i < b.length; ++i) {
            out = b[i] == " " ? bytes.concat(out, "%20") : bytes.concat(out, b[i]);
        }
        return string(out);
    }
}
