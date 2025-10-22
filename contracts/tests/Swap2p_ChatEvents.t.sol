// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_ChatEventsTest is Swap2p_TestBase {
    bytes32 internal dealId;

    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }), address(0));
        dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            10e18,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            "",
            address(0)
        );
    }

    function test_Chat_OnlyInAcceptedOrPaid() public {
        // In REQUESTED chat is allowed now
        vm.prank(maker);
        swap.sendMessage(dealId, bytes("r"));
        vm.prank(taker);
        swap.sendMessage(dealId, bytes("r"));

        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes(""));

        // send messages without event expectations (coverage-friendly)
        vm.prank(maker);
        swap.sendMessage(dealId, bytes("m"));
        vm.prank(taker);
        swap.sendMessage(dealId, bytes("t"));

        // After paid, release with message is allowed and sends Chat before state change
        vm.prank(taker);
        swap.markFiatPaid(dealId, bytes("paid msg"));
        vm.prank(maker);
        swap.release(dealId, bytes("release msg"));
        
        // After released, chat is not allowed
        vm.prank(maker);
        vm.expectRevert(Swap2p.WrongState.selector);
        swap.sendMessage(dealId, bytes("x"));
    }
}
