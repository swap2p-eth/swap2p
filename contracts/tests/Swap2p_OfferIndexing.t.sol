// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_OfferIndexingTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function _setupMaker(address account) private {
        token.mint(account, 1e24);
        vm.startPrank(account);
        token.approve(address(swap), type(uint256).max);
        swap.setOnline(true);
        vm.stopPrank();
    }

    function _setupTaker(address account) private {
        token.mint(account, 1e24);
        vm.startPrank(account);
        token.approve(address(swap), type(uint256).max);
        vm.stopPrank();
    }

    function test_Index_RemoveMiddleMaker() public {
        address maker2 = makeAddr("maker2");
        address maker3 = makeAddr("maker3");
        // fund & approve
        token.mint(maker2, 1e24);
        token.mint(maker3, 1e24);
        vm.startPrank(maker2);
        token.approve(address(swap), type(uint256).max);
        swap.setOnline(true);
        vm.stopPrank();
        vm.startPrank(maker3);
        token.approve(address(swap), type(uint256).max);
        swap.setOnline(true);
        vm.stopPrank();

        // same token/side/fiat, three makers
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }));
        vm.prank(maker2);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }));
        vm.prank(maker3);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }));

        address[] memory keys = swap.getOfferKeys(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 10);
        assertEq(keys.length, 3);

        // delete middle maker2
        vm.prank(maker2);
        swap.maker_deleteOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840));

        keys = swap.getOfferKeys(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 10);
        assertEq(keys.length, 2);
        // remaining are maker and maker3 (order may have maker3 swapped into middle)
        assertTrue((keys[0] == maker && keys[1] == maker3) || (keys[0] == maker3 && keys[1] == maker));
    }

    function test_Reserve_NotRestored_WhenOfferDeleted() public {
        // create offer
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 10e18, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }));
        // request amount 50
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            50e18,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            address(0)
        );
        // delete offer before cancel
        vm.prank(maker);
        swap.maker_deleteOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840));
        // cancel request
        vm.prank(taker);
        swap.cancelRequest(dealId, bytes(""));
        // new offer and request same amount: reserve should not be auto-restored from old offer
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 0, 10e18, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "wire",
            requirements: "",
            comment: ""
        }));
        // reserve is 0, request of 50 should fail with InsufficientReserve
        vm.prank(taker);
        vm.expectRevert(Swap2p.InsufficientReserve.selector);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 50e18, Swap2p.FiatCode.wrap(840), 100e18, "", address(0));
    }

    function test_ListOffers_ReturnsOfferInfoWithIds() public {
        vm.prank(maker);
        swap.setOnline(true);
        (bytes32 predicted,) = swap.previewNextOfferId(maker);
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 200e18, 2_000e18, 5e18, 600e18, Swap2p.MakerOfferTexts({
            paymentMethods: "sepa",
            requirements: "",
            comment: "id check"
        }));
        bytes32 storedId = _offerId(address(token), maker, Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978));
        assertEq(storedId, predicted, "offer id should match preview");

        Swap2p.OfferInfo[] memory items = swap.listOffers(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978));
        assertEq(items.length, 1);
        assertEq(items[0].id, storedId);
        assertEq(items[0].maker, maker);
        assertEq(items[0].offer.reserve, 2_000e18);
        assertEq(items[0].offer.minAmt, 5e18);

        Swap2p.OfferInfo memory fetched = swap.getOfferById(storedId);
        assertEq(fetched.maker, maker);
        assertEq(fetched.offer.priceFiatPerToken, 200e18);
        assertEq(fetched.offer.ts, items[0].offer.ts);
        // payment methods should match string
        assertEq(keccak256(bytes(fetched.offer.paymentMethods)), keccak256(bytes("sepa")));
    }

    function test_IndexConsistency_AcrossMarketsAndDeals() public {
        address makerB = makeAddr("makerB");
        address makerC = makeAddr("makerC");
        _setupMaker(makerB);
        _setupMaker(makerC);

        // maker creates two offers (SELL USD, BUY EUR)
        vm.prank(maker);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.SELL,
            Swap2p.FiatCode.wrap(840),
            101e18,
            5_000e18,
            50e18,
            2_000e18,
            Swap2p.MakerOfferTexts({
                paymentMethods: "wire",
                requirements: "KYC + selfie",
                comment: ""
            })
        );
        vm.prank(maker);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.BUY,
            Swap2p.FiatCode.wrap(978),
            99e18,
            4_000e18,
            25e18,
            1_500e18,
            Swap2p.MakerOfferTexts({
                paymentMethods: "sepa",
                requirements: "passport",
                comment: ""
            })
        );

        // other makers join the USD SELL market
        vm.prank(makerB);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.SELL,
            Swap2p.FiatCode.wrap(840),
            102e18,
            3_500e18,
            40e18,
            1_800e18,
            Swap2p.MakerOfferTexts({
                paymentMethods: "pix",
                requirements: "video-call",
                comment: ""
            })
        );
        vm.prank(makerC);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.SELL,
            Swap2p.FiatCode.wrap(978),
            100e18,
            2_500e18,
            20e18,
            1_200e18,
            Swap2p.MakerOfferTexts({
                paymentMethods: "swift",
                requirements: "",
                comment: ""
            })
        );

        // verify market indexes
        assertEq(swap.getOfferCount(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840)), 2);
        address[] memory usdMakers = swap.getOfferKeys(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 10);
        assertEq(usdMakers.length, 2);
        bool seenMakerA;
        bool seenMakerB;
        for (uint256 i; i < usdMakers.length; i++) {
            if (usdMakers[i] == maker) seenMakerA = true;
            if (usdMakers[i] == makerB) seenMakerB = true;
        }
        assertTrue(seenMakerA && seenMakerB);

        assertEq(swap.getOfferCount(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(978)), 1);
        address[] memory eurMakers = swap.getOfferKeys(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(978), 0, 10);
        assertEq(eurMakers.length, 1);
        assertEq(eurMakers[0], makerC);

        // maker specific indexes
        assertEq(swap.getMakerOfferCount(maker), 2);
        bytes32[] memory makerOfferIds = swap.getMakerOfferIds(maker, 0, 10);
        assertEq(makerOfferIds.length, 2);

        // delete makerB's USD offer and maker's EUR BUY offer
        vm.prank(makerB);
        swap.maker_deleteOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840));
        vm.prank(maker);
        swap.maker_deleteOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978));

        // USD market should retain only maker
        assertEq(swap.getOfferCount(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840)), 1);
        usdMakers = swap.getOfferKeys(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 10);
        assertEq(usdMakers.length, 1);
        assertEq(usdMakers[0], maker);

        // maker now has only one offer remaining
        assertEq(swap.getMakerOfferCount(maker), 1);
        makerOfferIds = swap.getMakerOfferIds(maker, 0, 10);
        assertEq(makerOfferIds.length, 1);
        Swap2p.OfferInfo[] memory makerOffers = swap.getMakerOffers(maker, 0, 10);
        assertEq(makerOffers.length, 1);
        assertEq(makerOffers[0].maker, maker);
        assertEq(makerOffers[0].offer.requirements, "KYC + selfie");

        // --- deal index checks ---
        // prepare second taker
        address taker2 = makeAddr("taker2");
        _setupTaker(taker2);

        // ensure maker offer has enough reserve
        vm.prank(maker);
        swap.maker_makeOffer(
            address(token),
            Swap2p.Side.SELL,
            Swap2p.FiatCode.wrap(840),
            101e18,
            5_000e18,
            50e18,
            2_000e18,
            Swap2p.MakerOfferTexts({
                paymentMethods: "wire",
                requirements: "KYC + selfie",
                comment: ""
            })
        );
        bytes32 activeOffer = _offerId(address(token), maker, Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840));

        // Deal 1: taker requests, flow completes to RELEASED
        bytes32 deal1 = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            200e18,
            Swap2p.FiatCode.wrap(840),
            101e18,
            "",
            address(0)
        );
        assertEq(swap.getOpenDealCount(maker), 1);
        assertEq(swap.getOpenDealCount(taker), 1);

        vm.prank(maker);
        swap.maker_acceptRequest(deal1, bytes(""));
        vm.prank(taker);
        swap.markFiatPaid(deal1, bytes(""));
        vm.prank(maker);
        swap.release(deal1, bytes(""));

        assertEq(swap.getOpenDealCount(maker), 0);
        assertEq(swap.getOpenDealCount(taker), 0);
        assertEq(swap.getRecentDealCount(maker), 1);
        assertEq(swap.getRecentDealCount(taker), 1);

        // Deal 2: taker2 requests and cancels, should move to recent
        bytes32 deal2 = _requestDealAs(
            taker2,
            address(token),
            Swap2p.Side.SELL,
            maker,
            150e18,
            Swap2p.FiatCode.wrap(840),
            101e18,
            "",
            address(0)
        );
        assertEq(swap.getOpenDealCount(maker), 1);
        assertEq(swap.getOpenDealCount(taker2), 1);

        vm.prank(taker2);
        swap.cancelRequest(deal2, bytes(""));

        assertEq(swap.getOpenDealCount(maker), 0);
        assertEq(swap.getOpenDealCount(taker2), 0);
        assertEq(swap.getRecentDealCount(maker), 2);

        // Deal 3: leave in REQUESTED state to verify open indexes
        bytes32 deal3 = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            120e18,
            Swap2p.FiatCode.wrap(840),
            101e18,
            "",
            address(0)
        );
        assertEq(swap.getOpenDealCount(maker), 1);
        assertEq(swap.getOpenDealCount(taker), 1);

        bytes32[] memory openMakerDeals = swap.getOpenDeals(maker, 0, 10);
        assertEq(openMakerDeals.length, 1);
        assertEq(openMakerDeals[0], deal3);

        Swap2p.DealInfo[] memory openDetailed = swap.getOpenDealsDetailed(maker, 0, 10);
        assertEq(openDetailed.length, 1);
        assertEq(openDetailed[0].id, deal3);
        assertEq(uint256(openDetailed[0].deal.state), uint256(Swap2p.DealState.REQUESTED));
        assertEq(openDetailed[0].deal.amount, 120e18);
        assertEq(openDetailed[0].deal.token, address(token));

        bytes32[] memory recentMakerDeals = swap.getRecentDeals(maker, 0, 10);
        assertEq(recentMakerDeals.length, 2);
        bool seenDeal1;
        bool seenDeal2;
        for (uint256 i; i < recentMakerDeals.length; i++) {
            if (recentMakerDeals[i] == deal1) seenDeal1 = true;
            if (recentMakerDeals[i] == deal2) seenDeal2 = true;
        }
        assertTrue(seenDeal1 && seenDeal2);

        Swap2p.DealInfo[] memory recentDetailed = swap.getRecentDealsDetailed(maker, 0, 10);
        assertEq(recentDetailed.length, 2);
        for (uint256 i; i < recentDetailed.length; i++) {
            assertTrue(recentDetailed[i].id == deal1 || recentDetailed[i].id == deal2);
            assertTrue(recentDetailed[i].deal.state != Swap2p.DealState.REQUESTED);
        }

        // ensure active offer still reflects reserve adjustments
        Swap2p.OfferInfo memory active = swap.getOfferById(activeOffer);
        uint256 expectedReserve = 5_000e18 - 200e18 - 150e18 - 120e18 + 150e18;
        assertEq(active.offer.reserve, expectedReserve);
    }
}
