// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_EdgeCasesTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
    }

    function _setupSellBasic(uint128 minAmt) internal {
        vm.prank(maker);
        swap.setOnline(true);
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, minAmt, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }), address(0));
    }

    function _setupBuyBasic(uint128 minAmt) internal {
        vm.prank(maker);
        swap.setOnline(true);
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1_000e18, minAmt, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "sepa",
            requirements: "",
            comment: ""
        }), address(0));
    }

    // Covers modifier onlyMaker revert (line ~150)
    function test_Modifier_onlyMaker_WrongCaller() public {
        _setupSellBasic(1);
        bytes32 dealId = _requestDealDefault(
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
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(Swap2p.WrongCaller.selector);
        swap.maker_acceptRequest(dealId, bytes(""));
    }

    // Covers modifier onlyTaker revert (line ~154)
    function test_Modifier_onlyTaker_WrongCaller() public {
        _setupSellBasic(1);
        bytes32 dealId = _requestDealDefault(
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
        address stranger = makeAddr("str2");
        vm.prank(stranger);
        vm.expectRevert(Swap2p.WrongCaller.selector);
        swap.sendMessage(dealId, bytes("x"));
    }

    // Covers _removeOfferKey pos==0 early return (line ~177)
    function test_DeleteOffer_WhenNotExists_NoRevert() public {
        vm.prank(maker);
        swap.setOnline(true);
        vm.prank(maker);
        // no offer created for this fiat/side -> should not revert
        swap.maker_deleteOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840));
    }

    // Covers _removeOpen pos==0 via same maker/taker (line ~198)
    function test_CancelRequest_SameMakerTaker_RemovesOnce() public {
        vm.prank(maker);
        swap.setOnline(true);
        // maker posts SELL, then self-requests as taker==maker
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }), address(0));
        bytes32 dealId = _requestDealAs(
            maker,
            address(token),
            Swap2p.Side.SELL,
            maker,
            1e18,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            "",
            address(0)
        );
        // maker cancels; second _removeOpen sees pos==0
        vm.prank(maker);
        swap.cancelRequest(dealId, bytes(""));
    }

    // Covers _pull amt==0 early return (line ~218) and _push amt==0 (line ~226)
    function test_ZeroAmount_Request_Accept_Release() public {
        _setupSellBasic(0);
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            0,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            "",
            address(0)
        );
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes(""));
        vm.prank(taker);
        swap.markFiatPaid(dealId, bytes(""));
        vm.prank(maker);
        swap.release(dealId, bytes(""));
    }

    // Covers taker cancelDeal WrongSide in BUY (line ~399)
    function test_CancelDeal_WrongSide_TakerOnBuy() public {
        _setupBuyBasic(1);
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.BUY,
            maker,
            10e18,
            Swap2p.FiatCode.wrap(978),
            100e18,
            "",
            "",
            address(0)
        );
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes(""));
        vm.prank(taker);
        vm.expectRevert(Swap2p.WrongSide.selector);
        swap.cancelDeal(dealId, bytes(""));
    }

    // Covers getOpenDeals(off>=len) early return (line ~489)
    function test_GetOpenDeals_OffGeLen_ReturnsEmpty() public view {
        // no open deals for maker
        uint len = swap.getOpenDealCount(maker);
        bytes32[] memory out = swap.getOpenDeals(maker, len, 10);
        require(out.length == 0, "should be empty");
    }
}
