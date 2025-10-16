// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_AccessTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function test_Revert_WrongCaller_CancelRequest() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1e18, 500e18, "wire", "");
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            10e18,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            address(0)
        );
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert();
        swap.cancelRequest(dealId, bytes(""));
    }

    function test_Revert_NotFiatPayer() public {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1_000e18, 1e18, 500e18, "sepa", "");
        bytes32 dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.BUY,
            maker,
            10e18,
            Swap2p.FiatCode.wrap(978),
            100e18,
            "",
            address(0)
        );
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes("ok"));
        // taker cannot mark paid in BUY
        vm.prank(taker);
        vm.expectRevert(Swap2p.NotFiatPayer.selector);
        swap.markFiatPaid(dealId, bytes(""));
    }
}
