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
        Swap2p.OfferInfo[] memory offers = swap.getMarketOffers(address(token), Swap2p.Side.SELL, _fiat("US"), 0, 10);
        assertEq(offers.length, 1);
        assertEq(offers[0].maker, maker);
        assertEq(offers[0].online, false);
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
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 0, 1e18, 500e18, "wire", "", address(0));
        Swap2p.OfferInfo[] memory offers = swap.getMarketOffers(address(token), Swap2p.Side.SELL, _fiat("US"), 0, 10);
        assertEq(offers.length, 1);
        assertEq(offers[0].online, true);
    }
}
