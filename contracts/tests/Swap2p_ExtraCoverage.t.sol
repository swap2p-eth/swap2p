// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_ExtraCoverageTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
    }

    function test_Revert_MakerOffline_OnRequest() public {
        // maker is offline by default
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1, 500e18, "wire", "");
        vm.prank(taker);
        vm.expectRevert(Swap2p.MakerOffline.selector);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 10e18, Swap2p.FiatCode.wrap(840), 100e18, "", address(0));
    }

    function test_WrongState_CancelRequest_AfterAccepted() public {
        vm.prank(maker);
        swap.setOnline(true);
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1, 500e18, "wire", "");
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
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes(""));
        vm.prank(taker);
        vm.expectRevert(Swap2p.WrongState.selector);
        swap.cancelRequest(dealId, bytes(""));
    }

    function test_WrongState_CancelDeal_BeforeAccepted() public {
        vm.prank(maker);
        swap.setOnline(true);
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1_000e18, 1, 500e18, "sepa", "");
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.BUY,
            maker,
            10e18,
            Swap2p.FiatCode.wrap(978),
            100e18,
            "",
            address(0)
        );
        // maker is the one who can cancel in BUY, but state is REQUESTED
        vm.prank(maker);
        vm.expectRevert(Swap2p.WrongState.selector);
        swap.cancelDeal(dealId, bytes(""));
    }

    function test_WrongState_MarkPaid_BeforeAccepted() public {
        vm.prank(maker);
        swap.setOnline(true);
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1_000e18, 1, 500e18, "sepa", "");
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.BUY,
            maker,
            10e18,
            Swap2p.FiatCode.wrap(978),
            100e18,
            "",
            address(0)
        );
        // payer in BUY is maker, but status is REQUESTED
        vm.prank(maker);
        vm.expectRevert(Swap2p.WrongState.selector);
        swap.markFiatPaid(dealId, bytes(""));
    }

    function test_RemoveOffer_LastIndex_Path() public {
        vm.prank(maker);
        swap.setOnline(true);
        address maker2 = makeAddr("maker2");
        token.mint(maker2, 1e24);
        vm.prank(maker2);
        token.approve(address(swap), type(uint256).max);
        vm.prank(maker2);
        swap.setOnline(true);

        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1, 500e18, "wire", "");
        vm.prank(maker2);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1, 500e18, "wire", "");

        // remove last (depending on insertion order), here remove maker2 which should be last
        vm.prank(maker2);
        swap.maker_deleteOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840));

        address[] memory keys = swap.getOfferKeys(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 10);
        assertEq(keys.length, 1);
        assertEq(keys[0], maker);
    }

    function test_PreviewNextDealId_MatchesActual() public {
        vm.prank(maker);
        swap.setOnline(true);
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 15e18, 600e18, "wire", "preview test");
        (bytes32 predicted,) = swap.previewNextDealId(taker);
        bytes32 actual = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            15e18,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            address(0)
        );
        assertEq(actual, predicted, "deal id should match preview before request");
        (bytes32 nextId,) = swap.previewNextDealId(taker);
        assertTrue(nextId != actual, "next preview should advance after request");
    }
}
