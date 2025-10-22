// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_MakerProfileTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function test_OfferRequirementsStoredPerOffer() public {
        vm.prank(maker);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.SELL,
            Swap2p.FiatCode.wrap(840),
            100e18,
            1_000e18,
            1e18,
            500e18,
            "wire", "KYC + selfie", address(0));
        bytes32 usdOffer = _offerId(
            address(token),
            maker,
            Swap2p.Side.SELL,
            Swap2p.FiatCode.wrap(840)
        );
        Swap2p.OfferInfo memory usdInfo = swap.getOfferById(usdOffer);
        assertEq(usdInfo.offer.requirements, "KYC + selfie");

        // updating with empty requirements clears the field for this offer
        vm.prank(maker);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.SELL,
            Swap2p.FiatCode.wrap(840),
            100e18,
            1_000e18,
            1e18,
            500e18,
            "wire", "", address(0));
        usdInfo = swap.getOfferById(usdOffer);
        assertEq(usdInfo.offer.requirements, "");

        // another market keeps its own requirements string
        vm.prank(maker);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.SELL,
            Swap2p.FiatCode.wrap(978),
            100e18,
            1_000e18,
            1e18,
            500e18,
            "sepa", "passport only", address(0));
        bytes32 eurOffer = _offerId(
            address(token),
            maker,
            Swap2p.Side.SELL,
            Swap2p.FiatCode.wrap(978)
        );
        Swap2p.OfferInfo memory eurInfo = swap.getOfferById(eurOffer);
        assertEq(eurInfo.offer.requirements, "passport only");
        // original offer remains cleared
        usdInfo = swap.getOfferById(usdOffer);
        assertEq(usdInfo.offer.requirements, "");
    }

    function test_Nickname_Set_UniqueAndClear() public {
        vm.prank(maker);
        swap.setNickname("alpha");
        assertEq(_makerProfile(maker).nickname, "alpha");

        vm.prank(taker);
        vm.expectRevert(Swap2p.NicknameTaken.selector);
        swap.setNickname("alpha");

        vm.prank(maker);
        swap.setNickname("");
        assertEq(_makerProfile(maker).nickname, "");

        vm.prank(taker);
        swap.setNickname("alpha");
        assertEq(_makerProfile(taker).nickname, "alpha");
    }

    function test_DealCounters_OnCancelAndRelease() public {
        vm.prank(maker);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.SELL,
            Swap2p.FiatCode.wrap(840),
            100e18,
            1_000e18,
            1e18,
            500e18,
            "wire", "", address(0));
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            20e18,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            "",
            address(0)
        );
        vm.prank(taker);
        swap.cancelRequest(dealId, bytes(""));
        assertEq(_makerProfile(taker).dealsCancelled, 1);

        // maker cancels in BUY flow
        vm.prank(maker);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.BUY,
            Swap2p.FiatCode.wrap(978),
            100e18,
            1_000e18,
            1e18,
            500e18,
            "sepa", "", address(0));
        bytes32 buyDeal = _requestDealDefault(
            address(token),
            Swap2p.Side.BUY,
            maker,
            15e18,
            Swap2p.FiatCode.wrap(978),
            100e18,
            "",
            "",
            address(0)
        );
        vm.prank(maker);
        swap.maker_acceptRequest(buyDeal, bytes(""));
        vm.prank(maker);
        swap.cancelDeal(buyDeal, bytes(""));
        assertEq(_makerProfile(maker).dealsCancelled, 1);

        // completion increments both sides
        vm.prank(maker);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.SELL,
            Swap2p.FiatCode.wrap(840),
            100e18,
            1_000e18,
            1e18,
            500e18,
            "wire", "", address(0));
        bytes32 completeDeal = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            25e18,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            "",
            address(0)
        );
        vm.prank(maker);
        swap.maker_acceptRequest(completeDeal, bytes(""));
        vm.prank(taker);
        swap.markFiatPaid(completeDeal, bytes(""));
        vm.prank(maker);
        swap.release(completeDeal, bytes(""));

        Swap2p.MakerProfile memory makerAfter = _makerProfile(maker);
        Swap2p.MakerProfile memory takerAfter = _makerProfile(taker);
        assertEq(makerAfter.dealsCompleted, 1);
        assertEq(takerAfter.dealsCompleted, 1);
    }

    function test_GetProfiles_Batch() public {
        vm.prank(maker);
        swap.setNickname("alpha");
        vm.prank(taker);
        swap.setOnline(true);

        address[] memory addrs = new address[](2);
        addrs[0] = maker;
        addrs[1] = taker;
        Swap2p.MakerProfile[] memory profiles = swap.getMakerProfiles(addrs);
        assertEq(profiles.length, 2);
        assertEq(profiles[0].nickname, "alpha");
        assertTrue(profiles[1].online);
    }
}
