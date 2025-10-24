// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_DealChatTest is Swap2p_TestBase {
    bytes32 internal dealId;

    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
        vm.prank(maker);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.SELL,
            _fiat("US"),
            100e18,
            1,
            500e18,
            "wire", "", address(0));
        dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            50e18,
            _fiat("US"),
            100e18,
            "wire",
            "",
            address(0)
        );
    }

    function test_PaymentMethodStoredOnRequest() public view {
        Swap2p.DealInfo memory info = swap.getDeal(dealId);
        assertEq(info.deal.paymentMethod, "wire");
        assertEq(info.deal.chat.length, 1);
        assertTrue(info.deal.chat[0].toMaker);
        assertEq(uint256(info.deal.chat[0].state), uint256(Swap2p.DealState.REQUESTED));
        assertEq(string(info.deal.chat[0].text), "");
    }

    function test_ChatLogRecordsMessagesAndStates() public {
        vm.prank(maker);
        swap.sendMessage(dealId, bytes("maker"));

        vm.prank(taker);
        swap.sendMessage(dealId, bytes("taker"));

        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes("accepted"));

        vm.prank(taker);
        swap.markFiatPaid(dealId, bytes("paid"));

        vm.prank(maker);
        swap.release(dealId, bytes("released"));

        Swap2p.ChatMessage[] memory chat = swap.getDealChat(dealId);
        assertEq(chat.length, 6);

        assertTrue(chat[0].toMaker);
        assertEq(uint256(chat[0].state), uint256(Swap2p.DealState.REQUESTED));
        assertEq(string(chat[0].text), "");

        assertEq(chat[1].toMaker, false);
        assertEq(uint256(chat[1].state), uint256(Swap2p.DealState.NONE));
        assertEq(string(chat[1].text), "maker");

        assertEq(chat[2].toMaker, true);
        assertEq(uint256(chat[2].state), uint256(Swap2p.DealState.NONE));
        assertEq(string(chat[2].text), "taker");

        assertEq(chat[3].toMaker, false);
        assertEq(uint256(chat[3].state), uint256(Swap2p.DealState.ACCEPTED));
        assertEq(string(chat[3].text), "accepted");

        assertEq(chat[4].toMaker, true);
        assertEq(uint256(chat[4].state), uint256(Swap2p.DealState.PAID));
        assertEq(string(chat[4].text), "paid");

        assertEq(chat[5].toMaker, false);
        assertEq(uint256(chat[5].state), uint256(Swap2p.DealState.RELEASED));
        assertEq(string(chat[5].text), "released");
    }
}
