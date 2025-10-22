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

    struct Market {
        address token;
        Swap2p.Side side;
        Swap2p.FiatCode fiat;
    }

    bytes32[] private _trackedDeals;
    mapping(bytes32 => bool) private _dealSeen;

    function _getDeal(bytes32 id) private view returns (Swap2p.Deal memory d) {
        try swap.getDeal(id) returns (Swap2p.DealInfo memory info) {
            return info.deal;
        } catch {
            return Swap2p.Deal({
                amount: 0,
                price: 0,
                state: Swap2p.DealState.NONE,
                side: Swap2p.Side.BUY,
                maker: address(0),
                taker: address(0),
                fiat: Swap2p.FiatCode.wrap(0),
                tsRequest: 0,
                tsLast: 0,
                token: address(0),
                paymentMethod: "",
                chat: new Swap2p.ChatMessage[](0)
            });
        }
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

    function _trackDeal(bytes32 id) private {
        if (!_dealSeen[id]) {
            _dealSeen[id] = true;
            _trackedDeals.push(id);
        }
    }

    function _contains(bytes32[] memory arr, bytes32 id) private pure returns (bool) {
        for (uint256 i; i < arr.length; i++) {
            if (arr[i] == id) return true;
        }
        return false;
    }

    function _contains(bytes32[] memory arr, bytes32 id, uint256 limit) private pure returns (bool) {
        uint256 stop = arr.length < limit ? arr.length : limit;
        for (uint256 i; i < stop; i++) {
            if (arr[i] == id) return true;
        }
        return false;
    }

    function _assertMarketInvariant(
        Market memory market,
        address[] memory makerAccounts
    ) private view {
        uint256 count = swap.getOfferCount(market.token, market.side, market.fiat);
        bytes32[] memory ids = swap.getMarketOfferIds(market.token, market.side, market.fiat, 0, count + 1);
        Swap2p.OfferInfo[] memory infos = swap.getMarketOffers(market.token, market.side, market.fiat, 0, count + 1);
        assertEq(ids.length, count);
        assertEq(infos.length, count);
        for (uint256 i; i < infos.length; i++) {
            bool idMatches = false;
            for (uint256 j; j < ids.length; j++) {
                if (ids[j] == infos[i].id) {
                    idMatches = true;
                    break;
                }
            }
            assertTrue(idMatches);
            assertEq(uint8(infos[i].offer.side), uint8(market.side));
            assertEq(Swap2p.FiatCode.unwrap(infos[i].offer.fiat), Swap2p.FiatCode.unwrap(market.fiat));
            // timestamp non-zero indicates active offer
            assertTrue(infos[i].offer.ts != 0);
        }

        // ensure getOfferKeys matches maker lists
        address[] memory keys = swap.getOfferKeys(market.token, market.side, market.fiat, 0, count + 1);
        assertEq(keys.length, count);
        for (uint256 i; i < keys.length; i++) {
            bool isKnownMaker;
            for (uint256 j; j < makerAccounts.length; j++) {
                if (keys[i] == makerAccounts[j]) {
                    isKnownMaker = true;
                    break;
                }
            }
            assertTrue(isKnownMaker);
        }
    }

    function _assertMakerInvariant(address makerAccount) private view {
        uint256 count = swap.getMakerOfferCount(makerAccount);
        bytes32[] memory ids = swap.getMakerOfferIds(makerAccount, 0, count + 1);
        Swap2p.OfferInfo[] memory offers = swap.getMakerOffers(makerAccount, 0, count + 1);
        assertEq(ids.length, count);
        assertEq(offers.length, count);
        for (uint256 i; i < offers.length; i++) {
            assertEq(offers[i].maker, makerAccount);
            bool containsId = false;
            for (uint256 j; j < ids.length; j++) {
                if (ids[j] == offers[i].id) {
                    containsId = true;
                    break;
                }
            }
            assertTrue(containsId);
        }
    }

    function _assertUserDealsInvariant(address user) private view {
        uint256 openCount = swap.getOpenDealCount(user);
        bytes32[] memory openIds = swap.getOpenDeals(user, 0, openCount + 5);
        Swap2p.DealInfo[] memory openDetailed = swap.getOpenDealsDetailed(user, 0, openCount + 5);
        assertEq(openIds.length, openCount);
        assertEq(openDetailed.length, openCount);
        for (uint256 i; i < openDetailed.length; i++) {
            Swap2p.DealInfo memory info = openDetailed[i];
            assertTrue(info.deal.state == Swap2p.DealState.REQUESTED ||
                info.deal.state == Swap2p.DealState.ACCEPTED ||
                info.deal.state == Swap2p.DealState.PAID);
            assertTrue(_contains(openIds, info.id));
        }

        uint256 recentCount = swap.getRecentDealCount(user);
        bytes32[] memory recentIds = swap.getRecentDeals(user, 0, recentCount + 5);
        Swap2p.DealInfo[] memory recentDetailed = swap.getRecentDealsDetailed(user, 0, recentCount + 5);
        assertEq(recentIds.length, recentCount);
        assertEq(recentDetailed.length, recentCount);
        for (uint256 i; i < recentDetailed.length; i++) {
            Swap2p.DealInfo memory info = recentDetailed[i];
            assertTrue(info.deal.state == Swap2p.DealState.RELEASED ||
                info.deal.state == Swap2p.DealState.CANCELED);
            assertTrue(_contains(recentIds, info.id));
        }
    }

    function _assertDealMembership(bytes32 id) private view {
        Swap2p.Deal memory d = _getDeal(id);
        if (d.state == Swap2p.DealState.NONE) {
            return;
        }
        bytes32[] memory makerOpen = swap.getOpenDeals(d.maker, 0, 20);
        bytes32[] memory makerRecent = swap.getRecentDeals(d.maker, 0, 20);
        bytes32[] memory takerOpen = swap.getOpenDeals(d.taker, 0, 20);
        bytes32[] memory takerRecent = swap.getRecentDeals(d.taker, 0, 20);

        bool makerHasOpen = _contains(makerOpen, id);
        bool makerHasRecent = _contains(makerRecent, id);
        bool takerHasOpen = _contains(takerOpen, id);
        bool takerHasRecent = _contains(takerRecent, id);

        if (d.state == Swap2p.DealState.REQUESTED ||
            d.state == Swap2p.DealState.ACCEPTED ||
            d.state == Swap2p.DealState.PAID) {
            assertTrue(makerHasOpen);
            assertTrue(takerHasOpen);
            assertFalse(makerHasRecent);
            assertFalse(takerHasRecent);
        } else if (d.state == Swap2p.DealState.RELEASED ||
            d.state == Swap2p.DealState.CANCELED) {
            assertFalse(makerHasOpen);
            assertFalse(takerHasOpen);
            assertTrue(makerHasRecent);
            assertTrue(takerHasRecent);
        }
    }

    function _assertAllInvariants(
        Market[] memory markets,
        address[] memory makerAccounts,
        address[] memory takerAccounts
    ) private view {
        for (uint256 i; i < markets.length; i++) {
            _assertMarketInvariant(markets[i], makerAccounts);
        }
        for (uint256 i; i < makerAccounts.length; i++) {
            _assertMakerInvariant(makerAccounts[i]);
            _assertUserDealsInvariant(makerAccounts[i]);
        }
        for (uint256 i; i < takerAccounts.length; i++) {
            _assertUserDealsInvariant(takerAccounts[i]);
        }
        for (uint256 i; i < _trackedDeals.length; i++) {
            _assertDealMembership(_trackedDeals[i]);
        }
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
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 50e18, Swap2p.FiatCode.wrap(840), 100e18, "", bytes(""), address(0));
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
        bytes32[] memory usdIds = swap.getMarketOfferIds(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 10);
        assertEq(usdIds.length, 2);
        Swap2p.OfferInfo[] memory usdInfos = swap.getMarketOffers(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 10);
        assertEq(usdInfos.length, 2);
        for (uint256 i; i < usdInfos.length; i++) {
            assertEq(uint8(usdInfos[i].offer.side), uint8(Swap2p.Side.SELL));
            assertEq(Swap2p.FiatCode.unwrap(usdInfos[i].offer.fiat), Swap2p.FiatCode.unwrap(Swap2p.FiatCode.wrap(840)));
            assertTrue(usdInfos[i].maker == maker || usdInfos[i].maker == makerB);
        }

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
        usdIds = swap.getMarketOfferIds(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 10);
        assertEq(usdIds.length, 1);
        assertEq(swap.getMarketOffers(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 10)[0].maker, maker);

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
            "",
            address(0)
        );
        _trackDeal(deal1);
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
            "",
            address(0)
        );
        _trackDeal(deal2);
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
            "",
            address(0)
        );
        _trackDeal(deal3);
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
        Swap2p.DealInfo[] memory openDetailedTaker = swap.getOpenDealsDetailed(taker, 0, 10);
        assertEq(openDetailedTaker.length, 1);
        assertEq(openDetailedTaker[0].id, deal3);

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
        Swap2p.DealInfo[] memory recentDetailedTaker = swap.getRecentDealsDetailed(taker, 0, 10);
        assertEq(recentDetailedTaker.length, 1);
        assertEq(recentDetailedTaker[0].id, deal1);
        Swap2p.DealInfo[] memory recentDetailedTaker2 = swap.getRecentDealsDetailed(taker2, 0, 10);
        assertEq(recentDetailedTaker2.length, 1);
        assertEq(recentDetailedTaker2[0].id, deal2);

        // ensure active offer still reflects reserve adjustments
        Swap2p.OfferInfo memory active = swap.getOfferById(activeOffer);
        uint256 expectedReserve = 5_000e18 - 200e18 - 150e18 - 120e18 + 150e18;
        assertEq(active.offer.reserve, expectedReserve);
    }

    function test_Churn_Invariants() public {
        address maker2 = makeAddr("maker2");
        address maker3 = makeAddr("maker3");
        address taker2 = makeAddr("taker2");

        _setupMaker(maker2);
        _setupMaker(maker3);
        _setupTaker(taker2);

        address[] memory makersList = new address[](3);
        makersList[0] = maker;
        makersList[1] = maker2;
        makersList[2] = maker3;

        address[] memory takersList = new address[](2);
        takersList[0] = taker;
        takersList[1] = taker2;

        Market[] memory marketsList = new Market[](3);
        marketsList[0] = Market({token: address(token), side: Swap2p.Side.SELL, fiat: Swap2p.FiatCode.wrap(840)});
        marketsList[1] = Market({token: address(token), side: Swap2p.Side.BUY, fiat: Swap2p.FiatCode.wrap(978)});
        marketsList[2] = Market({token: address(token), side: Swap2p.Side.SELL, fiat: Swap2p.FiatCode.wrap(826)});

        // bootstrap offers for each maker/market combination
        for (uint256 i; i < makersList.length; i++) {
            for (uint256 j; j < marketsList.length; j++) {
                address currentMaker = makersList[i];
                Market memory mkt = marketsList[j];
                Swap2p.MakerOfferTexts memory initTexts = Swap2p.MakerOfferTexts({
                    paymentMethods: "init",
                    requirements: "",
                    comment: ""
                });
                vm.prank(currentMaker);
                swap.maker_makeOffer(
                    mkt.token,
                    mkt.side,
                    mkt.fiat,
                    uint96(100e18 + i * 5e18 + j * 3e18),
                    uint96(4_000e18 + j * 500e18),
                    uint128(20e18),
                    uint128(2_000e18),
                    initTexts
                );
            }
        }

        _assertAllInvariants(marketsList, makersList, takersList);

        uint256 amount = 120e18;
        for (uint256 iter; iter < 40; iter++) {
            Market memory market = marketsList[iter % marketsList.length];
            address currentMaker = makersList[iter % makersList.length];
            address currentTaker = takersList[(iter + 1) % takersList.length];
            uint256 scenario = iter % 6;

            if (scenario == 0) {
                Swap2p.MakerOfferTexts memory updateTexts = Swap2p.MakerOfferTexts({
                    paymentMethods: "update",
                    requirements: iter % 2 == 0 ? "kyc" : "",
                    comment: ""
                });
                vm.prank(currentMaker);
                swap.maker_makeOffer(
                    market.token,
                    market.side,
                    market.fiat,
                    uint96(90e18 + iter * 1e18),
                    uint96(5_000e18 + iter * 100e18),
                    uint128(10e18),
                    uint128(2_500e18),
                    updateTexts
                );
            } else if (scenario == 1) {
                bytes32 offerId = swap.getOfferId(market.token, currentMaker, market.side, market.fiat);
                if (offerId != bytes32(0)) {
                    Swap2p.OfferInfo memory info = swap.getOfferById(offerId);
                    if (info.offer.reserve >= amount) {
                        bytes32 dealId = _requestDealAs(
                            currentTaker,
                            market.token,
                            market.side,
                            currentMaker,
                            uint128(amount),
                            market.fiat,
                            uint96(info.offer.priceFiatPerToken),
                            "",
                            "",
                            address(0)
                        );
                        _trackDeal(dealId);
                    }
                }
            } else if (scenario == 2) {
                bytes32[] memory makerOpen = swap.getOpenDeals(currentMaker, 0, 10);
                if (makerOpen.length != 0) {
                bytes32 id = makerOpen[0];
                Swap2p.Deal memory d = _getDeal(id);
                    if (d.state == Swap2p.DealState.REQUESTED) {
                        vm.prank(d.maker);
                        swap.maker_acceptRequest(id, bytes(""));
                        d = _getDeal(id);
                    }
                    if (d.state == Swap2p.DealState.ACCEPTED) {
                        if (d.side == Swap2p.Side.SELL) {
                            vm.prank(d.taker);
                            swap.markFiatPaid(id, bytes(""));
                            d = _getDeal(id);
                            vm.prank(d.maker);
                            swap.release(id, bytes(""));
                        } else {
                            vm.prank(d.maker);
                            swap.markFiatPaid(id, bytes(""));
                            d = _getDeal(id);
                            vm.prank(d.taker);
                            swap.release(id, bytes(""));
                        }
                    }
                }
            } else if (scenario == 3) {
                bytes32[] memory takerOpen = swap.getOpenDeals(currentTaker, 0, 10);
                if (takerOpen.length != 0) {
                    bytes32 id = takerOpen[0];
                    Swap2p.Deal memory d = _getDeal(id);
                    if (d.state == Swap2p.DealState.REQUESTED) {
                        vm.prank(d.taker);
                        swap.cancelRequest(id, bytes(""));
                    } else if (d.state == Swap2p.DealState.ACCEPTED) {
                        if (d.side == Swap2p.Side.SELL) {
                            vm.prank(d.taker);
                            swap.cancelDeal(id, bytes(""));
                        } else {
                            vm.prank(d.maker);
                            swap.cancelDeal(id, bytes(""));
                        }
                    }
                }
            } else if (scenario == 4) {
                bytes32 offerId = swap.getOfferId(market.token, currentMaker, market.side, market.fiat);
                if (offerId != bytes32(0)) {
                    vm.prank(currentMaker);
                    swap.maker_deleteOffer(market.token, market.side, market.fiat);
                }
            } else if (scenario == 5) {
                vm.warp(block.timestamp + 50 hours);
                uint256 count;
                bytes32[] memory candidates = new bytes32[]( _trackedDeals.length);
                for (uint256 k; k < _trackedDeals.length; k++) {
                    Swap2p.Deal memory d = _getDeal(_trackedDeals[k]);
                    if (d.state == Swap2p.DealState.RELEASED || d.state == Swap2p.DealState.CANCELED) {
                        candidates[count++] = _trackedDeals[k];
                    }
                }
                if (count != 0) {
                    bytes32[] memory cleanup = new bytes32[](count);
                    for (uint256 k; k < count; k++) {
                        cleanup[k] = candidates[k];
                    }
                    vm.prank(maker);
                    swap.cleanupDeals(cleanup, 48);
                }
            }

            vm.warp(block.timestamp + 1 hours);
            _assertAllInvariants(marketsList, makersList, takersList);
        }
    }
}
