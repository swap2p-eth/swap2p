// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import {Swap2p} from "../../Swap2p.sol";
import {MintableERC20} from "../mocks/MintableERC20.sol";

contract ActorProxy {
    Swap2p public immutable swap;
    MintableERC20 public immutable token;

    constructor(Swap2p _swap, MintableERC20 _token) {
        swap = _swap;
        token = _token;
        _token.approve(address(_swap), type(uint256).max);
    }

    function makerMakeOffer(
        address tokenAddr,
        Swap2p.Side side,
        Swap2p.FiatCode fiat,
        uint96 price,
        uint128 minAmt,
        uint128 maxAmt
    ) external {
        swap.maker_makeOffer(tokenAddr, side, fiat, price, minAmt, maxAmt, "echidna", "", address(0));
    }

    function makerDeleteOffer(
        address tokenAddr,
        Swap2p.Side side,
        Swap2p.FiatCode fiat
    ) external {
        swap.maker_deleteOffer(tokenAddr, side, fiat);
    }

    function setOnline(bool on) external {
        swap.setOnline(on);
    }

    function takerRequestOffer(
        address tokenAddr,
        Swap2p.Side side,
        address maker_,
        uint128 amount,
        Swap2p.FiatCode fiat,
        uint96 expectedPrice
    ) external {
        swap.taker_requestOffer(tokenAddr, side, maker_, amount, fiat, expectedPrice, "", bytes(""), address(0));
    }

    function makerAcceptRequest(bytes32 id) external {
        swap.maker_acceptRequest(id, bytes(""));
    }

    function cancelRequest(bytes32 id) external {
        swap.cancelRequest(id, bytes(""));
    }

    function cancelDeal(bytes32 id) external {
        swap.cancelDeal(id, bytes(""));
    }

    function markFiatPaid(bytes32 id) external {
        swap.markFiatPaid(id, bytes(""));
    }

    function releaseDeal(bytes32 id) external {
        swap.release(id, bytes(""));
    }
}

