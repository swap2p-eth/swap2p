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

}
