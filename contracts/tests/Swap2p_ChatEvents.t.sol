// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_ChatEventsTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1, 500e18, "wire", "");
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 10e18, Swap2p.FiatCode.wrap(840), 100e18, "", address(0));
    }

    function test_Chat_OnlyInAcceptedOrPaid() public {
        // cannot chat in REQUESTED? The code allows chat only in ACCEPTED/PAID
        vm.prank(maker);
        vm.expectRevert(Swap2p.WrongState.selector);
        swap.maker_sendMessage(1, "");
        vm.prank(taker);
        vm.expectRevert(Swap2p.WrongState.selector);
        swap.taker_sendMessage(1, "");

        vm.prank(maker);
        swap.maker_acceptRequest(1, "");

        // send messages without event expectations (coverage-friendly)
        vm.prank(maker);
        swap.maker_sendMessage(1, "m");
        vm.prank(taker);
        swap.taker_sendMessage(1, "t");
    }
}
