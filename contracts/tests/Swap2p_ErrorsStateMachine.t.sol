// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";

contract Swap2p_ErrorsStateMachineTest is Swap2p_TestBase {
    function setUp() public override {
        super.setUp();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function _reqSell() internal returns (bytes32 dealId) {
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 10e18, 500e18, "wire", "", address(0));
        dealId = _requestDealDefault(
            address(token),
            Swap2p.Side.SELL,
            maker,
            10e18,
            Swap2p.FiatCode.wrap(840),
            100e18,
            "",
            address(0)
        );
    }

    function test_WrongState_AcceptTwice_ReleaseWrongStates() public {
        bytes32 dealId = _reqSell();
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes(""));
        vm.prank(maker);
        vm.expectRevert(Swap2p.WrongState.selector);
        swap.maker_acceptRequest(dealId, bytes(""));
        // release without paid
        vm.prank(maker);
        vm.expectRevert(Swap2p.WrongState.selector);
        swap.release(dealId, bytes(""));
    }

    function test_WrongCaller_CancelRequest_Release() public {
        bytes32 dealId = _reqSell();
        address stranger = makeAddr("xx");
        vm.prank(stranger);
        vm.expectRevert(Swap2p.WrongCaller.selector);
        swap.cancelRequest(dealId, bytes(""));
        // After paid, wrong party release
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes(""));
        vm.prank(taker);
        swap.markFiatPaid(dealId, bytes(""));
        vm.prank(taker);
        vm.expectRevert(Swap2p.WrongCaller.selector);
        swap.release(dealId, bytes(""));
    }

    function test_NotFiatPayer_SELL() public {
        bytes32 dealId = _reqSell();
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes(""));
        vm.prank(maker);
        vm.expectRevert(Swap2p.NotFiatPayer.selector);
        swap.markFiatPaid(dealId, bytes(""));
    }

    function test_WrongSide_CancelDeal() public {
        bytes32 dealId = _reqSell();
        vm.prank(maker);
        swap.maker_acceptRequest(dealId, bytes(""));
        // maker cannot cancel in SELL
        vm.prank(maker);
        vm.expectRevert(Swap2p.WrongSide.selector);
        swap.cancelDeal(dealId, bytes(""));
    }

    function test_OfferNotFound_AmountBounds() public {
        // OfferNotFound
        vm.prank(taker);
        vm.expectRevert(Swap2p.OfferNotFound.selector);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 10, Swap2p.FiatCode.wrap(840), 100, "", bytes(""), address(0));

        // create offer with price=100, min=10e18, max=11e18
        vm.prank(maker);
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 10e18, 11e18, "wire", "", address(0));
        // below min
        vm.prank(taker);
        vm.expectRevert(Swap2p.AmountOutOfBounds.selector);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 9e18, Swap2p.FiatCode.wrap(840), 100e18, "", bytes(""), address(0));
        // above max
        vm.prank(taker);
        vm.expectRevert(Swap2p.AmountOutOfBounds.selector);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 12e18, Swap2p.FiatCode.wrap(840), 100e18, "", bytes(""), address(0));
        // within bounds succeeds now that reserve tracking is removed
        vm.prank(taker);
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, 11e18, Swap2p.FiatCode.wrap(840), 100e18, "", bytes(""), address(0));
    }
}
