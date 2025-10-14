// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_RecentAndCleanupTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function _hasId(uint96[] memory arr, uint96 id) internal pure returns (bool) {
        for (uint i = 0; i < arr.length; i++) if (arr[i] == id) return true;
        return false;
    }

    function test_Recent_OnCancelRequest_BothSides() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1, 500e18, "wire", "");
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 10e18, Swap2p.FiatCode.wrap(840), 100e18, "", address(0));
        vm.prank(taker);
        swap.cancelRequest(1, bytes(""));
        assertEq(swap.getRecentDealCount(maker), 1);
        assertEq(swap.getRecentDealCount(taker), 1);
        uint96[] memory rm = swap.getRecentDeals(maker, 0, 10);
        uint96[] memory rt = swap.getRecentDeals(taker, 0, 10);
        assertTrue(_hasId(rm, 1));
        assertTrue(_hasId(rt, 1));
    }

    function test_Recent_OnCancelDeal_SellAndBuy() public {
        // SELL: taker cancels after accept
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1, 500e18, "wire", "");
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 5e18, Swap2p.FiatCode.wrap(840), 100e18, "", address(0));
        vm.prank(maker);
        swap.maker_acceptRequest(1, bytes(""));
        vm.prank(taker);
        swap.cancelDeal(1, bytes(""));
        assertEq(swap.getRecentDealCount(maker), 1);
        assertEq(swap.getRecentDealCount(taker), 1);

        // BUY: maker cancels after accept
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1_000e18, 1, 500e18, "sepa", "");
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.BUY, maker, 6e18, Swap2p.FiatCode.wrap(978), 100e18, "", address(0));
        vm.prank(maker);
        swap.maker_acceptRequest(2, bytes(""));
        vm.prank(maker);
        swap.cancelDeal(2, bytes(""));
        assertEq(swap.getRecentDealCount(maker), 2);
        assertEq(swap.getRecentDealCount(taker), 2);
    }

    function test_Recent_OnRelease_BothSides() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1, 500e18, "wire", "");
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 7e18, Swap2p.FiatCode.wrap(840), 100e18, "", address(0));
        vm.prank(maker);
        swap.maker_acceptRequest(1, bytes(""));
        vm.prank(taker);
        swap.markFiatPaid(1, bytes(""));
        vm.prank(maker);
        swap.release(1, bytes(""));
        assertEq(swap.getRecentDealCount(maker), 1);
        assertEq(swap.getRecentDealCount(taker), 1);
        uint96[] memory rm = swap.getRecentDeals(maker, 0, 10);
        uint96[] memory rt = swap.getRecentDeals(taker, 0, 10);
        assertTrue(_hasId(rm, 1));
        assertTrue(_hasId(rt, 1));
    }

    function test_Cleanup_RevertBelow48() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1, 500e18, "wire", "");
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 8e18, Swap2p.FiatCode.wrap(840), 100e18, "", address(0));
        vm.prank(taker);
        swap.cancelRequest(1, bytes(""));
        uint96[] memory ids = new uint96[](1);
        ids[0] = 1;
        vm.expectRevert(Swap2p.WrongState.selector);
        swap.cleanupDeals(ids, 47);
    }

    function test_Cleanup_MixedAndMakerEqTaker() public {
        // A: canceled, old enough -> should be deleted
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1, 500e18, "wire", "");
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 9e18, Swap2p.FiatCode.wrap(840), 100e18, "", address(0));
        vm.prank(taker);
        swap.cancelRequest(1, bytes(""));
        vm.warp(block.timestamp + 49 hours);

        // B: released, but not old enough -> should stay
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1, 500e18, "wire", "");
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 10e18, Swap2p.FiatCode.wrap(840), 100e18, "", address(0));
        vm.prank(maker);
        swap.maker_acceptRequest(2, bytes(""));
        vm.prank(taker);
        swap.markFiatPaid(2, bytes(""));
        vm.prank(maker);
        swap.release(2, bytes(""));
        // make it younger than 48h by not warping further

        // C: accepted (wrong state) -> should be ignored
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1, 500e18, "wire", "");
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 11e18, Swap2p.FiatCode.wrap(840), 100e18, "", address(0));
        vm.prank(maker);
        swap.maker_acceptRequest(3, bytes(""));

        // cleanup with 48 hours
        uint96[] memory ids = new uint96[](3);
        ids[0] = 1; ids[1] = 2; ids[2] = 3;
        swap.cleanupDeals(ids, 48);

        // A deleted
        (,,Swap2p.DealState stA,,,,,,,) = swap.deals(1);
        assertEq(uint(stA), uint(Swap2p.DealState.NONE));
        // B remains
        (,,Swap2p.DealState stB,,,,,,,) = swap.deals(2);
        assertTrue(stB == Swap2p.DealState.RELEASED);
        // C remains
        (,,Swap2p.DealState stC,,,,,,,) = swap.deals(3);
        assertTrue(stC == Swap2p.DealState.ACCEPTED);

        // A removed from recent for both
        uint96[] memory rm = swap.getRecentDeals(maker, 0, 10);
        uint96[] memory rt = swap.getRecentDeals(taker, 0, 10);
        assertTrue(!_hasId(rm, 1));
        assertTrue(!_hasId(rt, 1));
    }

    function test_Cleanup_SameMakerTaker() public {
        // maker == taker
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 0, 500e18, "wire", "");
        vm.prank(maker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 0, Swap2p.FiatCode.wrap(840), 100e18, "", address(0));
        vm.prank(maker);
        swap.cancelRequest(1, bytes(""));
        vm.warp(block.timestamp + 49 hours);
        uint96[] memory ids = new uint96[](1);
        ids[0] = 1;
        swap.cleanupDeals(ids, 48);
        // recent cleared and deal deleted
        assertEq(swap.getRecentDealCount(maker), 0);
        // off >= len branch returns empty
        uint96[] memory emptySlice = swap.getRecentDeals(maker, 5, 10);
        assertEq(emptySlice.length, 0);
        (,,Swap2p.DealState st,,,,,,,) = swap.deals(1);
        assertEq(uint(st), uint(Swap2p.DealState.NONE));
    }
}
