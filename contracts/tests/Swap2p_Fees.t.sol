// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_FeesTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function test_Fees_NoPartner() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1e18, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }));
        uint128 amount = 300e18;
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            amount,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "wire",
            "",
            address(0)
        );
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes("ok"));
        vm.prank(taker);
        swap.markFiatPaid(dealId, bytes("paid"));

        uint256 authorBefore = token.balanceOf(author);
        vm.prank(maker);
        swap.release(dealId, bytes(""));
        uint256 fee = (amount * 50) / 10_000;
        assertEq(token.balanceOf(author) - authorBefore, fee, "author gets fee when no partner");
    }

    function test_Fees_WithPartner() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1_000e18, 1e18, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "sepa",
            requirements: "",
            comment: ""
        }));
        uint128 amount = 120e18;
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.BUY,
            maker,
            amount,
            Swap2p.FiatCode.wrap(978),
            100e18,
            "sepa",
            "",
            partner
        );
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes("ok"));
        vm.prank(maker);
        swap.markFiatPaid(dealId, bytes("paid"));

        uint256 authorBefore = token.balanceOf(author);
        uint256 partnerBefore = token.balanceOf(partner);
        vm.prank(taker);
        swap.release(dealId, bytes(""));
        uint256 fee = (amount * 50) / 10_000;
        uint256 takerShare = (fee * 2000) / 10_000;
        assertEq(token.balanceOf(partner) - partnerBefore, takerShare);
        assertEq(token.balanceOf(author) - authorBefore, fee - takerShare);
    }

    function test_Fees_BothPartners() public {
        address makerPartner = makeAddr("makerPartner");
        address auxMaker = makeAddr("auxMaker");

        // prepare aux maker so primary maker can bind affiliate once
        token.mint(auxMaker, 1e24);
        vm.startPrank(auxMaker);
        token.approve(address(swap), type(uint256).max);
        swap.setOnline(true);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.BUY,
            Swap2p.FiatCode.wrap(840),
            100e18,
            1_000e18,
            1e18,
            500e18,
            Swap2p.MakerOfferTexts({
                paymentMethods: "wire",
                requirements: "",
                comment: ""
            })
        );
        vm.stopPrank();

        // maker (acting as taker) binds affiliate partner once
        bytes32 dummyDeal = _requestDealAs(
            maker,
            address(token),
            Swap2p.Side.BUY,
            auxMaker,
            10e18,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "wire",
            "",
            makerPartner
        );
        vm.prank(maker);
        swap.cancelRequest(dummyDeal, bytes(""));

        // actual trade where both sides have affiliates
        vm.prank(maker);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.SELL,
            Swap2p.FiatCode.wrap(978),
            100e18,
            1_000e18,
            1e18,
            500e18,
            Swap2p.MakerOfferTexts({
                paymentMethods: "sepa",
                requirements: "",
                comment: ""
            })
        );
        uint128 amount = 200e18;
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            amount,
            Swap2p.FiatCode.wrap(978),
            100e18,
            "sepa",
            "",
            partner
        );
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes("ok"));
        vm.prank(taker);
        swap.markFiatPaid(dealId, bytes("paid"));

        uint256 authorBefore = token.balanceOf(author);
        uint256 takerPartnerBefore = token.balanceOf(partner);
        uint256 makerPartnerBefore = token.balanceOf(makerPartner);
        vm.prank(maker);
        swap.release(dealId, bytes(""));

        uint256 fee = (amount * 50) / 10_000;
        uint256 takerShare = (fee * 2000) / 10_000;
        uint256 makerShare = (fee * 3000) / 10_000;

        assertEq(token.balanceOf(partner) - takerPartnerBefore, takerShare, "taker affiliate share");
        assertEq(token.balanceOf(makerPartner) - makerPartnerBefore, makerShare, "maker affiliate share");
        assertEq(token.balanceOf(author) - authorBefore, fee - takerShare - makerShare, "author residual share");
    }
}
