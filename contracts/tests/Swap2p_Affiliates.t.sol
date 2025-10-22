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

    function test_Revert_SelfPartner() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }));
        vm.prank(taker);
        vm.expectRevert(Swap2p.SelfPartnerNotAllowed.selector);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 10e18, Swap2p.FiatCode.wrap(840), 100e18, "", bytes(""), taker);
    }

    function test_Partner_BindsOnce() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1_000e18, 1, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "sepa",
            requirements: "",
            comment: ""
        }));

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
