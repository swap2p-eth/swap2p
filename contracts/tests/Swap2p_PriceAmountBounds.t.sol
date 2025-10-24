// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_PriceAmountBoundsTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function test_PriceEqualityAllowed() public {
        // SELL: offer price == expected OK
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 100, 1, 500e18, "wire", "", address(0));
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 10e18, _fiat("US"), 100, "", bytes(""), address(0));

        // BUY: offer price == expected OK
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, _fiat("DE"), 100, 1, 500e18, "sepa", "", address(0));
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.BUY, maker, 10e18, _fiat("DE"), 100, "", bytes(""), address(0));
    }

    function test_AmountBoundsMinMax() public {
        // min==10, max==20
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, _fiat("US"), 100e18, 10e18, 20e18, "wire", "", address(0));
        // exactly min
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 10e18, _fiat("US"), 100e18, "", bytes(""), address(0));
        // exactly max
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 20e18, _fiat("US"), 100e18, "", bytes(""), address(0));

        // below min
        vm.prank(taker);
        vm.expectRevert(Swap2p.AmountOutOfBounds.selector);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 9e18, _fiat("US"), 100e18, "", bytes(""), address(0));
        // above max
        vm.prank(taker);
        vm.expectRevert(Swap2p.AmountOutOfBounds.selector);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 21e18, _fiat("US"), 100e18, "", bytes(""), address(0));
    }
}
