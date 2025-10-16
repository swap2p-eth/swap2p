// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Swap2p} from "../Swap2p.sol";
import {MintableERC20} from "./mocks/MintableERC20.sol";

contract Swap2p_TestBase is Test {
    Swap2p internal swap;
    MintableERC20 internal token;

    address internal maker;
    address internal taker;
    address internal partner;
    address internal author; // fee receiver (deployer)

    function setUp() public virtual {
        maker = makeAddr("maker");
        taker = makeAddr("taker");
        partner = makeAddr("partner");
        author = address(this);

        swap = new Swap2p();
        token = new MintableERC20("Mock", "MCK");

        // Mint balances
        token.mint(maker, 1e24);
        token.mint(taker, 1e24);

        // Approvals
        vm.startPrank(maker);
        token.approve(address(swap), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(taker);
        token.approve(address(swap), type(uint256).max);
        vm.stopPrank();
    }

    function _nextDealId(address taker_) internal view returns (bytes32) {
        (bytes32 id, ) = swap.previewNextDealId(taker_);
        return id;
    }

    function _nextOfferId(address maker_) internal view returns (bytes32) {
        (bytes32 id, ) = swap.previewNextOfferId(maker_);
        return id;
    }

    function _offerId(
        address token_,
        address maker_,
        Swap2p.Side side_,
        Swap2p.FiatCode fiat_
    ) internal view returns (bytes32) {
        return swap.getOfferId(token_, maker_, side_, fiat_);
    }

    function _requestDealAs(
        address taker_,
        address token_,
        Swap2p.Side side_,
        address maker_,
        uint128 amount_,
        Swap2p.FiatCode fiat_,
        uint96 expectedPrice_,
        string memory details_,
        address partner_
    ) internal returns (bytes32 id) {
        (id, ) = swap.previewNextDealId(taker_);
        vm.prank(taker_);
        swap.taker_requestOffer(token_, side_, maker_, amount_, fiat_, expectedPrice_, details_, partner_);
    }

    function _requestDealDefault(
        address token_,
        Swap2p.Side side_,
        address maker_,
        uint128 amount_,
        Swap2p.FiatCode fiat_,
        uint96 expectedPrice_,
        string memory details_,
        address partner_
    ) internal returns (bytes32 id) {
        return _requestDealAs(taker, token_, side_, maker_, amount_, fiat_, expectedPrice_, details_, partner_);
    }
}
