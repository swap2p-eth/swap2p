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
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1, 500e18, "wire", "");
        vm.prank(maker2);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1, 500e18, "wire", "");
        vm.prank(maker3);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1, 500e18, "wire", "");

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
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 10e18, 500e18, "wire", "");
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
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 0, 10e18, 500e18, "wire", "");
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
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 200e18, 2_000e18, 5e18, 600e18, "sepa", "id check");
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
}
