// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_FlowSellTest is Swap2p_TestBase {
    function test_Flow_Sell_SuccessRelease_NoPartner() public {
        // maker sells tokens for fiat
        vm.prank(maker);
        swap.setOnline(true);

        // make offer SELL
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1e18, 500e18, "wire", "sell offer");

        // taker requests amount=100
        uint128 amount = 100e18;
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, amount, Swap2p.FiatCode.wrap(840), 100e18, "details", address(0));

        // accept (maker deposits 2x)
        vm.prank(maker);
        swap.maker_acceptRequest(1, bytes("ok"));

        // mark fiat paid (taker pays fiat in SELL)
        vm.prank(taker);
        swap.markFiatPaid(1, bytes("paid"));

        // capture balances before release
        uint256 makerBefore = token.balanceOf(maker);
        uint256 takerBefore = token.balanceOf(taker);
        uint256 authorBefore = token.balanceOf(author);

        // release (maker confirms fiat)
        vm.prank(maker);
        swap.release(1, bytes(""));

        // fee = 0.5%
        uint256 fee = (amount * 50) / 10_000;
        // taker receives payout (amount - fee) plus refund of their deposit (amount)
        assertEq(token.balanceOf(taker) - takerBefore, amount + (amount - fee), "taker delta before release should include payout and refund");
        // maker gets refund of 1x deposit
        assertEq(token.balanceOf(maker) - makerBefore, amount, "maker deposit refund 1x");
        // author gets full fee
        assertEq(token.balanceOf(author) - authorBefore, fee, "author gets fee");
    }
}
