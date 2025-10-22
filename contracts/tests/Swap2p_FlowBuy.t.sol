// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_FlowBuyTest is Swap2p_TestBase {
    function test_Flow_Buy_SuccessRelease_WithPartner() public {
        // maker buys tokens for fiat
        vm.prank(maker);
        swap.setOnline(true);

        // make offer BUY
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1_000e18, 1e18, 500e18, Swap2p.MakerOfferTexts({
            paymentMethods: "sepa",
            requirements: "",
            comment: "buy offer"
        }));

        // taker binds partner on first request
        uint128 amount = 200e18;
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.BUY,
            maker,
            amount,
            Swap2p.FiatCode.wrap(978),
            100e18,
            "sepa",
            "details",
            partner
        );

        // accept (maker deposits 1x)
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes("ok"));

        // mark fiat paid (maker pays fiat in BUY)
        vm.prank(maker);
        swap.markFiatPaid(dealId, bytes("paid"));

        // capture balances before release
        uint256 makerBefore = token.balanceOf(maker);
        uint256 takerBefore = token.balanceOf(taker);
        uint256 authorBefore = token.balanceOf(author);
        uint256 partnerBefore = token.balanceOf(partner);

        // release (taker confirms receipt of fiat)
        vm.prank(taker);
        swap.release(dealId, bytes(""));

        // fee = 0.5%, taker share = 20% of fee
        uint256 fee = (amount * 50) / 10_000;
        uint256 share = (fee * 2000) / 10_000;

        // maker (buyer) receives payout (amount - fee) plus refund of their deposit (amount)
        assertEq(token.balanceOf(maker) - makerBefore, amount + (amount - fee), "maker delta includes payout and refund");
        // taker deposit refunded 1x
        assertEq(token.balanceOf(taker) - takerBefore, amount, "taker deposit refund 1x");
        assertEq(token.balanceOf(partner) - partnerBefore, share, "partner share");
        assertEq(token.balanceOf(author) - authorBefore, fee - share, "author share");
    }
}
