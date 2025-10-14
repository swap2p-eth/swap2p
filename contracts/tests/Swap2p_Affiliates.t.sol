// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_AffiliatesTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function test_Revert_SelfPartner() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1, 500e18, "wire", "");
        vm.prank(taker);
        vm.expectRevert(Swap2p.SelfPartnerNotAllowed.selector);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 10e18, Swap2p.FiatCode.wrap(840), 100e18, "", taker);
    }

    function test_Partner_BindsOnce() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1_000e18, 1, 500e18, "sepa", "");

        // first request binds partner
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.BUY, maker, 10e18, Swap2p.FiatCode.wrap(978), 100e18, "", partner);
        // second request attempts to change partner -> should keep the first
        address partner2 = makeAddr("partner2");
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.BUY, maker, 10e18, Swap2p.FiatCode.wrap(978), 100e18, "", partner2);
        // accept and finish one of them
        vm.prank(maker);
        swap.maker_acceptRequest(1, bytes(""));
        vm.prank(maker);
        swap.markFiatPaid(1, bytes(""));
        vm.prank(taker);
        swap.release(1, bytes(""));
        // FeeDistributed should have used 'partner'
        // Balance checks already covered elsewhere; here assert mapping keeps first partner
        assertEq(swap.affiliates(taker), partner);
    }
}
