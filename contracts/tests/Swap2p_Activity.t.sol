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
        Swap2p.MakerProfile memory makerProfile = _makerProfile(maker);
        assertTrue(makerProfile.online);
        assertGt(makerProfile.lastActivity, 0);

        // warp and taker_requestOffer updates taker activity
        vm.warp(block.timestamp + 100);
        // create offer for SELL
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1e18, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }));
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
        Swap2p.MakerProfile memory takerProfile = _makerProfile(taker);
        assertEq(takerProfile.lastActivity, uint40(block.timestamp));
    }

    function test_LastActivity_OnAccept_Cancel_Pay_Release_And_Messages() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1e18, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }));
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

        Swap2p.MakerProfile memory makerProfile;
        Swap2p.MakerProfile memory takerProfile;

        vm.warp(block.timestamp + 1);
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes("hi"));
        makerProfile = _makerProfile(maker);
        assertEq(makerProfile.lastActivity, uint40(block.timestamp));

        vm.warp(block.timestamp + 1);
        vm.prank(maker);
        swap.sendMessage(dealId, bytes("m"));
        makerProfile = _makerProfile(maker);
        assertEq(makerProfile.lastActivity, uint40(block.timestamp));

        vm.warp(block.timestamp + 1);
        vm.prank(taker);
        swap.sendMessage(dealId, bytes("t"));
        takerProfile = _makerProfile(taker);
        assertEq(takerProfile.lastActivity, uint40(block.timestamp));

        vm.warp(block.timestamp + 1);
        vm.prank(taker);
        swap.markFiatPaid(dealId, bytes("paid"));
        takerProfile = _makerProfile(taker);
        assertEq(takerProfile.lastActivity, uint40(block.timestamp));

        vm.warp(block.timestamp + 1);
        vm.prank(maker);
        swap.release(dealId, bytes(""));
        makerProfile = _makerProfile(maker);
        assertEq(makerProfile.lastActivity, uint40(block.timestamp));
    }
}
