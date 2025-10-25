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

    function _completeDealWithMessages() internal {
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
    }

    function test_PaymentMethodStoredOnRequest() public view {
        Swap2p.Deal memory info = _deal(dealId);
        assertEq(info.paymentMethod, "wire");
        Swap2p.ChatMessage[] memory first = swap.getDealChatSlice(dealId, 0, 1);
        assertEq(first.length, 1);
        assertTrue(first[0].toMaker);
        assertEq(uint256(first[0].state), uint256(Swap2p.DealState.REQUESTED));
        assertEq(string(first[0].text), "");
    }

    function test_ChatLogRecordsMessagesAndStates() public {
        _completeDealWithMessages();

        Swap2p.ChatMessage[] memory chat = swap.getDealChatSlice(dealId, 0, 10);
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

    function test_ChatSlicePagination() public {
        _completeDealWithMessages();

        assertEq(swap.getDealChatLength(dealId), 6);

        Swap2p.ChatMessage[] memory slice = swap.getDealChatSlice(dealId, 1, 2);
        assertEq(slice.length, 2);
        assertEq(slice[0].toMaker, false);
        assertEq(string(slice[0].text), "maker");
        assertEq(slice[1].toMaker, true);
        assertEq(string(slice[1].text), "taker");

        // requesting beyond length yields empty array
        Swap2p.ChatMessage[] memory empty = swap.getDealChatSlice(dealId, 10, 5);
        assertEq(empty.length, 0);

        // zero limit returns empty array
        empty = swap.getDealChatSlice(dealId, 0, 0);
        assertEq(empty.length, 0);
    }
}
