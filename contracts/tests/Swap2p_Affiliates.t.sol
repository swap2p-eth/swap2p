// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_AffiliatesTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function test_SelfPartnerIgnored() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }), address(0));
        bytes32 dealId = _requestDealAs(
            taker,
            address(token),
            Swap2p.Side.SELL,
            maker,
            10e18,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            "",
            taker
        );
        assertEq(swap.affiliates(taker), address(0));
        vm.prank(maker);
        swap.cancelRequest(dealId, bytes(""));
    }

    function test_Partner_BindsOnce() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1_000e18, 1, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "sepa",
            requirements: "",
            comment: ""
        }), address(0));

        // first request binds partner
        bytes32 firstDeal = _requestDealDefault(
            address(token),
            Swap2p.Side.BUY,
            maker,
            10e18,
            Swap2p.FiatCode.wrap(978),
            100e18,
            "",
            "",
            partner
        );
        // second request attempts to change partner -> should keep the first
        address partner2 = makeAddr("partner2");
        _requestDealDefault(
            address(token),
            Swap2p.Side.BUY,
            maker,
            10e18,
            Swap2p.FiatCode.wrap(978),
            100e18,
            "",
            "",
            partner2
        );
        // accept and finish one of them
        vm.prank(maker);
        swap.maker_acceptRequest(firstDeal, bytes(""));
        vm.prank(maker);
        swap.markFiatPaid(firstDeal, bytes(""));
        vm.prank(taker);
        swap.release(firstDeal, bytes(""));
        // Партнёр остаётся привязан к первому значению; баланс проверяется в других тестах
        assertEq(swap.affiliates(taker), partner);
    }
}
