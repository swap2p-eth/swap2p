// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_CancelTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function _setupSell(uint128 amount) internal returns (bytes32 dealId) {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1e18, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }), address(0));
        dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            amount,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            "",
            address(0)
        );
    }

    function _setupBuy(uint128 amount) internal returns (bytes32 dealId) {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1_000e18, 1e18, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "sepa",
            requirements: "",
            comment: ""
        }), address(0));
        dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.BUY,
            maker,
            amount,
            Swap2p.FiatCode.wrap(978),
            100e18,
            "",
            "",
            address(0)
        );
    }

    function test_CancelRequest_Sell_ByMakerOrTaker_ReserveRestored() public {
        bytes32 dealId = _setupSell(100e18);
        // cancel by maker
        vm.prank(maker);
        swap.cancelRequest(dealId, bytes("cancel"));
        // request again to ensure reserve restored
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 100e18, Swap2p.FiatCode.wrap(840), 100e18, "", bytes(""), address(0));
    }

    function test_CancelDeal_Sell_ByTaker_ReserveRestored() public {
        bytes32 dealId = _setupSell(100e18);
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes("ok"));
        // cancel by taker (SELL)
        vm.prank(taker);
        swap.cancelDeal(dealId, bytes("later"));
        // request again to ensure reserve restored
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 100e18, Swap2p.FiatCode.wrap(840), 100e18, "", bytes(""), address(0));
    }

    function test_CancelDeal_Buy_ByMaker_ReserveRestored() public {
        bytes32 dealId = _setupBuy(50e18);
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes("ok"));
        // cancel by maker (BUY)
        vm.prank(maker);
        swap.cancelDeal(dealId, bytes("later"));
        // request again to ensure reserve restored
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.BUY, maker, 50e18, Swap2p.FiatCode.wrap(978), 100e18, "", bytes(""), address(0));
    }

    function test_Revert_CancelDeal_WrongCaller() public {
        bytes32 dealId = _setupSell(100e18);
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes("ok"));
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert();
        swap.cancelDeal(dealId, bytes(""));
    }
}
