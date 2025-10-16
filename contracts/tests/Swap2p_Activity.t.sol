// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_ActivityTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function test_LastActivity_OnSetOnline_And_Request() public {
        // setOnline already touched
        (bool on1, uint40 ts1) = swap.makerInfo(maker);
        assertTrue(on1);
        assertGt(ts1, 0);

        // warp and taker_requestOffer updates taker activity
        vm.warp(block.timestamp + 100);
        // create offer for SELL
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1e18, 500e18, "wire", "");
        _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            10e18,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            address(0)
        );
        (, uint40 tsT) = swap.makerInfo(taker);
        assertEq(tsT, uint40(block.timestamp));
    }

    function test_LastActivity_OnAccept_Cancel_Pay_Release_And_Messages() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1e18, 500e18, "wire", "");
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            10e18,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            address(0)
        );

        vm.warp(block.timestamp + 1);
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes("hi"));
        (, uint40 tsM) = swap.makerInfo(maker);
        assertEq(tsM, uint40(block.timestamp));

        vm.warp(block.timestamp + 1);
        vm.prank(maker);
        swap.sendMessage(dealId, bytes("m"));
        (, tsM) = swap.makerInfo(maker);
        assertEq(tsM, uint40(block.timestamp));

        vm.warp(block.timestamp + 1);
        vm.prank(taker);
        swap.sendMessage(dealId, bytes("t"));
        (, uint40 tsT) = swap.makerInfo(taker);
        assertEq(tsT, uint40(block.timestamp));

        vm.warp(block.timestamp + 1);
        vm.prank(taker);
        swap.markFiatPaid(dealId, bytes("paid"));
        (, tsT) = swap.makerInfo(taker);
        assertEq(tsT, uint40(block.timestamp));

        vm.warp(block.timestamp + 1);
        vm.prank(maker);
        swap.release(dealId, bytes(""));
        (, tsM) = swap.makerInfo(maker);
        assertEq(tsM, uint40(block.timestamp));
    }
}
