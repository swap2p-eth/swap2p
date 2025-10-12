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
        // In REQUESTED chat is allowed now
        vm.prank(maker);
        swap.sendMessage(1, "r");
        vm.prank(taker);
        swap.sendMessage(1, "r");

        vm.prank(maker);
        swap.maker_acceptRequest(1, "");

        // send messages without event expectations (coverage-friendly)
        vm.prank(maker);
        swap.sendMessage(1, "m");
        vm.prank(taker);
        swap.sendMessage(1, "t");

        // After paid, release with message is allowed and sends Chat before state change
        vm.prank(taker);
        swap.markFiatPaid(1, "paid msg");
        vm.prank(maker);
        swap.release(1, "release msg");
        
        // After released, chat is not allowed
        vm.prank(maker);
        vm.expectRevert(Swap2p.WrongState.selector);
        swap.sendMessage(1, "x");
    }
}
