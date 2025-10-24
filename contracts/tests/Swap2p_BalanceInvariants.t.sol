// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_BalanceInvariantsTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function test_Invariant_Balances_OnRelease_SELL() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1, 500e18, "wire", "", address(0));
        uint128 amount = 100e18;
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            amount,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            "",
            address(0)
        );
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes(""));
        vm.prank(taker);
        swap.markFiatPaid(dealId, bytes(""));

        uint256 balBefore = token.balanceOf(address(swap));
        vm.prank(maker);
        swap.release(dealId, bytes(""));
        uint256 balAfter = token.balanceOf(address(swap));

        // В ACCEPTED контракт держит депозиты: 3x amount. В release он выплачивает payout (amount - fee),
        // возвращает оба депозита (2x amount) и также переводит fee автору/партнёру. Итоговый баланс контракта становится 0.
        assertEq(balBefore, 3 * uint256(amount));
        assertEq(balAfter, 0);
    }
}
