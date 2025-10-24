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

    function _hasId(bytes32[] memory arr, bytes32 id) internal pure returns (bool) {
        for (uint i = 0; i < arr.length; i++) if (arr[i] == id) return true;
        return false;
    }

    function test_Recent_OnCancelRequest_BothSides() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 100e18, 1, 500e18, "wire", "", address(0));
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            10e18,
            _fiat("US"),
            100e18,
            "",
            "",
            address(0)
        );
        vm.prank(taker);
        swap.cancelRequest(dealId, bytes(""));
        assertEq(swap.getRecentDealCount(maker), 1);
        assertEq(swap.getRecentDealCount(taker), 1);
        bytes32[] memory rm = swap.getRecentDeals(maker, 0, 10);
        bytes32[] memory rt = swap.getRecentDeals(taker, 0, 10);
        assertTrue(_hasId(rm, dealId));
        assertTrue(_hasId(rt, dealId));
    }

    function test_Recent_OnCancelDeal_SellAndBuy() public {
        // SELL: taker cancels after accept
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 100e18, 1, 500e18, "wire", "", address(0));
        bytes32 sellDeal = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            5e18,
            _fiat("US"),
            100e18,
            "",
            "",
            address(0)
        );
        vm.prank(maker);
        swap.maker_acceptRequest(sellDeal, bytes(""));
        vm.prank(taker);
        swap.cancelDeal(sellDeal, bytes(""));
        assertEq(swap.getRecentDealCount(maker), 1);
        assertEq(swap.getRecentDealCount(taker), 1);

        // BUY: maker cancels after accept
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, _fiat("DE"), 100e18, 1, 500e18, "sepa", "", address(0));
        bytes32 buyDeal = _requestDealDefault(
            address(token),
            Swap2p.Side.BUY,
            maker,
            6e18,
            _fiat("DE"),
            100e18,
            "",
            "",
            address(0)
        );
        vm.prank(maker);
        swap.maker_acceptRequest(buyDeal, bytes(""));
        vm.prank(maker);
        swap.cancelDeal(buyDeal, bytes(""));
        assertEq(swap.getRecentDealCount(maker), 2);
        assertEq(swap.getRecentDealCount(taker), 2);
    }

    function test_Recent_OnRelease_BothSides() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 100e18, 1, 500e18, "wire", "", address(0));
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            7e18,
            _fiat("US"),
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
        assertEq(swap.getRecentDealCount(maker), 1);
        assertEq(swap.getRecentDealCount(taker), 1);
        bytes32[] memory rm = swap.getRecentDeals(maker, 0, 10);
        bytes32[] memory rt = swap.getRecentDeals(taker, 0, 10);
        assertTrue(_hasId(rm, dealId));
        assertTrue(_hasId(rt, dealId));
    }

    function test_Cleanup_RevertBelow48() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 100e18, 1, 500e18, "wire", "", address(0));
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            8e18,
            _fiat("US"),
            100e18,
            "",
            "",
            address(0)
        );
        vm.prank(taker);
        swap.cancelRequest(dealId, bytes(""));
        bytes32[] memory ids = new bytes32[](1);
        ids[0] = dealId;
        vm.expectRevert(Swap2p.WrongState.selector);
        swap.cleanupDeals(ids, 47);
    }

    function test_Cleanup_MixedStates() public {
        // A: canceled, old enough -> should be deleted
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 100e18, 1, 500e18, "wire", "", address(0));
        bytes32 dealA = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            9e18,
            _fiat("US"),
            100e18,
            "",
            "",
            address(0)
        );
        vm.prank(taker);
        swap.cancelRequest(dealA, bytes(""));
        vm.warp(block.timestamp + 49 hours);

        // B: released, but not old enough -> should stay
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 100e18, 1, 500e18, "wire", "", address(0));
        bytes32 dealB = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            10e18,
            _fiat("US"),
            100e18,
            "",
            "",
            address(0)
        );
        vm.prank(maker);
        swap.maker_acceptRequest(dealB, bytes(""));
        vm.prank(taker);
        swap.markFiatPaid(dealB, bytes(""));
        vm.prank(maker);
        swap.release(dealB, bytes(""));
        // make it younger than 48h by not warping further

        // C: accepted (wrong state) -> should be ignored
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 100e18, 1, 500e18, "wire", "", address(0));
        bytes32 dealC = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            11e18,
            _fiat("US"),
            100e18,
            "",
            "",
            address(0)
        );
        vm.prank(maker);
        swap.maker_acceptRequest(dealC, bytes(""));

        // cleanup with 48 hours
        bytes32[] memory ids = new bytes32[](3);
        ids[0] = dealA; ids[1] = dealB; ids[2] = dealC;
        swap.cleanupDeals(ids, 48);

        // A deleted
        vm.expectRevert(Swap2p.DealNotFound.selector);
        swap.getDeal(dealA);
        // B remains
        Swap2p.DealInfo memory infoB = swap.getDeal(dealB);
        assertTrue(infoB.deal.state == Swap2p.DealState.RELEASED);
        // C remains
        Swap2p.DealInfo memory infoC = swap.getDeal(dealC);
        assertTrue(infoC.deal.state == Swap2p.DealState.ACCEPTED);

        // A removed from recent for both
        bytes32[] memory rm = swap.getRecentDeals(maker, 0, 10);
        bytes32[] memory rt = swap.getRecentDeals(taker, 0, 10);
        assertTrue(!_hasId(rm, dealA));
        assertTrue(!_hasId(rt, dealA));
    }

    function test_Cleanup_SameMakerTaker() public {
        // maker == taker should never reach REQUESTED state
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 100e18, 0, 500e18, "wire", "", address(0));
        vm.prank(maker);
        vm.expectRevert(Swap2p.WrongCaller.selector);
        swap.taker_requestOffer(
            address(token),
            Swap2p.Side.SELL,
            maker,
            0,
            _fiat("US"),
            100e18,
            "",
            bytes(""),
            address(0)
        );
        assertEq(swap.getOpenDealCount(maker), 0);
        assertEq(swap.getRecentDealCount(maker), 0);
    }
}
