// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MemeToken
/// @notice Plain fixed-supply ERC-20 born from a winning Meme This pitch.
///         No owner, no mint, no tax, no blocklist. The whole supply goes to the arena,
///         which places it in a locked Uniswap position in the same transaction.
contract MemeToken is ERC20 {
    uint256 public constant SUPPLY = 1_000_000_000 ether;

    /// @notice Meme This pitch that produced this coin.
    uint256 public immutable pitchId;
    /// @notice Pitch metadata (image + lore), usually an IPFS or HTTPS URI.
    string public metadataURI;

    constructor(string memory name_, string memory symbol_, string memory uri_, uint256 pitchId_, address to)
        ERC20(name_, symbol_)
    {
        pitchId = pitchId_;
        metadataURI = uri_;
        _mint(to, SUPPLY);
    }
}
