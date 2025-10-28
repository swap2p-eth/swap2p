// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../../Swap2p.sol";

/// @dev Test-only harness exposing internal pagination data for invariant/property tests.
contract Swap2pViewHarness is Swap2p {
    constructor(address author_) Swap2p(author_) {}

    function getMakerOfferIds(address maker, uint off, uint lim)
        external
        view
        returns (bytes32[] memory out)
    {
        return _slice(_makerOffers[maker], off, lim);
    }

    function getOpenDeals(address user, uint off, uint lim)
        external
        view
        returns (bytes32[] memory out)
    {
        return _slice(_openDeals[user], off, lim);
    }

    function _slice(bytes32[] storage arr, uint off, uint lim)
        internal
        view
        returns (bytes32[] memory out)
    {
        uint len = arr.length;
        if (off >= len || lim == 0) return new bytes32[](0);
        uint end = off + lim;
        if (end < off || end > len) end = len;
        uint slice = end - off;
        out = new bytes32[](slice);
        for (uint i; i < slice; i++) {
            out[i] = arr[off + i];
        }
    }
}
