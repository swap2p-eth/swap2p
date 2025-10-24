// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_ViewsAvailabilityTest is Swap2p_TestBase {
    function test_OfferKeysAndCounts() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 0, 1e18, 500e18, "wire", "", address(0));
        uint count = swap.getOfferCount(address(token), Swap2p.Side.SELL, _fiat("US"));
        assertEq(count, 1);
        address[] memory keys = swap.getOfferKeys(address(token), Swap2p.Side.SELL, _fiat("US"), 0, 10);
        assertEq(keys.length, 1);
        assertEq(keys[0], maker);
    }

    function test_Availability_Online() public {
        // offline by default
        address[] memory arr = new address[](1);
        arr[0] = maker;
        Swap2p.MakerProfile[] memory profiles = swap.getMakerProfiles(arr);
        assertEq(profiles.length, 1);
        assertEq(profiles[0].online, false);

        vm.prank(maker);
        swap.setOnline(true);
        profiles = swap.getMakerProfiles(arr);
        assertEq(profiles[0].online, true);

        // no working hours anymore; availability equals online state
    }
}
