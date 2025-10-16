// SPDX-License-Identifier: MIT
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
/// 1) Maker publishes an offer (token, side BUY/SELL, price, reserve, amount bounds).
/// 2) Taker requests: deposit is pulled (BUY: 2×amount, SELL: 1×amount). Offer reserve is reduced by `amount`.
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
/// Recent & Cleanup
/// - Recent lists show closed deals (RELEASED/CANCELED) for each party. cleanupDeals deletes old deals (min age 48h) and prunes recent indices.
///
/// Security
/// - ReentrancyGuard protects functions that transfer tokens.
/// - Fee‑on‑transfer tokens are rejected using a balance delta check in `_pull`.
/// - Explicit access checks (WrongCaller) are used for clarity instead of modifiers.
///
/// Notes
/// - Pagination helpers copy slices from storage into memory (gas‑aware, intended for off‑chain calls).
/// - Timestamps are compact; `lastActivity` is updated via `touchActivity` on user interactions.
contract Swap2p is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ────────────────────────────────────────────────────────────────────────
    // Constants and types
    uint32 private constant FEE_BPS              = 50;    // 0.50%
    uint32 private constant TAKER_AFF_SHARE_BP   = 2000;  // 20% of protocol fee goes to taker affiliate
    uint32 private constant MAKER_AFF_SHARE_BP   = 3000;  // 30% of protocol fee goes to maker affiliate
    type   FiatCode is uint24;

    enum Side { BUY, SELL }
    enum DealState { NONE, REQUESTED, ACCEPTED, PAID, RELEASED, CANCELED }

    // ────────────────────────────────────────────────────────────────────────
    // Data structures

    /// @notice Maker’s public offer parameters.
    struct Offer {
        uint128  minAmt;
        uint128  maxAmt;
        uint96   reserve;             // token amount reserved for offers
        uint96   priceFiatPerToken;   // fiat/token price ratio
        FiatCode fiat;
        uint32   ts;                  // last update timestamp
        Side     side;
        address  token;               // ERC20 token address
        string   paymentMethods;      // supported fiat payment systems/banks
    }

    /// @notice Pointer data to locate an offer in storage by its ID.
    struct OfferLocator {
        address token;
        address maker;
        Side    side;
        FiatCode fiat;
    }

    /// @notice Offer details returned from view helpers.
    struct OfferInfo {
        bytes32 id;
        address maker;
        Offer   offer;
    }

    struct MakerOfferTexts {
        string paymentMethods;
        string requirements;
        string comment;
    }

    /// @notice Active deal between maker and taker.
    struct Deal {
        uint128   amount;
        uint96    price;
        DealState state;
        Side      side;
        address   maker;
        address   taker;
        FiatCode  fiat;
        uint40    tsRequest;          // timestamp when requested
        uint40    tsLast;             // last state update
        address   token;
    }

    /// @notice Maker's online status and working hours (UTC).
    struct MakerProfile {
        bool   online;
        uint40 lastActivity;          // last interaction timestamp
        string requirements;          // taker requirements text
        string nickname;              // unique public nickname
        int32  dealsCancelled;        // self-canceled deals count
        int32  dealsCompleted;        // completed deals count
    }

    // ────────────────────────────────────────────────────────────────────────
    // Immutable params
    address private immutable author; // protocol fee receiver

    // offers[token][maker][side][fiat]
    mapping(address => mapping(address => mapping(Side => mapping(FiatCode => Offer)))) public offers;
    mapping(bytes32 => Deal) public deals;

    // offer ids and indexes
    mapping(address => uint64) private _makerOfferNonce;
    mapping(address => mapping(address => mapping(Side => mapping(FiatCode => bytes32)))) private _offerId;
    mapping(bytes32 => OfferLocator) private _offerLoc;

    // deal ids
    mapping(address => uint64) private _takerDealNonce;

    // user → affiliate partner
    mapping(address => address) public affiliates;

    // maker profiles
    mapping(address => MakerProfile) public makerInfo;
    mapping(bytes32 => bool) private _nicknameTaken;

    // offer indexes
    mapping(address => mapping(Side => mapping(FiatCode => address[]))) private _offerKeys;
    mapping(address => mapping(address => mapping(Side => mapping(FiatCode => uint)))) private _offerPos; // +1

    // open deals
    mapping(address => bytes32[]) private _openDeals;
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
    error SelfPartnerNotAllowed();
    error NotFiatPayer();
    error MakerOffline();
    error WorsePrice();
    error InsufficientReserve();
    error FeeOnTransferTokenNotSupported();
    error AuthorZero();
    error NicknameTaken();

    // ────────────────────────────────────────────────────────────────────────
    // Events
    event OfferUpsert(
        bytes32 id,
        address indexed token,
        address indexed maker,
        FiatCode indexed fiat,
        Offer offer,
        string comment
    );
    event OfferDeleted(bytes32 id, address indexed token, address indexed maker, Side side, FiatCode indexed fiat);

    event DealRequested(
        bytes32 indexed id,
        address indexed token,
        address indexed maker,
        address taker,
        uint128 amount,
        string paymentDetails
    );
    event DealCanceled(bytes32 indexed id);
    event DealAccepted(bytes32 indexed id);
    event DealPaid(bytes32 indexed id);
    event DealReleased(bytes32 indexed id);

    event Chat(bytes32 indexed id, address indexed from, bytes text);

    /// @notice Emitted for each affiliate partner receiving a share of the fee (taker or maker).
    event FeeDistributed(
        bytes32 indexed id,
        address indexed token,
        address indexed partner,
        uint128 fee,
        uint128 partnerShare
    );
    event PartnerBound(address indexed taker, address indexed partner);
    event MakerOnline(address indexed maker, bool online);
    // removed working hours
    event DealDeleted(bytes32 indexed id);

    // ────────────────────────────────────────────────────────────────────────
    /// @notice Initializes fee receiver (`author`).
    /// @param author_ Address that receives protocol fees.
    constructor(address author_) {
        if (author_ == address(0)) revert AuthorZero();
        author = author_;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Modifiers

    modifier touchActivity() {
        // update last activity for caller
        makerInfo[msg.sender].lastActivity = uint40(block.timestamp);
        _;
    }

    // Non-reentrancy is provided by OpenZeppelin ReentrancyGuard

    // ────────────────────────────────────────────────────────────────────────
    // Offer-key helpers
    /// @dev Adds a maker address into the offer keys index if absent.
    function _addOfferKey(address token, address m, Side s, FiatCode f) private {
        if (_offerPos[token][m][s][f] == 0) {
            _offerPos[token][m][s][f] = _offerKeys[token][s][f].length + 1;
            _offerKeys[token][s][f].push(m);
        }
    }

    /// @dev Returns existing offer id or creates a new one for the maker/token/side/fiat tuple.
    function _getOrCreateOfferId(address token, address maker, Side s, FiatCode f) private returns (bytes32 oid) {
        oid = _offerId[token][maker][s][f];
        if (oid == bytes32(0)) {
            uint64 next = ++_makerOfferNonce[maker];
            oid = keccak256(abi.encodePacked(maker, next));
            _offerId[token][maker][s][f] = oid;
            _offerLoc[oid] = OfferLocator({
                token: token,
                maker: maker,
                side: s,
                fiat: f
            });
        }
    }

    /// @dev Removes a maker address from the offer keys index if present.
    function _removeOfferKey(address token, address m, Side s, FiatCode f) private {
        uint pos = _offerPos[token][m][s][f];
        if (pos == 0) return;
        address[] storage arr = _offerKeys[token][s][f];
        uint idx = pos - 1;
        uint last = arr.length - 1;
        if (idx != last) {
            address lastA = arr[last];
            arr[idx] = lastA;
            _offerPos[token][lastA][s][f] = pos;
        }
        arr.pop();
        delete _offerPos[token][m][s][f];
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
        uint pos = _openPos[u][id];
        if (pos == 0) return;
        uint idx = pos - 1;
        bytes32[] storage arr = _openDeals[u];
        uint last = arr.length - 1;
        if (idx != last) {
            bytes32 lastId = arr[last];
            arr[idx] = lastId;
            _openPos[u][lastId] = pos;
        }
        arr.pop();
        delete _openPos[u][id];
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
        uint pos = _recentPos[u][id];
        if (pos == 0) return;
        uint idx = pos - 1;
        bytes32[] storage arr = _recentDeals[u];
        uint last = arr.length - 1;
        if (idx != last) {
            bytes32 lastId = arr[last];
            arr[idx] = lastId;
            _recentPos[u][lastId] = pos;
        }
        arr.pop();
        delete _recentPos[u][id];
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

    /// @dev Pays `amt` to `to`, charges protocol fee and splits affiliate share between taker/maker partners.
    function _payWithFee(
        bytes32 id,
        address token,
        address taker,
        address maker,
        address to,
        uint128 amt
    ) internal {
        uint128 fee = uint128((uint256(amt) * FEE_BPS) / 10_000);
        _push(token, to, amt - fee);

        uint128 remaining = fee;

        address takerPartner = affiliates[taker];
        uint128 takerShare = 0;
        if (takerPartner != address(0)) {
            takerShare = uint128((uint256(fee) * TAKER_AFF_SHARE_BP) / 10_000);
            if (takerShare != 0) {
                _push(token, takerPartner, takerShare);
                remaining -= takerShare;
            }
            emit FeeDistributed(id, token, takerPartner, fee, takerShare);
        } else {
            emit FeeDistributed(id, token, address(0), fee, 0);
        }

        address makerPartner = affiliates[maker];
        if (makerPartner != address(0)) {
            uint128 makerShare = uint128((uint256(fee) * MAKER_AFF_SHARE_BP) / 10_000);
            if (makerShare != 0) {
                _push(token, makerPartner, makerShare);
                remaining -= makerShare;
            }
            emit FeeDistributed(id, token, makerPartner, fee, makerShare);
        }

        if (remaining != 0) {
            _push(token, author, remaining);
        }
    }

    function _updateRequirements(address maker, string memory req) private {
        if (bytes(req).length != 0) {
            makerInfo[maker].requirements = req;
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Maker profile
    /// @notice Sets caller's online status for availability checks.
    /// @param on New online flag.
    function setOnline(bool on) external touchActivity {
        makerInfo[msg.sender].online = on;
        emit MakerOnline(msg.sender, on);
    }

    /// @notice Updates maker requirements for the caller.
    /// @param req New requirements text.
    function setRequirements(string calldata req) external touchActivity {
        makerInfo[msg.sender].requirements = req;
    }

    /// @notice Updates caller's public nickname. Empty string clears nickname.
    /// @param nick Nickname to set (must be unique when non-empty).
    function setNickname(string calldata nick) external touchActivity {
        MakerProfile storage profile = makerInfo[msg.sender];
        bytes memory newBytes = bytes(nick);
        bytes memory oldBytes = bytes(profile.nickname);

        if (newBytes.length == 0) {
            if (oldBytes.length != 0) {
                bytes32 oldHash = keccak256(oldBytes);
                delete _nicknameTaken[oldHash];
                profile.nickname = "";
            }
            return;
        }

        bytes32 newHash = keccak256(newBytes);
        if (oldBytes.length != 0) {
            if (keccak256(oldBytes) == newHash) {
                return;
            }
        }

        if (_nicknameTaken[newHash]) revert NicknameTaken();

        _nicknameTaken[newHash] = true;
        profile.nickname = nick;

        if (oldBytes.length != 0) {
            bytes32 oldHash = keccak256(oldBytes);
            delete _nicknameTaken[oldHash];
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Offer management
    /// @notice Creates/updates an offer for the caller (maker).
    /// @param token ERC20 token address.
    /// @param s Side (BUY/SELL).
    /// @param f Fiat code (uint24).
    /// @param price Fiat per token price (unit is UI-defined).
    /// @param reserve Amount of tokens reserved for this offer.
    /// @param minAmt Minimum per-request amount.
    /// @param maxAmt Maximum per-request amount.
    /// @param texts Aggregated string parameters: payment methods, requirements (optional), comment.
    function maker_makeOffer(
        address  token,
        Side     s,
        FiatCode f,
        uint96   price,
        uint96   reserve,
        uint128  minAmt,
        uint128  maxAmt,
        MakerOfferTexts calldata texts
    ) external {
        _makerMakeOffer(msg.sender, token, s, f, price, reserve, minAmt, maxAmt, texts);
    }

    function _makerMakeOffer(
        address maker,
        address token,
        Side s,
        FiatCode f,
        uint96 price,
        uint96 reserve,
        uint128 minAmt,
        uint128 maxAmt,
        MakerOfferTexts calldata texts
    ) private {
        _addOfferKey(token, maker, s, f);
        bytes32 oid = _getOrCreateOfferId(token, maker, s, f);

        Offer storage o = offers[token][maker][s][f];
        o.minAmt = minAmt;
        o.maxAmt = maxAmt;
        o.reserve = reserve;
        o.priceFiatPerToken = price;
        o.fiat = f;
        o.ts = uint32(block.timestamp);
        o.side = s;
        o.token = token;
        o.paymentMethods = texts.paymentMethods;

        _updateRequirements(maker, texts.requirements);

        emit OfferUpsert(oid, token, maker, f, o, texts.comment);
    }

    /// @notice Deletes caller's offer for (token, side, fiat).
    function maker_deleteOffer(address token, Side s, FiatCode f) external {
        bytes32 oid = _offerId[token][msg.sender][s][f];
        delete offers[token][msg.sender][s][f];
        _removeOfferKey(token, msg.sender, s, f);
        if (oid != bytes32(0)) {
            delete _offerLoc[oid];
            delete _offerId[token][msg.sender][s][f];
        }
        emit OfferDeleted(oid, token, msg.sender, s, f);
    }




    // ────────────────────────────────────────────────────────────────────────
    // Request (taker)
    /// @notice Requests an offer and escrows taker deposit (BUY: 2×, SELL: 1×).
    /// @param token ERC20 token address.
    /// @param s Side.
    /// @param maker Maker address.
    /// @param amount Trade amount.
    /// @param f Fiat code.
    /// @param expectedPrice Price guard (BUY: offer >= expected; SELL: offer <= expected).
    /// @param details Free-form details emitted in DealRequested.
    /// @param partner Optional affiliate to bind (first non-zero value wins).
    function taker_requestOffer(
        address  token,
        Side     s,
        address  maker,
        uint128  amount,
        FiatCode f,
        uint96   expectedPrice,
        string calldata details,
        address  partner
    ) external nonReentrant touchActivity {
        Offer storage off = offers[token][maker][s][f];
        if (off.maxAmt == 0) revert OfferNotFound();

        // availability (no locals kept)
        if (!makerInfo[maker].online) revert MakerOffline();

        // price guards
        if (s == Side.BUY) {
            if (off.priceFiatPerToken < expectedPrice) revert WorsePrice();
        } else {
            if (off.priceFiatPerToken > expectedPrice) revert WorsePrice();
        }

        // bounds & reserve
        if (amount < off.minAmt || amount > off.maxAmt) revert AmountOutOfBounds();
        if (off.reserve < uint96(amount)) revert InsufficientReserve();
        off.reserve -= uint96(amount);

        // taker deposit (double-collateral)
        uint128 need = s == Side.BUY ? amount * 2 : amount;
        _pull(token, msg.sender, need);

        // create deal without struct literal to avoid stack pressure
        uint64 nextNonce = ++_takerDealNonce[msg.sender];
        bytes32 id = keccak256(abi.encodePacked(msg.sender, nextNonce));
        Deal storage d = deals[id];
        d.amount    = amount;
        d.price     = off.priceFiatPerToken;
        d.state     = DealState.REQUESTED;
        d.side      = s;
        d.maker     = maker;
        d.taker     = msg.sender;
        d.fiat      = f;
        d.tsRequest = uint40(block.timestamp);
        d.tsLast    = uint40(block.timestamp);
        d.token     = token;

        _addOpen(maker, id);
        _addOpen(msg.sender, id);

        if (affiliates[msg.sender] == address(0) && partner != address(0)) {
            if (partner == msg.sender) revert SelfPartnerNotAllowed();
            affiliates[msg.sender] = partner;
            emit PartnerBound(msg.sender, partner);
        }

        emit DealRequested(id, token, maker, msg.sender, amount, details);
    }


    // ────────────────────────────────────────────────────────────────────────
    // Cancel before accept (maker or taker)
    /// @notice Cancels a REQUESTED deal by maker or taker, restores reserve and refunds taker.
    /// @param id Deal id.
    /// @param reason Optional message (sent via Chat before state change).
    function cancelRequest(bytes32 id, bytes calldata reason) external nonReentrant touchActivity {
        Deal storage d = deals[id];
        if (msg.sender != d.maker && msg.sender != d.taker) revert WrongCaller();
        if (d.state != DealState.REQUESTED) revert WrongState();
        // send reason before changing state to keep chat in allowed states
        if (reason.length != 0) {
            _sendChat(id, reason);
        }
        d.state  = DealState.CANCELED;
        d.tsLast = uint40(block.timestamp);
        _addRecent(d.maker, id);
        _addRecent(d.taker, id);
        Offer storage off = offers[d.token][d.maker][d.side][d.fiat];
        if (off.maxAmt != 0) off.reserve += uint96(d.amount);
        uint128 back = d.side == Side.BUY ? d.amount * 2 : d.amount;
        _push(d.token, d.taker, back);
        _closeBoth(d.maker, d.taker, id);
        makerInfo[msg.sender].dealsCancelled += int32(1);
        emit DealCanceled(id);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Accept / Chat
    /// @notice Accepts a REQUESTED deal, escrows maker deposit (BUY:1×, SELL:2×).
    /// @param id Deal id.
    /// @param msg_ Optional message (sent via Chat after state change).
    function maker_acceptRequest(bytes32 id, bytes calldata msg_) external nonReentrant touchActivity {
        Deal storage d = deals[id];
        if (msg.sender != d.maker) revert WrongCaller();
        if (d.state != DealState.REQUESTED) revert WrongState();
        uint128 need = d.side == Side.BUY ? d.amount : d.amount * 2;
        _pull(d.token, msg.sender, need);
        d.state  = DealState.ACCEPTED;
        d.tsLast = uint40(block.timestamp);
        emit DealAccepted(id);
        if (msg_.length != 0) {
            _sendChat(id, msg_);
        }
    }

    /// @dev Emits a chat message for REQUESTED/ACCEPTED/PAID if caller is maker or taker.
    function _sendChat(bytes32 id, bytes calldata t) private {
        Deal storage d = deals[id];
        if (msg.sender != d.maker && msg.sender != d.taker) revert WrongCaller();
        DealState st = d.state;
        if (st != DealState.REQUESTED && st != DealState.ACCEPTED && st != DealState.PAID) revert WrongState();
        emit Chat(id, msg.sender, t);
    }

    /// @notice Sends a chat message in REQUESTED/ACCEPTED/PAID.
    /// @param id Deal id.
    /// @param t Message text.
    function sendMessage(bytes32 id, bytes calldata t) external touchActivity {
        _sendChat(id, t);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Cancel after accept (restricted by side)
    /// @notice Cancels an ACCEPTED deal (SELL: taker; BUY: maker). Restores reserve and refunds.
    /// @param id Deal id.
    /// @param reason Optional message (sent via Chat before state change).
    function cancelDeal(bytes32 id, bytes calldata reason) external nonReentrant touchActivity {
        Deal storage d = deals[id];
        if (d.state != DealState.ACCEPTED) revert WrongState();
        // maker can cancel only when Side.BUY; taker only when Side.SELL
        if (msg.sender == d.maker) {
            if (d.side != Side.BUY) revert WrongSide();
        } else if (msg.sender == d.taker) {
            if (d.side != Side.SELL) revert WrongSide();
        } else {
            // neither maker nor taker
            revert WrongCaller();
        }

        if (reason.length != 0) {
            _sendChat(id, reason);
        }
        d.state  = DealState.CANCELED;
        d.tsLast = uint40(block.timestamp);
        // restore maker offer reserve
        Offer storage off = offers[d.token][d.maker][d.side][d.fiat];
        if (off.maxAmt != 0) off.reserve += uint96(d.amount);
        _addRecent(d.maker, id);
        _addRecent(d.taker, id);
        if (d.side == Side.BUY) {
            _push(d.token, d.taker, d.amount * 2);
            _push(d.token, d.maker, d.amount);
        } else {
            _push(d.token, d.taker, d.amount);
            _push(d.token, d.maker, d.amount * 2);
        }
        _closeBoth(d.maker, d.taker, id);
        makerInfo[msg.sender].dealsCancelled += int32(1);
        emit DealCanceled(id);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Mark paid / Release
    /// @notice Marks fiat as paid by the payer (BUY: maker; SELL: taker). Moves to PAID.
    /// @param id Deal id.
    /// @param msg_ Optional message (sent via Chat after state change).
    function markFiatPaid(bytes32 id, bytes calldata msg_) external touchActivity {
        Deal storage d = deals[id];
        if (d.state != DealState.ACCEPTED) revert WrongState();
        if ((d.side == Side.BUY  && msg.sender != d.maker) ||
            (d.side == Side.SELL && msg.sender != d.taker)) revert NotFiatPayer();
        d.state  = DealState.PAID;
        d.tsLast = uint40(block.timestamp);
        emit DealPaid(id);
        if (msg_.length != 0) {
            _sendChat(id, msg_);
        }
    }

    /// @notice Releases the deal after PAID by the counterparty (BUY: taker; SELL: maker).
    /// @dev Pays main amount minus fee and refunds deposits. Adds to recent lists and emits DealReleased.
    /// @param id Deal id.
    /// @param msg_ Optional message (sent via Chat before state change).
    function release(bytes32 id, bytes calldata msg_) external nonReentrant touchActivity {
        Deal storage d = deals[id];
        if (d.state != DealState.PAID) revert WrongState();
        if ((d.side == Side.BUY  && msg.sender != d.taker
        ) || (d.side == Side.SELL && msg.sender != d.maker)) {
            revert WrongCaller();
        }

        // Send optional message before changing state
        if (msg_.length != 0) {
            _sendChat(id, msg_);
        }

        d.state  = DealState.RELEASED;
        d.tsLast = uint40(block.timestamp);
        _addRecent(d.maker, id);
        _addRecent(d.taker, id);
        _closeBoth(d.maker, d.taker, id);
        makerInfo[d.maker].dealsCompleted += int32(1);
        makerInfo[d.taker].dealsCompleted += int32(1);

        // main payout (crypto recipient)
        address payoutTo = (d.side == Side.BUY) ? d.maker : d.taker;
        _payWithFee(id, d.token, d.taker, d.maker, payoutTo, d.amount);

        // return both deposits
        _push(d.token, d.taker, d.amount);
        _push(d.token, d.maker, d.amount);

        emit DealReleased(id);
    }

    // ────────────────────────────────────────────────────────────────────────
    // View helpers
    /// @notice Returns number of offers for given token/side/fiat.
    /// @notice Returns the number of makers with an offer for (token, side, fiat).
    function getOfferCount(address token, Side s, FiatCode f) external view returns (uint) {
        return _offerKeys[token][s][f].length;
    }

    /// @notice Returns subset of offer maker addresses for pagination.
    /// @notice Returns a paginated slice of maker addresses for (token, side, fiat).
    /// @param off Offset in the index.
    /// @param lim Max number of items to return.
    function getOfferKeys(address token, Side s, FiatCode f, uint off, uint lim)
    external view returns (address[] memory out) {
        address[] storage arr = _offerKeys[token][s][f];
        uint len = arr.length;
        if (off >= len) return out;
        uint end = off + lim;
        if (end > len) end = len;
        out = new address[](end - off);
        for (uint i = off; i < end; i++) {
            out[i - off] = arr[i];
        }
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

    /// @notice Returns offer details by its ID.
    function getOfferById(bytes32 id) external view returns (OfferInfo memory info) {
        OfferLocator storage loc = _offerLoc[id];
        if (loc.maker == address(0)) revert OfferNotFound();
        Offer storage o = offers[loc.token][loc.maker][loc.side][loc.fiat];
        if (o.ts == 0) revert OfferNotFound();
        info.id = id;
        info.maker = loc.maker;
        info.offer = o;
    }

    /// @notice Returns all offers for specified token/side/fiat triple.
    function listOffers(address token, Side s, FiatCode f) external view returns (OfferInfo[] memory out) {
        address[] storage makers = _offerKeys[token][s][f];
        uint len = makers.length;
        uint valid;
        for (uint i; i < len; i++) {
            bytes32 oid = _offerId[token][makers[i]][s][f];
            Offer storage o = offers[token][makers[i]][s][f];
            if (oid != bytes32(0) && o.ts != 0) {
                valid++;
            }
        }
        out = new OfferInfo[](valid);
        uint pos;
        for (uint i; i < len; i++) {
            address maker = makers[i];
            bytes32 oid = _offerId[token][maker][s][f];
            Offer storage o = offers[token][maker][s][f];
            if (oid == bytes32(0) || o.ts == 0) continue;
            Offer memory copy = o;
            out[pos] = OfferInfo({id: oid, maker: maker, offer: copy});
            pos++;
        }
    }

    /// @notice Returns number of open deals for a user.
    /// @notice Returns the count of open (non-closed) deals for a user.
    function getOpenDealCount(address u) external view returns (uint) {
        return _openDeals[u].length;
    }

    /// @notice Returns paginated list of open deal IDs for a user.
    /// @notice Returns a paginated slice of open deal IDs for a user.
    /// @param off Offset.
    /// @param lim Limit.
    function getOpenDeals(address u, uint off, uint lim)
    external view returns (bytes32[] memory out) {
        bytes32[] storage arr = _openDeals[u];
        uint len = arr.length;
        if (off >= len) return out;
        uint end = off + lim;
        if (end > len) end = len;
        out = new bytes32[](end - off);
        for (uint i = off; i < end; i++) {
            out[i - off] = arr[i];
        }
    }

    /// @notice Returns maker profiles for the provided addresses.
    function getMakerProfiles(address[] calldata accounts)
        external
        view
        returns (MakerProfile[] memory profiles)
    {
        uint len = accounts.length;
        profiles = new MakerProfile[](len);
        for (uint i; i < len; i++) {
            MakerProfile storage src = makerInfo[accounts[i]];
            profiles[i].online = src.online;
            profiles[i].lastActivity = src.lastActivity;
            profiles[i].requirements = src.requirements;
            profiles[i].nickname = src.nickname;
            profiles[i].dealsCancelled = src.dealsCancelled;
            profiles[i].dealsCompleted = src.dealsCompleted;
        }
    }

    /// @notice Returns number of recent (closed) deals for a user.
    /// @notice Returns the count of recent (closed) deals for a user.
    function getRecentDealCount(address u) external view returns (uint) {
        return _recentDeals[u].length;
    }

    /// @notice Returns paginated list of recent (closed) deal IDs for a user.
    /// @notice Returns a paginated slice of recent (closed) deal IDs for a user.
    /// @param off Offset.
    /// @param lim Limit.
    function getRecentDeals(address u, uint off, uint lim)
    external view returns (bytes32[] memory out) {
        bytes32[] storage arr = _recentDeals[u];
        uint len = arr.length;
        if (off >= len) return out;
        uint end = off + lim;
        if (end > len) end = len;
        out = new bytes32[](end - off);
        for (uint i = off; i < end; i++) {
            out[i - off] = arr[i];
        }
    }

    /// @notice Deletes closed deals older than the provided age in hours (min 48h).
    /// @notice Deletes closed (RELEASED/CANCELED) deals older than `minAgeHours` and prunes recent indices.
    /// @dev Requires `minAgeHours >= 48`. Best used with small batches.
    /// @param ids Deal ids to consider for deletion.
    /// @param minAgeHours Minimal age threshold in hours.
    function cleanupDeals(bytes32[] calldata ids, uint256 minAgeHours) external {
        if (minAgeHours < 48) revert WrongState();
        uint256 minAge = minAgeHours * 1 hours;
        uint len = ids.length;
        for (uint i; i < len; i++) {
            bytes32 id = ids[i];
            Deal storage d = deals[id];
            DealState st = d.state;
            if (st != DealState.RELEASED && st != DealState.CANCELED) {
                continue;
            }
            if (block.timestamp - uint256(d.tsLast) < minAge) {
                continue;
            }
            address maker = d.maker;
            address taker = d.taker;
            delete deals[id];
            _removeRecent(maker, id);
            _removeRecent(taker, id);
            emit DealDeleted(id);
        }
    }

}
