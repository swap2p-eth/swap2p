// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_FeesTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function test_Fees_NoPartner() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1e18, 500e18, "wire", "");
        uint128 amount = 300e18;
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, amount, Swap2p.FiatCode.wrap(840), 100e18, "", address(0));
        vm.prank(maker);
        swap.maker_acceptRequest(1, "ok");
        vm.prank(taker);
        swap.markFiatPaid(1, "paid");

        uint256 authorBefore = token.balanceOf(author);
        vm.prank(maker);
        swap.release(1);
        uint256 fee = (amount * 50) / 10_000;
        assertEq(token.balanceOf(author) - authorBefore, fee, "author gets fee when no partner");
    }

    function test_Fees_WithPartner() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1_000e18, 1e18, 500e18, "sepa", "");
        uint128 amount = 120e18;
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.BUY, maker, amount, Swap2p.FiatCode.wrap(978), 100e18, "", partner);
        vm.prank(maker);
        swap.maker_acceptRequest(1, "ok");
        vm.prank(maker);
        swap.markFiatPaid(1, "paid");

        uint256 authorBefore = token.balanceOf(author);
        uint256 partnerBefore = token.balanceOf(partner);
        vm.prank(taker);
        swap.release(1);
        uint256 fee = (amount * 50) / 10_000;
        uint256 share = (fee * 5000) / 10_000;
        assertEq(token.balanceOf(partner) - partnerBefore, share);
        assertEq(token.balanceOf(author) - authorBefore, fee - share);
    }
}
