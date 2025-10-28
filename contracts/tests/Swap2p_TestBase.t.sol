// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Swap2p} from "../Swap2p.sol";
import {Swap2pViewHarness} from "./mocks/Swap2pViewHarness.sol";
import {MintableERC20} from "./mocks/MintableERC20.sol";

contract Swap2p_TestBase is Test {
    Swap2pViewHarness internal swap;
    MintableERC20 internal token;

    address internal maker;
    address internal taker;
    address internal partner;
    address internal author; // fee receiver

    function setUp() public virtual {
        maker = makeAddr("maker");
        taker = makeAddr("taker");
        partner = makeAddr("partner");
        author = address(this);

        swap = new Swap2pViewHarness(author);
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

    function _makerProfile(address addr)
        internal
        view
        returns (Swap2p.MakerProfile memory)
    {
        address[] memory addrs = new address[](1);
        addrs[0] = addr;
        Swap2p.MakerProfile[] memory profiles = swap.getMakerProfiles(addrs);
        if (profiles.length != 0) return profiles[0];
        Swap2p.MakerProfile memory empty;
        return empty;
    }

    function _offerId(
        address token_,
        address maker_,
        Swap2p.Side side_,
        Swap2p.FiatCode fiat_
    ) internal view returns (bytes32) {
        return swap.getOfferId(token_, maker_, side_, fiat_);
    }

    function _offer(bytes32 id) internal view returns (Swap2p.Offer memory o) {
        (
            uint128 minAmt,
            uint128 maxAmt,
            uint96 price,
            uint40 ts,
            Swap2p.FiatCode fiat,
            Swap2p.Side side,
            address token_,
            address maker_,
            string memory paymentMethods,
            string memory requirements
        ) = swap.offers(id);
        o.minAmt = minAmt;
        o.maxAmt = maxAmt;
        o.priceFiatPerToken = price;
        o.ts = ts;
        o.fiat = fiat;
        o.side = side;
        o.token = token_;
        o.maker = maker_;
        o.paymentMethods = paymentMethods;
        o.requirements = requirements;
    }

    function _deal(bytes32 id) internal view returns (Swap2p.Deal memory d) {
        (
            uint128 amount,
            uint96 price,
            Swap2p.FiatCode fiat,
            Swap2p.DealState state,
            Swap2p.Side side,
            uint40 tsRequest,
            uint40 tsLast,
            address maker_,
            address taker_,
            address token_,
            string memory paymentMethod
        ) = swap.deals(id);
        d.amount = amount;
        d.price = price;
        d.fiat = fiat;
        d.state = state;
        d.side = side;
        d.tsRequest = tsRequest;
        d.tsLast = tsLast;
        d.maker = maker_;
        d.taker = taker_;
        d.token = token_;
        d.paymentMethod = paymentMethod;
        d.chat = new Swap2p.ChatMessage[](0);
    }

    /// @dev helper to pack ISO 3166-1 alpha-2 country codes into FiatCode
    function _fiat(string memory code) internal pure returns (Swap2p.FiatCode) {
        bytes memory raw = bytes(code);
        require(raw.length == 2, "fiat code must be 2 chars");
        uint16 packed = (uint16(uint8(raw[0])) << 8) | uint16(uint8(raw[1]));
        return Swap2p.FiatCode.wrap(packed);
    }

    function _requestDealAs(
        address taker_,
        address token_,
        Swap2p.Side side_,
        address maker_,
        uint128 amount_,
        Swap2p.FiatCode fiat_,
        uint96 expectedPrice_,
        string memory paymentMethod_,
        string memory details_,
        address partner_
    ) internal returns (bytes32 id) {
        (id, ) = swap.previewNextDealId(taker_);
        vm.prank(taker_);
        swap.taker_requestOffer(
            token_,
            side_,
            maker_,
            amount_,
            fiat_,
            expectedPrice_,
            paymentMethod_,
            bytes(details_),
            partner_
        );
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
        return _requestDealAs(taker_, token_, side_, maker_, amount_, fiat_, expectedPrice_, "", details_, partner_);
    }

    function _requestDealDefault(
        address token_,
        Swap2p.Side side_,
        address maker_,
        uint128 amount_,
        Swap2p.FiatCode fiat_,
        uint96 expectedPrice_,
        string memory paymentMethod_,
        string memory details_,
        address partner_
    ) internal returns (bytes32 id) {
        return _requestDealAs(
            taker,
            token_,
            side_,
            maker_,
            amount_,
            fiat_,
            expectedPrice_,
            paymentMethod_,
            details_,
            partner_
        );
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
        return _requestDealDefault(token_, side_, maker_, amount_, fiat_, expectedPrice_, "", details_, partner_);
    }
}
