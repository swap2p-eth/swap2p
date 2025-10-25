// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_PaginationTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function test_OfferKeys_Pagination() public {
        // single key
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 0, 1, 500e18, "wire", "", address(0));
        assertEq(swap.getOfferCount(address(token), Swap2p.Side.SELL, _fiat("US")), 1);
        Swap2p.OfferInfo[] memory page0 = swap.getMarketOffers(address(token), Swap2p.Side.SELL, _fiat("US"), 0, 1);
        assertEq(page0.length, 1);
        Swap2p.OfferInfo[] memory page1 = swap.getMarketOffers(address(token), Swap2p.Side.SELL, _fiat("US"), 1, 1);
        assertEq(page1.length, 0);
    }

    function test_OpenDeals_Pagination() public {
        // create two deals
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 100e18, 1, 500e18, "wire", "", address(0));
        bytes32 d1 = _requestDealDefault(
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
        bytes32 d2 = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            20e18,
            _fiat("US"),
            100e18,
            "",
            "",
            address(0)
        );

        assertEq(swap.getOpenDealCount(maker), 2);
        bytes32[] memory a = swap.getOpenDeals(maker, 0, 1);
        assertEq(a.length, 1);
        bytes32[] memory b = swap.getOpenDeals(maker, 1, 2);
        assertEq(b.length, 1);

        // cancel both, check cleaned lists
        vm.prank(taker);
        swap.cancelRequest(d1, bytes(""));
        vm.prank(taker);
        swap.cancelRequest(d2, bytes(""));

        assertEq(swap.getOpenDealCount(maker), 0);
        assertEq(swap.getOpenDealCount(taker), 0);
    }
}