contract Swap2pEchidnaHarness {
    struct Market {
        address tokenAddr;
        Swap2p.Side side;
        Swap2p.FiatCode fiat;
    }

    Swap2p public immutable swap;
    MintableERC20 public immutable token;

    ActorProxy[] public actors;
    Market[] public markets;

    uint256 private constant MAX_TRACKED = 64;
    bytes32[] private _trackedDeals;
    mapping(bytes32 => bool) private _dealTracked;
    uint256 private _dealCursor;

    function _fiat(string memory code) private pure returns (Swap2p.FiatCode) {
        bytes memory raw = bytes(code);
        require(raw.length == 2, "iso2");
        uint16 packed = (uint16(uint8(raw[0])) << 8) | uint16(uint8(raw[1]));
        return Swap2p.FiatCode.wrap(packed);
    }

    constructor() {
        swap = new Swap2p(address(this));
        token = new MintableERC20("MockToken", "MCK");

        markets.push(Market({tokenAddr: address(token), side: Swap2p.Side.SELL, fiat: _fiat("US")}));
        markets.push(Market({tokenAddr: address(token), side: Swap2p.Side.BUY, fiat: _fiat("DE")}));
        markets.push(Market({tokenAddr: address(token), side: Swap2p.Side.SELL, fiat: _fiat("GB")}));

        for (uint256 i; i < 3; i++) {
            ActorProxy proxy = new ActorProxy(swap, token);
            actors.push(proxy);
            token.mint(address(proxy), 1e27);
            proxy.setOnline(true);
        }
    }

    // ────────────────────────────────── helpers ──────────────────────────────────
    function _actor(uint8 idx) internal view returns (ActorProxy proxy) {
        proxy = actors[idx % actors.length];
    }

    function _market(uint8 idx) internal view returns (Market storage market) {
        market = markets[idx % markets.length];
    }

    function _topUp(ActorProxy proxy, uint256 minBalance) internal {
        uint256 bal = token.balanceOf(address(proxy));
        if (bal < minBalance) {
            token.mint(address(proxy), minBalance - bal + 1e24);
        }
    }

    function _trackDeal(bytes32 id) internal {
        if (_dealTracked[id]) return;
        _dealTracked[id] = true;
        if (_trackedDeals.length < MAX_TRACKED) {
            _trackedDeals.push(id);
        } else {
            bytes32 replaced = _trackedDeals[_dealCursor % MAX_TRACKED];
            _dealTracked[replaced] = false;
            _trackedDeals[_dealCursor % MAX_TRACKED] = id;
            _dealCursor++;
        }
    }

    function _contains(bytes32[] memory arr, bytes32 id) internal pure returns (bool) {
        for (uint256 i; i < arr.length; i++) {
            if (arr[i] == id) return true;
        }
        return false;
    }

    function _actorAddresses() internal view returns (address[] memory list) {
        list = new address[](actors.length);
        for (uint256 i; i < actors.length; i++) {
            list[i] = address(actors[i]);
        }
    }

    function _marketOfferIds(
        address tokenAddr,
        Swap2p.Side side,
        Swap2p.FiatCode fiat,
        uint256 off,
        uint256 lim
    ) internal view returns (bytes32[] memory ids) {
        Swap2p.OfferInfo[] memory infos = swap.getMarketOffers(tokenAddr, side, fiat, off, lim);
        ids = new bytes32[](infos.length);
        for (uint256 i; i < infos.length; i++) {
            ids[i] = infos[i].id;
        }
    }

    function _marketOfferMakers(
        address tokenAddr,
        Swap2p.Side side,
        Swap2p.FiatCode fiat,
        uint256 off,
        uint256 lim
    ) internal view returns (address[] memory makers) {
        Swap2p.OfferInfo[] memory infos = swap.getMarketOffers(tokenAddr, side, fiat, off, lim);
        makers = new address[](infos.length);
        for (uint256 i; i < infos.length; i++) {
            makers[i] = infos[i].maker;
        }
    }

    function _recentDealIds(address user, uint256 off, uint256 lim) internal view returns (bytes32[] memory ids) {
        Swap2p.DealInfo[] memory infos = swap.getRecentDealsDetailed(user, off, lim);
        ids = new bytes32[](infos.length);
        for (uint256 i; i < infos.length; i++) {
            ids[i] = infos[i].id;
        }
    }

    function _getDeal(bytes32 id) internal view returns (Swap2p.Deal memory d) {
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

    function _getOffer(bytes32 id) internal view returns (Swap2p.Offer memory o) {
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

    // ─────────────────────────── stateful entry points ───────────────────────────

    function actionMakeOffer(
        uint8 actorIdx,
        uint8 marketIdx,
        uint96 price,
        uint128 minAmt,
        uint128 maxAmt
    ) external {
        ActorProxy proxy = _actor(actorIdx);
        Market storage m = _market(marketIdx);

        if (minAmt == 0) minAmt = 1;
        if (maxAmt == 0) maxAmt = minAmt;
        if (maxAmt < minAmt) maxAmt = minAmt;
        if (maxAmt > uint128(type(uint96).max)) maxAmt = uint128(type(uint96).max);
        if (minAmt > maxAmt) minAmt = maxAmt;
        price = uint96(uint256(price) % 1_000_000_000_000 + 1);

        _topUp(proxy, uint256(maxAmt) * 5);
        proxy.setOnline(true);
        proxy.makerMakeOffer(m.tokenAddr, m.side, m.fiat, price, minAmt, maxAmt);
    }

    function actionDeleteOffer(uint8 actorIdx, uint8 marketIdx) external {
        ActorProxy proxy = _actor(actorIdx);
        Market storage m = _market(marketIdx);
        proxy.makerDeleteOffer(m.tokenAddr, m.side, m.fiat);
    }

    function actionRequest(
        uint8 takerIdx,
        uint8 makerIdx,
        uint8 marketIdx,
        uint128 amount
    ) external {
        ActorProxy taker = _actor(takerIdx);
        ActorProxy maker = _actor(makerIdx);
        if (address(taker) == address(maker)) return;
        Market storage m = _market(marketIdx);

        bytes32 offerId = swap.getOfferId(m.tokenAddr, address(maker), m.side, m.fiat);
        if (offerId == bytes32(0)) return;
        Swap2p.Offer memory info = _getOffer(offerId);
        if (info.ts == 0) return;
        uint128 amt = amount;
        if (amt < info.minAmt || amt > info.maxAmt) {
            amt = info.minAmt;
        }
        _topUp(taker, uint256(amt) * 5);
        (bytes32 predicted,) = swap.previewNextDealId(address(taker));
        taker.takerRequestOffer(m.tokenAddr, info.side, address(maker), amt, m.fiat, info.priceFiatPerToken);
        _trackDeal(predicted);
    }

    function actionAccept(uint8 makerIdx) external {
        ActorProxy maker = _actor(makerIdx);
        bytes32[] memory open = swap.getOpenDeals(address(maker), 0, 10);
        if (open.length == 0) return;
        bytes32 id = open[0];
        Swap2p.Deal memory d = _getDeal(id);
        if (d.state != Swap2p.DealState.REQUESTED) return;
        _topUp(maker, uint256(d.amount) * 5);
        maker.makerAcceptRequest(id);
    }

    function actionCancel(uint8 actorIdx) external {
        ActorProxy actor = _actor(actorIdx);
        bytes32[] memory open = swap.getOpenDeals(address(actor), 0, 10);
        if (open.length == 0) return;
        bytes32 id = open[0];
        Swap2p.Deal memory d = _getDeal(id);
        if (d.state == Swap2p.DealState.REQUESTED) {
            actor.cancelRequest(id);
        } else if (d.state == Swap2p.DealState.ACCEPTED) {
            actor.cancelDeal(id);
        }
    }

    function actionMarkPaid(uint8 actorIdx) external {
        ActorProxy actor = _actor(actorIdx);
        bytes32[] memory open = swap.getOpenDeals(address(actor), 0, 10);
        for (uint256 i; i < open.length; i++) {
            Swap2p.Deal memory d = _getDeal(open[i]);
            if (d.state != Swap2p.DealState.ACCEPTED) continue;
            if (d.side == Swap2p.Side.SELL && d.taker == address(actor)) {
                actor.markFiatPaid(open[i]);
                return;
            }
            if (d.side == Swap2p.Side.BUY && d.maker == address(actor)) {
                actor.markFiatPaid(open[i]);
                return;
            }
        }
    }

    function actionRelease(uint8 actorIdx) external {
        ActorProxy actor = _actor(actorIdx);
        bytes32[] memory open = swap.getOpenDeals(address(actor), 0, 10);
        for (uint256 i; i < open.length; i++) {
            Swap2p.Deal memory d = _getDeal(open[i]);
            if (d.state != Swap2p.DealState.PAID) continue;
            if (d.side == Swap2p.Side.SELL && d.maker == address(actor)) {
                actor.releaseDeal(open[i]);
                return;
            }
            if (d.side == Swap2p.Side.BUY && d.taker == address(actor)) {
                actor.releaseDeal(open[i]);
                return;
            }
        }
    }

    // ─────────────────────────────── invariants ───────────────────────────────

    function echidna_market_index_consistency() external view returns (bool) {
        address[] memory actorAddrs = _actorAddresses();
        for (uint256 i; i < markets.length; i++) {
            Market storage m = markets[i];
            uint256 count = swap.getOfferCount(m.tokenAddr, m.side, m.fiat);
            bytes32[] memory ids = _marketOfferIds(m.tokenAddr, m.side, m.fiat, 0, count + 1);
            if (ids.length != count) return false;
            Swap2p.OfferInfo[] memory infos = swap.getMarketOffers(m.tokenAddr, m.side, m.fiat, 0, count + 1);
            if (infos.length != count) return false;
            for (uint256 j; j < infos.length; j++) {
                bool seenId = false;
                for (uint256 k; k < ids.length; k++) {
                    if (ids[k] == infos[j].id) {
                        seenId = true;
                        break;
                    }
                }
                if (!seenId) return false;
            }
            address[] memory makers = _marketOfferMakers(m.tokenAddr, m.side, m.fiat, 0, count + 1);
            if (makers.length != count) return false;
            for (uint256 j; j < makers.length; j++) {
                bool knownMaker = false;
                for (uint256 k; k < actorAddrs.length; k++) {
                    if (makers[j] == actorAddrs[k]) {
                        knownMaker = true;
                        break;
                    }
                }
                if (!knownMaker) return false;
            }
        }
        return true;
    }

    function echidna_maker_offer_consistency() external view returns (bool) {
        for (uint256 i; i < actors.length; i++) {
            address makerAddr = address(actors[i]);
            uint256 count = swap.getMakerOfferCount(makerAddr);
            bytes32[] memory ids = swap.getMakerOfferIds(makerAddr, 0, count + 1);
            if (ids.length != count) return false;
            Swap2p.OfferInfo[] memory offers = swap.getMakerOffers(makerAddr, 0, count + 1);
            if (offers.length != count) return false;
            for (uint256 j; j < offers.length; j++) {
                if (offers[j].maker != makerAddr) return false;
                bool found;
                for (uint256 k; k < ids.length; k++) {
                    if (ids[k] == offers[j].id) {
                        found = true;
                        break;
                    }
                }
                if (!found) return false;
            }
        }
        return true;
    }

    function echidna_deal_index_consistency() external view returns (bool) {
        address[] memory actorAddrs = _actorAddresses();
        for (uint256 i; i < actorAddrs.length; i++) {
            address user = actorAddrs[i];
            uint256 openCount = swap.getOpenDealCount(user);
            bytes32[] memory openIds = swap.getOpenDeals(user, 0, openCount + 5);
            if (openIds.length != openCount) return false;
            Swap2p.DealInfo[] memory openDetailed = swap.getOpenDealsDetailed(user, 0, openCount + 5);
            if (openDetailed.length != openCount) return false;
            for (uint256 j; j < openDetailed.length; j++) {
                if (
                    openDetailed[j].deal.state != Swap2p.DealState.REQUESTED &&
                    openDetailed[j].deal.state != Swap2p.DealState.ACCEPTED &&
                    openDetailed[j].deal.state != Swap2p.DealState.PAID
                ) return false;
                if (!_contains(openIds, openDetailed[j].id)) return false;
            }

            uint256 recentCount = swap.getRecentDealCount(user);
            bytes32[] memory recentIds = _recentDealIds(user, 0, recentCount + 5);
            if (recentIds.length != recentCount) return false;
            Swap2p.DealInfo[] memory recentDetailed = swap.getRecentDealsDetailed(user, 0, recentCount + 5);
            if (recentDetailed.length != recentCount) return false;
            for (uint256 j; j < recentDetailed.length; j++) {
                if (
                    recentDetailed[j].deal.state != Swap2p.DealState.RELEASED &&
                    recentDetailed[j].deal.state != Swap2p.DealState.CANCELED
                ) return false;
                if (!_contains(recentIds, recentDetailed[j].id)) return false;
            }
        }
        for (uint256 i; i < _trackedDeals.length; i++) {
            bytes32 id = _trackedDeals[i];
            Swap2p.Deal memory d = _getDeal(id);
            if (d.state == Swap2p.DealState.NONE) continue;
            bool makerOpen = _contains(swap.getOpenDeals(d.maker, 0, 10), id);
            bool makerRecent = _contains(_recentDealIds(d.maker, 0, 10), id);
            bool takerOpen = _contains(swap.getOpenDeals(d.taker, 0, 10), id);
            bool takerRecent = _contains(_recentDealIds(d.taker, 0, 10), id);
            if (
                d.state == Swap2p.DealState.REQUESTED ||
                d.state == Swap2p.DealState.ACCEPTED ||
                d.state == Swap2p.DealState.PAID
            ) {
                if (!makerOpen || !takerOpen) return false;
                if (makerRecent || takerRecent) return false;
            } else {
                if (!makerRecent || !takerRecent) return false;
                if (makerOpen || takerOpen) return false;
            }
        }
        return true;
    }
}
