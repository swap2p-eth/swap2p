// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";
import {FeeOnTransferERC20} from "./mocks/FeeOnTransferERC20.sol";

contract Swap2p_NegativeAndEventsTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    // --- Fee-on-transfer rejections ---
    function test_Revert_FeeOnTransfer_OnRequest_SELL() public {
        FeeOnTransferERC20 ft = new FeeOnTransferERC20("Fee", "FEE");
        ft.mint(taker, 1e24);
        vm.startPrank(taker);
        ft.approve(address(swap), type(uint256).max);
        vm.stopPrank();

        vm.prank(maker);
        swap.maker_makeOffer(address(ft), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1e18, 500e18, "wire", "", address(0));

        vm.prank(taker);
        vm.expectRevert(Swap2p.FeeOnTransferTokenNotSupported.selector);
        swap.taker_requestOffer(address(ft), Swap2p.Side.SELL, maker, 100e18, Swap2p.FiatCode.wrap(840), 100e18, "", bytes(""), address(0));
    }

    function test_Revert_FeeOnTransfer_OnRequest_BUY() public {
        FeeOnTransferERC20 ft = new FeeOnTransferERC20("Fee", "FEE");
        ft.mint(taker, 1e24);
        vm.startPrank(taker);
        ft.approve(address(swap), type(uint256).max);
        vm.stopPrank();

        vm.prank(maker);
        swap.maker_makeOffer(address(ft), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1e18, 500e18, "sepa", "", address(0));

        vm.prank(taker);
        vm.expectRevert(Swap2p.FeeOnTransferTokenNotSupported.selector);
        swap.taker_requestOffer(address(ft), Swap2p.Side.BUY, maker, 100e18, Swap2p.FiatCode.wrap(978), 100e18, "", bytes(""), address(0));
    }

    // --- Price guards (WorsePrice) ---
    function test_Revert_WorsePrice_SELL_WhenOfferPriceHigherThanExpected() public {
        // Offer price = 100; expected = 99 -> revert
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100, 1, 500e18, "wire", "", address(0));
        vm.prank(taker);
        vm.expectRevert(Swap2p.WorsePrice.selector);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 10e18, Swap2p.FiatCode.wrap(840), 99, "", bytes(""), address(0));
    }

    function test_Revert_WorsePrice_BUY_WhenOfferPriceLowerThanExpected() public {
        // Offer price = 100; expected = 101 -> revert
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100, 1, 500e18, "sepa", "", address(0));
        vm.prank(taker);
        vm.expectRevert(Swap2p.WorsePrice.selector);
        swap.taker_requestOffer(address(token), Swap2p.Side.BUY, maker, 10e18, Swap2p.FiatCode.wrap(978), 101, "", bytes(""), address(0));
    }

    // Note: Event expectations via emit can break Hardhat coverage. We validate
    // events implicitly through state/balance assertions in other tests.
}
