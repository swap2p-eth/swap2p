// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.23;

import {IERC20}    from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Swap2pERC20 – ERC20-to-fiat P2P Market with Double-Collateral Escrow
/// @notice A non‑custodial P2P marketplace for exchanging ERC20 tokens for off‑chain fiat using a double‑collateral model.
/// @dev
/// Overview
/// - Roles: maker (publishes offers) and taker (requests/executes offers).
/// - Double‑collateral: both parties escrow tokens on‑chain, aligning incentives for honest fiat settlement off‑chain.
/// - No admin/owner: protocol economics are encoded; fees are distributed automatically.
///
/// Core flow
/// 1) Maker publishes an offer (token, side BUY/SELL, price, amount bounds, ISO country code).
/// 2) Taker requests: deposit is pulled (BUY: 2×amount, SELL: 1×amount).
/// 3) Maker accepts: maker deposit is pulled (BUY: 1×amount, SELL: 2×amount). State → ACCEPTED.
/// 4) Fiat payer calls markFiatPaid (BUY: maker; SELL: taker). State → PAID.
/// 5) Counterparty calls release: main payout (amount minus fee) is paid, and both deposits (1× each) are refunded. State → RELEASED.
///
/// Fees & Affiliates
/// - Protocol fee `FEE_BPS` (default 0.5%) is deducted from the main payout.
/// - Affiliate share is split: taker partner receives `TAKER_AFF_SHARE_BP` (20%) and maker partner receives
///   `MAKER_AFF_SHARE_BP` (30%); remainder goes to `author`.
///
/// States & Permissions
/// - REQUESTED: created by taker_requestOffer; cancellable by maker or taker; chat allowed.
/// - ACCEPTED: after maker_acceptRequest; cancellable by one side (BUY: maker; SELL: taker); chat allowed.
/// - PAID: after markFiatPaid by the fiat payer; release is performed by the counterparty; chat allowed.
/// - RELEASED/CANCELED: terminal. Deal id is moved from the open index to the recent index (for both maker and taker).
///
/// Recent
/// - Recent lists show closed deals (RELEASED/CANCELED) for each party.
///
/// Security
/// - ReentrancyGuard protects functions that transfer tokens.
/// - Fee‑on‑transfer tokens are rejected using a balance delta check in `_pull`.
/// - Explicit access checks (WrongCaller) are used for clarity instead of modifiers.
///
/// Notes
/// - Pagination helpers copy slices from storage into memory (gas‑aware, intended for off‑chain calls).
contract Swap2p is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ────────────────────────────────────────────────────────────────────────
    // Constants and types
    uint32 private constant FEE_BPS              = 50;    // 0.50%
    uint32 private constant TAKER_AFF_SHARE_BP   = 2000;  // 20% of protocol fee goes to taker affiliate
    uint32 private constant MAKER_AFF_SHARE_BP   = 3000;  // 30% of protocol fee goes to maker affiliate
    /// @dev ISO 3166-1 alpha-2 country code (packed as uint16, e.g. "US")
    type   FiatCode is uint16;

    enum Side { BUY, SELL }
    enum DealState { NONE, REQUESTED, ACCEPTED, PAID, RELEASED, CANCELED }

    // ────────────────────────────────────────────────────────────────────────
    // Data structures

    /// @notice Maker’s public offer parameters.
    struct Offer {
        uint128  minAmt;
        uint128  maxAmt;
        uint96   priceFiatPerToken;   // fiat/token price ratio, 6 decimals
        uint40   ts;                  // last update timestamp
        FiatCode fiat;                // ISO 3166-1 alpha-2 country code
        Side     side;
        address  token;               // ERC20 token address
        address  maker;
        string   paymentMethods;      // supported fiat payment systems/banks
        string   requirements;        // taker requirements text
    }

    /// @notice Offer details returned from view helpers.
    struct OfferInfo {
        bytes32 id;
        address maker;
        Offer   offer;
        bool    online;
    }

    struct ChatMessage {
        uint40    ts;
        DealState state;
        bool      toMaker;
        bytes     text;
    }

    /// @notice Active deal between maker and taker.
    struct Deal {
        uint128   amount;
        uint96    price;  // 6 decimals
        FiatCode  fiat;
        DealState state;
        Side      side;
        uint40    tsRequest;          // timestamp when requested
        uint40    tsLast;             // last state update
        address   maker;
        address   taker;
        address   token;
        string    paymentMethod;
        ChatMessage[] chat;
    }

    struct DealInfo {
        bytes32 id;
        Deal    deal;
    }

    /// @notice Maker's online status and working hours (UTC).
    struct MakerProfile {
        int32  dealsCancelled;        // self-canceled deals count
        int32  dealsCompleted;        // completed deals count
        bool    online;
        bytes32 nickname;              // unique public nickname (bytes32, padded/trimmed off-chain)
        bytes32 chatPublicKey;         // public key used for end-to-end chat (bytes32)
    }

    // ────────────────────────────────────────────────────────────────────────
    // Immutable params
    address private immutable author; // protocol fee receiver

    // offers by id
    mapping(bytes32 => Offer) public offers;
    mapping(bytes32 => Deal) public deals;

    // offer ids and indexes
    mapping(address => uint64) private _makerOfferNonce;
    mapping(address => mapping(address => mapping(Side => mapping(FiatCode => bytes32)))) private _offerId;

    // deal ids
    mapping(address => uint64) private _takerDealNonce;

    // user → affiliate partner
    mapping(address => address) public affiliates;

    // maker profiles
    mapping(address => MakerProfile) public makerInfo;
    mapping(bytes32 => bool) public nicknameTaken;

    // offer indexes
    mapping(bytes32 => bytes32[]) private _marketOffers;
    mapping(bytes32 => mapping(bytes32 => uint)) private _marketOfferPos; // +1
    mapping(address => bytes32[]) internal _makerOffers;
    mapping(address => mapping(bytes32 => uint)) private _makerOfferPos; // +1

    // open deals
    mapping(address => bytes32[]) internal _openDeals;
    mapping(address => mapping(bytes32 => uint)) private _openPos; // +1

    // recent closed deals (RELEASED or CANCELED)
    mapping(address => bytes32[]) private _recentDeals;
    mapping(address => mapping(bytes32 => uint)) private _recentPos; // +1

    // ────────────────────────────────────────────────────────────────────────
    // Errors
    error WrongCaller();
    error WrongState();
    error WrongSide();
    error OfferNotFound();
    error AmountOutOfBounds();
    error InsufficientDeposit();
    error NotFiatPayer();
    error MakerOffline();
    error WorsePrice();
    error FeeOnTransferTokenNotSupported();
    error AuthorZero();
    error NicknameTaken();
    error DealNotFound();

    // ────────────────────────────────────────────────────────────────────────
    // Events
    event OfferUpsert(bytes32 indexed id, address indexed maker);
    event OfferDeleted(bytes32 indexed id, address indexed maker);

    event DealUpdated(bytes32 indexed id, DealState state, address indexed maker, address indexed taker);

    event Chat(bytes32 indexed id, address indexed from, address indexed to, uint32 index);

    event MakerOnline(address indexed maker, bool online);

    // ────────────────────────────────────────────────────────────────────────
    /// @notice Initializes fee receiver (`author`).
    /// @param author_ Address that receives protocol fees.
    constructor(address author_) {
        if (author_ == address(0)) revert AuthorZero();
        author = author_;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Modifiers

    // Non-reentrancy is provided by OpenZeppelin ReentrancyGuard

    // ────────────────────────────────────────────────────────────────────────
    // Offer index helpers
    function _marketKey(address token, Side s, FiatCode f) private pure returns (bytes32) {
        return keccak256(abi.encode(token, s, FiatCode.unwrap(f)));
    }

    /// @dev Returns existing offer id or creates a new one for the maker/token/side/fiat tuple.
    function _getOrCreateOfferId(address token, address maker, Side s, FiatCode f) private returns (bytes32 oid) {
        oid = _offerId[token][maker][s][f];
        if (oid == bytes32(0)) {
            uint64 next = ++_makerOfferNonce[maker];
            oid = keccak256(abi.encodePacked(maker, next));
            _offerId[token][maker][s][f] = oid;
        }
    }

    /// @dev Adds offer id into market index if absent.
    function _addMarketOffer(bytes32 marketKey, bytes32 id) private {
        mapping(bytes32 => uint) storage posMap = _marketOfferPos[marketKey];
        if (posMap[id] != 0) return;
        posMap[id] = _marketOffers[marketKey].length + 1;
        _marketOffers[marketKey].push(id);
    }

    /// @dev Swap-and-pop removal for indexed arrays.
    function _removeIndexed(bytes32[] storage arr, mapping(bytes32 => uint) storage posMap, bytes32 id) private {
        uint pos = posMap[id];
        if (pos == 0) return;
        uint idx = pos - 1;
        uint last = arr.length - 1;
        if (idx != last) {
            bytes32 lastId = arr[last];
            arr[idx] = lastId;
            posMap[lastId] = pos;
        }
        arr.pop();
        delete posMap[id];
    }

    /// @dev Removes offer id from market index if present.
    function _removeMarketOffer(bytes32 marketKey, bytes32 id) private {
        mapping(bytes32 => uint) storage posMap = _marketOfferPos[marketKey];
        _removeIndexed(_marketOffers[marketKey], posMap, id);
    }

    /// @dev Adds offer id into maker index if absent.
    function _addMakerOffer(address maker, bytes32 id) private {
        if (_makerOfferPos[maker][id] != 0) return;
        _makerOfferPos[maker][id] = _makerOffers[maker].length + 1;
        _makerOffers[maker].push(id);
    }

    /// @dev Removes offer id from maker index if present.
    function _removeMakerOffer(address maker, bytes32 id) private {
        _removeIndexed(_makerOffers[maker], _makerOfferPos[maker], id);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Open-deal helpers
    /// @dev Adds a deal into user's open list.
    function _addOpen(address u, bytes32 id) private {
        _openPos[u][id] = _openDeals[u].length + 1;
        _openDeals[u].push(id);
    }
    /// @dev Removes a deal from user's open list if present.
    function _removeOpen(address u, bytes32 id) private {
        _removeIndexed(_openDeals[u], _openPos[u], id);
    }
    /// @dev Removes a deal from both maker and taker open lists.
    function _closeBoth(address m, address t, bytes32 id) private {
        _removeOpen(m, id);
        _removeOpen(t, id);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Recent-deal helpers
    /// @dev Adds a deal into user's recent (closed) list.
    function _addRecent(address u, bytes32 id) private {
        if (_recentPos[u][id] == 0) {
            _recentPos[u][id] = _recentDeals[u].length + 1;
            _recentDeals[u].push(id);
        }
    }
    /// @dev Removes a deal from user's recent (closed) list if present.
    function _removeRecent(address u, bytes32 id) private {
        _removeIndexed(_recentDeals[u], _recentPos[u], id);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Token transfer helpers
    /// @dev Pulls `amt` tokens from `from` and rejects fee-on-transfer tokens.
    function _pull(address token, address from, uint128 amt) internal {
        if (amt == 0) return;
        uint256 beforeBal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(from, address(this), amt);
        uint256 afterBal = IERC20(token).balanceOf(address(this));
        if (afterBal - beforeBal != amt) revert FeeOnTransferTokenNotSupported();
    }

    /// @dev Pushes `amt` tokens to `to`.
    function _push(address token, address to, uint128 amt) internal {
        if (amt == 0) return;
        IERC20(token).safeTransfer(to, amt);
    }

    function _payAffiliate(address token, address partner, uint128 fee, uint32 shareBp) private returns (uint128 paid) {
        if (partner == address(0) || fee == 0 || shareBp == 0) return 0;
        paid = uint128((uint256(fee) * shareBp) / 10_000);
        if (paid != 0) {
            _push(token, partner, paid);
        }
    }

    /// @dev Pays `amt` to `to`, charges protocol fee and splits affiliate share between taker/maker partners.
    function _payWithFee(
        address token,
        address taker,
        address maker,
        address to,
        uint128 amt
    ) internal {
        uint128 fee = uint128((uint256(amt) * FEE_BPS) / 10_000);
        _push(token, to, amt - fee);

        uint128 remaining = fee;

        uint128 takerShare = _payAffiliate(token, affiliates[taker], fee, TAKER_AFF_SHARE_BP);
        if (takerShare != 0) remaining -= takerShare;

        uint128 makerShare = _payAffiliate(token, affiliates[maker], fee, MAKER_AFF_SHARE_BP);
        if (makerShare != 0) remaining -= makerShare;

        if (remaining != 0) {
            _push(token, author, remaining);
        }
    }

    function _setAffiliateIfNotSet(address user, address partner) private {
        if (partner != address(0) && partner != user && affiliates[user] == address(0)) {
            affiliates[user] = partner;
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Maker profile
    /// @notice Sets caller's online status for availability checks.
    /// @param on New online flag.
    function setOnline(bool on) external {
        makerInfo[msg.sender].online = on;
        emit MakerOnline(msg.sender, on);
    }

    /// @notice Updates caller's public nickname. Zero clears nickname.
    /// @param nick Nickname to set (must be unique when non-zero).
    function setNickname(bytes32 nick) external {
        MakerProfile storage profile = makerInfo[msg.sender];
        bytes32 old = profile.nickname;

        if (nick == bytes32(0)) {
            if (old != bytes32(0)) {
                delete nicknameTaken[old];
                profile.nickname = bytes32(0);
            }
            return;
        }

        if (old == nick) return;
        if (nicknameTaken[nick]) revert NicknameTaken();

        nicknameTaken[nick] = true;
        profile.nickname = nick;

        if (old != bytes32(0)) {
            delete nicknameTaken[old];
        }
    }

    /// @notice Sets caller's chat public key. Zero clears the key.
    /// @param key New chat public key (bytes32).
    function setChatPublicKey(bytes32 key) external {
        makerInfo[msg.sender].chatPublicKey = key;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Offer management
    /// @notice Creates/updates an offer for the caller (maker).
    /// @param token ERC20 token address.
    /// @param s Side (BUY/SELL).
    /// @param f ISO 3166-1 alpha-2 country code (uint16).
    /// @param price Fiat per token price (unit is UI-defined) - 6 decimals.
    /// @param minAmt Minimum per-request amount.
    /// @param maxAmt Maximum per-request amount.
    /// @param paymentMethods Supported fiat payment methods.
    /// @param requirements Optional requirements text for takers.
    function maker_makeOffer(
        address  token,
        Side     s,
        FiatCode f,
        uint96   price,
        uint128  minAmt,
        uint128  maxAmt,
        string calldata paymentMethods,
        string calldata requirements,
        address  partner
    ) external {
        _makerMakeOffer(token, s, f, price, minAmt, maxAmt, paymentMethods, requirements);
        _setAffiliateIfNotSet(msg.sender, partner);
    }

    function _makerMakeOffer(
        address token,
        Side s,
        FiatCode f,
        uint96 price,
        uint128 minAmt,
        uint128 maxAmt,
        string calldata paymentMethods,
        string calldata requirements
    ) private {
        bytes32 oid = _getOrCreateOfferId(token, msg.sender, s, f);

        Offer storage o = offers[oid];
        bool isNew = o.ts == 0;

        if (isNew) {
            o.fiat = f;
            o.side = s;
            o.token = token;
            o.maker = msg.sender;
        }

        if (minAmt != 0) {
            o.minAmt = minAmt;
        }
        if (maxAmt != 0) {
            o.maxAmt = maxAmt;
        }
        if (price != 0) {
            o.priceFiatPerToken = price;
        }
        if (bytes(paymentMethods).length != 0) {
            o.paymentMethods = paymentMethods;
        }
        if (bytes(requirements).length != 0) {
            o.requirements = requirements;
        }

        o.ts = uint40(block.timestamp);

        bytes32 marketKey = _marketKey(token, s, f);
        if (isNew) {
            _addMarketOffer(marketKey, oid);
            _addMakerOffer(msg.sender, oid);
        }

        emit OfferUpsert(oid, msg.sender);
    }

    /// @notice Deletes caller's offer for (token, side, fiat).
    function maker_deleteOffer(address token, Side s, FiatCode f) external {
        bytes32 oid = _offerId[token][msg.sender][s][f];
        if (oid != bytes32(0)) {
            Offer storage off = offers[oid];
            if (off.ts != 0) {
                bytes32 marketKey = _marketKey(token, s, f);
                _removeMarketOffer(marketKey, oid);
                _removeMakerOffer(msg.sender, oid);
                delete offers[oid];
            }
            delete _offerId[token][msg.sender][s][f];
        }
        emit OfferDeleted(oid, msg.sender);
    }




    // ────────────────────────────────────────────────────────────────────────
    // Request (taker)
    function _allocateDeal(
        address token,
        Side s,
        address maker,
        address taker,
        uint128 amount,
        FiatCode f,
        uint96 expectedPrice,
        string calldata paymentMethod
    ) private returns (bytes32 id) {
        bytes32 oid = _offerId[token][maker][s][f];
        Offer storage off = offers[oid];
        if (off.maker != maker) revert OfferNotFound();

        if (!makerInfo[maker].online) revert MakerOffline();

        if (s == Side.BUY) {
            if (off.priceFiatPerToken < expectedPrice) revert WorsePrice();
        } else {
            if (off.priceFiatPerToken > expectedPrice) revert WorsePrice();
        }

        if (amount < off.minAmt || amount > off.maxAmt) revert AmountOutOfBounds();
        uint128 need = s == Side.BUY ? amount * 2 : amount;
        _pull(token, taker, need);

        uint64 nextNonce = ++_takerDealNonce[taker];
        id = keccak256(abi.encodePacked(taker, nextNonce));

        Deal storage d = deals[id];
        uint40 ts = uint40(block.timestamp);
        d.amount        = amount;
        d.price         = off.priceFiatPerToken;
        d.state         = DealState.REQUESTED;
        d.side          = s;
        d.maker         = maker;
        d.taker         = taker;
        d.fiat          = f;
        d.tsRequest     = ts;
        d.tsLast        = ts;
        d.token         = token;
        d.paymentMethod = paymentMethod;
    }

    /// @notice Requests an offer and escrows taker deposit (BUY: 2×, SELL: 1×).
    /// @param token ERC20 token address.
    /// @param s Side.
    /// @param maker Maker address.
    /// @param amount Trade amount.
    /// @param f Fiat code.
    /// @param expectedPrice Price guard (BUY: offer >= expected; SELL: offer <= expected).
    /// @param paymentMethod Negotiated fiat method chosen by taker.
    /// @param paymentDetails Free-form details stored in chat alongside the DealUpdated event.
    /// @param partner Optional affiliate to bind (first non-zero value wins).
    function taker_requestOffer(
        address  token,
        Side     s,
        address  maker,
        uint128  amount,
        FiatCode f,
        uint96   expectedPrice,
        string calldata paymentMethod,
        bytes calldata paymentDetails,
        address  partner
    ) external nonReentrant {
        address taker = msg.sender;
        if (taker == maker) revert WrongCaller();
        bytes32 id = _allocateDeal(token, s, maker, taker, amount, f, expectedPrice, paymentMethod);

        _addOpen(maker, id);
        _addOpen(taker, id);

        _setAffiliateIfNotSet(taker, partner);

        Deal storage d = deals[id];
        _sendChat(id, paymentDetails, DealState.REQUESTED);

        emit DealUpdated(id, DealState.REQUESTED, d.maker, d.taker);
    }


    // ────────────────────────────────────────────────────────────────────────
    // Cancel before accept (maker or taker)
    /// @notice Cancels a REQUESTED deal by maker or taker and refunds taker.
    /// @param id Deal id.
    /// @param reason Optional message (sent via Chat before state change).
    function cancelRequest(bytes32 id, bytes calldata reason) external nonReentrant {
        Deal storage d = deals[id];
        address maker_ = d.maker;
        address taker_ = d.taker;
        address token_ = d.token;
        Side side = d.side;
        if (msg.sender != maker_ && msg.sender != taker_) revert WrongCaller();
        if (d.state != DealState.REQUESTED) revert WrongState();
        // send reason before changing state to keep chat in allowed states
        _sendChat(id, reason, DealState.CANCELED);
        d.state  = DealState.CANCELED;
        d.tsLast = uint40(block.timestamp);
        _addRecent(maker_, id);
        _addRecent(taker_, id);
        uint128 back = side == Side.BUY ? d.amount * 2 : d.amount;
        _push(token_, taker_, back);
        _closeBoth(maker_, taker_, id);
        makerInfo[msg.sender].dealsCancelled += int32(1);
        emit DealUpdated(id, DealState.CANCELED, maker_, taker_);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Accept / Chat
    /// @notice Accepts a REQUESTED deal, escrows maker deposit (BUY:1×, SELL:2×).
    /// @param id Deal id.
    /// @param msg_ Optional message (sent via Chat after state change).
    function maker_acceptRequest(bytes32 id, bytes calldata msg_) external nonReentrant {
        Deal storage d = deals[id];
        address maker_ = d.maker;
        address taker_ = d.taker;
        if (msg.sender != maker_) revert WrongCaller();
        if (d.state != DealState.REQUESTED) revert WrongState();
        uint128 need = d.side == Side.BUY ? d.amount : d.amount * 2;
        _pull(d.token, maker_, need);
        d.state  = DealState.ACCEPTED;
        d.tsLast = uint40(block.timestamp);
        emit DealUpdated(id, DealState.ACCEPTED, maker_, taker_);
        _sendChat(id, msg_, DealState.ACCEPTED);
    }

    /// @dev Emits a chat message for REQUESTED/ACCEPTED/PAID if caller is maker or taker.
    function _sendChat(bytes32 id, bytes calldata t, DealState context) private {
        Deal storage d = deals[id];
        address maker_ = d.maker;
        address taker_ = d.taker;
        if (msg.sender != maker_ && msg.sender != taker_) revert WrongCaller();
        DealState st = d.state;
        if (st != DealState.REQUESTED && st != DealState.ACCEPTED && st != DealState.PAID) revert WrongState();
        bool toMaker = msg.sender == taker_;
        DealState chatState = context;
        d.chat.push(
            ChatMessage({
                ts: uint40(block.timestamp),
                toMaker: toMaker,
                state: chatState,
                text: t
            })
        );
        uint32 idx = uint32(d.chat.length - 1);
        address to = toMaker ? maker_ : taker_;
        emit Chat(id, msg.sender, to, idx);
    }

    /// @notice Sends a chat message in REQUESTED/ACCEPTED/PAID.
    /// @param id Deal id.
    /// @param t Message text.
    function sendMessage(bytes32 id, bytes calldata t) external {
        _sendChat(id, t, DealState.NONE);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Cancel after accept (restricted by side)
    /// @notice Cancels an ACCEPTED deal (SELL: taker; BUY: maker) and refunds deposits.
    /// @param id Deal id.
    /// @param reason Optional message (sent via Chat before state change).
    function cancelDeal(bytes32 id, bytes calldata reason) external nonReentrant {
        Deal storage d = deals[id];
        if (d.state != DealState.ACCEPTED) revert WrongState();
        address maker_ = d.maker;
        address taker_ = d.taker;
        address token_ = d.token;
        Side side = d.side;
        // maker can cancel only when Side.BUY; taker only when Side.SELL
        if (msg.sender == maker_) {
            if (side != Side.BUY) revert WrongSide();
        } else if (msg.sender == taker_) {
            if (side != Side.SELL) revert WrongSide();
        } else {
            // neither maker nor taker
            revert WrongCaller();
        }

        _sendChat(id, reason, DealState.CANCELED);
        d.state  = DealState.CANCELED;
        d.tsLast = uint40(block.timestamp);
        _addRecent(maker_, id);
        _addRecent(taker_, id);
        if (side == Side.BUY) {
            _push(token_, taker_, d.amount * 2);
            _push(token_, maker_, d.amount);
        } else {
            _push(token_, taker_, d.amount);
            _push(token_, maker_, d.amount * 2);
        }
        _closeBoth(maker_, taker_, id);
        makerInfo[msg.sender].dealsCancelled += int32(1);
        emit DealUpdated(id, DealState.CANCELED, maker_, taker_);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Mark paid / Release
    /// @notice Marks fiat as paid by the payer (BUY: maker; SELL: taker). Moves to PAID.
    /// @param id Deal id.
    /// @param msg_ Optional message (sent via Chat after state change).
    function markFiatPaid(bytes32 id, bytes calldata msg_) external {
        Deal storage d = deals[id];
        if (d.state != DealState.ACCEPTED) revert WrongState();
        address maker_ = d.maker;
        address taker_ = d.taker;
        Side side = d.side;
        if ((side == Side.BUY  && msg.sender != maker_) ||
            (side == Side.SELL && msg.sender != taker_)) revert NotFiatPayer();
        d.state  = DealState.PAID;
        d.tsLast = uint40(block.timestamp);
        emit DealUpdated(id, DealState.PAID, maker_, taker_);
        _sendChat(id, msg_, DealState.PAID);
    }

    /// @notice Releases the deal after PAID by the counterparty (BUY: taker; SELL: maker).
    /// @dev Pays main amount minus fee and refunds deposits. Adds to recent lists and emits DealUpdated(RELEASED).
    /// @param id Deal id.
    /// @param msg_ Optional message (sent via Chat before state change).
    function release(bytes32 id, bytes calldata msg_) external nonReentrant {
        Deal storage d = deals[id];
        if (d.state != DealState.PAID) revert WrongState();
        address maker_ = d.maker;
        address taker_ = d.taker;
        address token_ = d.token;
        Side side = d.side;
        if ((side == Side.BUY  && msg.sender != taker_
        ) || (side == Side.SELL && msg.sender != maker_)) {
            revert WrongCaller();
        }

        _sendChat(id, msg_, DealState.RELEASED);

        d.state  = DealState.RELEASED;
        d.tsLast = uint40(block.timestamp);
        _addRecent(maker_, id);
        _addRecent(taker_, id);
        _closeBoth(maker_, taker_, id);
        makerInfo[maker_].dealsCompleted += int32(1);
        makerInfo[taker_].dealsCompleted += int32(1);

        // main payout (crypto recipient)
        address payoutTo = (side == Side.BUY) ? maker_ : taker_;
        _payWithFee(token_, taker_, maker_, payoutTo, d.amount);

        // return both deposits
        _push(token_, taker_, d.amount);
        _push(token_, maker_, d.amount);

        emit DealUpdated(id, DealState.RELEASED, maker_, taker_);
    }

    // ────────────────────────────────────────────────────────────────────────
    // View helpers
    /// @notice Returns number of offers for given token/side/fiat.
    function getOfferCount(address token, Side s, FiatCode f) external view returns (uint) {
        return _marketOffers[_marketKey(token, s, f)].length;
    }

    /// @notice Returns paginated slice of offers for a market (token/side/fiat).
    function getMarketOffers(address token, Side s, FiatCode f, uint off, uint lim)
        external
        view
        returns (OfferInfo[] memory out)
    {
        bytes32[] storage ids = _marketOffers[_marketKey(token, s, f)];
        if (lim == 0) return out;
        out = _collectOfferInfos(ids, off, lim, true);
    }

    /// @notice Returns the ID of maker offer for provided coordinates.
    function getOfferId(address token, address maker, Side s, FiatCode f) external view returns (bytes32) {
        return _offerId[token][maker][s][f];
    }

    /// @notice Previews the next offer ID that `maker` will obtain on first-time create.
    function previewNextOfferId(address maker) external view returns (bytes32 id, uint64 nonce) {
        nonce = _makerOfferNonce[maker] + 1;
        id = keccak256(abi.encodePacked(maker, nonce));
    }

    /// @notice Previews the next deal ID the taker will obtain when calling taker_requestOffer.
    function previewNextDealId(address taker) external view returns (bytes32 id, uint64 nonce) {
        nonce = _takerDealNonce[taker] + 1;
        id = keccak256(abi.encodePacked(taker, nonce));
    }

    /// @notice Returns the number of offers created by `maker`.
    function getMakerOfferCount(address maker) external view returns (uint) {
        return _makerOffers[maker].length;
    }

    /// @notice Returns paginated slice of offers created by `maker`.
    function getMakerOffers(address maker, uint off, uint lim)
        external
        view
        returns (OfferInfo[] memory out)
    {
        bytes32[] storage ids = _makerOffers[maker];
        if (lim == 0) return out;
        out = _collectOfferInfos(ids, off, lim, false);
    }

    function _sliceBounds(uint len, uint off, uint lim) private pure returns (uint start, uint end) {
        if (lim == 0 || off >= len) return (0, 0);
        uint remaining = len - off;
        if (lim > remaining) lim = remaining;
        start = off;
        end = off + lim;
    }

    function _collectOfferInfos(bytes32[] storage ids, uint off, uint lim, bool includeOnline)
        private
        view
        returns (OfferInfo[] memory out)
    {
        uint len = ids.length;
        (uint start, uint end) = _sliceBounds(len, off, lim);
        if (start == end) return out;
        out = new OfferInfo[](end - start);
        uint pos;
        for (uint i = start; i < end; i++) {
            bytes32 id = ids[i];
            Offer storage o = offers[id];
            if (o.ts == 0) continue;
            Offer memory copy = o;
            bool isOnline = includeOnline ? makerInfo[o.maker].online : false;
            out[pos] = OfferInfo({id: id, maker: o.maker, offer: copy, online: isOnline});
            pos++;
        }
        assembly {
            mstore(out, pos)
        }
    }

    function _collectDealInfos(bytes32[] storage ids, uint off, uint lim)
        private
        view
        returns (DealInfo[] memory out)
    {
        uint len = ids.length;
        (uint start, uint end) = _sliceBounds(len, off, lim);
        if (start == end) return out;
        out = new DealInfo[](end - start);
        uint pos;
        for (uint i = start; i < end; i++) {
            bytes32 id = ids[i];
            Deal storage d = deals[id];
            if (d.state == DealState.NONE) continue;
            Deal memory copy = d;
            out[pos] = DealInfo({id: id, deal: copy});
            pos++;
        }
        assembly {
            mstore(out, pos)
        }
    }

    /// @notice Returns number of open deals for a user.
    /// @notice Returns the count of open (non-closed) deals for a user.
    function getOpenDealCount(address u) external view returns (uint) {
        return _openDeals[u].length;
    }

    /// @notice Returns the number of chat messages for a deal.
    function getDealChatLength(bytes32 id) external view returns (uint256) {
        return deals[id].chat.length;
    }

    /// @notice Returns a paginated slice of the chat history for a deal.
    /// @param id Deal id.
    /// @param off Offset in the chat array.
    /// @param lim Maximum number of messages to return.
    function getDealChatSlice(bytes32 id, uint256 off, uint256 lim)
        external
        view
        returns (ChatMessage[] memory out)
    {
        ChatMessage[] storage arr = deals[id].chat;
        uint256 len = arr.length;
        (uint start, uint end) = _sliceBounds(len, off, lim);
        if (start == end) return out;
        uint slice = end - start;
        out = new ChatMessage[](slice);
        for (uint256 i; i < slice; i++) {
            out[i] = arr[start + i];
        }
    }

    /// @notice Returns paginated slice of open deals with details.
    function getOpenDealsDetailed(address u, uint off, uint lim)
        external
        view
        returns (DealInfo[] memory out)
    {
        if (lim == 0) return out;
        out = _collectDealInfos(_openDeals[u], off, lim);
    }

    /// @notice Returns maker profiles for the provided addresses.
    function getMakerProfiles(address[] calldata accounts)
        external
        view
        returns (MakerProfile[] memory profiles)
    {
        uint256 len = accounts.length;
        profiles = new MakerProfile[](len);
        for (uint256 i; i < len; i++) {
            profiles[i] = makerInfo[accounts[i]];
        }
    }

    /// @notice Returns number of recent (closed) deals for a user.
    /// @notice Returns the count of recent (closed) deals for a user.
    function getRecentDealCount(address u) external view returns (uint) {
        return _recentDeals[u].length;
    }

    /// @notice Returns paginated slice of recent (closed) deals with details.
    function getRecentDealsDetailed(address u, uint off, uint lim)
        external
        view
        returns (DealInfo[] memory out)
    {
        if (lim == 0) return out;
        out = _collectDealInfos(_recentDeals[u], off, lim);
    }

}
