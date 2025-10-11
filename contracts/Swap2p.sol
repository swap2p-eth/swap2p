// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20}    from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Swap2pERC20 – ERC20-to-fiat P2P Market with Double-Collateral Escrow
/// @notice Fully immutable non-custodial P2P marketplace for exchanging ERC20 tokens for fiat off-chain.
///         Each trade uses a double-collateral model: both participants lock collateral on-chain to ensure honesty.
///         No admin, no upgrades, and no owner — only economic incentives.
/// @dev
/// - Supports any ERC20 that transfers the full amount (non-taxed tokens).
/// - Fee-on-transfer or deflationary tokens revert on inbound transfer.
/// - UI should list only verified safe tokens.
/// - Logic: Maker posts offer → Taker requests → Maker accepts → Fiat payment off-chain → Release on-chain.
contract Swap2p is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ────────────────────────────────────────────────────────────────────────
    // Constants and types
    uint32 private constant FEE_BPS      = 50;    // 0.50%
    uint32 private constant AFF_SHARE_BP = 5000;  // 50% of protocol fee goes to affiliate
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
    }

    // ────────────────────────────────────────────────────────────────────────
    // Immutable params
    address private immutable author; // protocol fee receiver
    uint96  private   _dealSeq;

    // offers[token][maker][side][fiat]
    mapping(address => mapping(address => mapping(Side => mapping(FiatCode => Offer)))) public offers;
    mapping(uint96  => Deal) public deals;

    // taker → affiliate partner
    mapping(address => address) public affiliates;

    // maker profiles
    mapping(address => MakerProfile) public makerInfo;

    // offer indexes
    mapping(address => mapping(Side => mapping(FiatCode => address[]))) private _offerKeys;
    mapping(address => mapping(address => mapping(Side => mapping(FiatCode => uint)))) private _offerPos; // +1

    // open deals
    mapping(address => uint96[]) private _openDeals;
    mapping(address => mapping(uint96 => uint)) private _openPos; // +1

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

    // ────────────────────────────────────────────────────────────────────────
    // Events
    event OfferUpsert(
        address indexed token,
        address indexed maker,
        Side side,
        FiatCode indexed fiat,
        Offer offer,
        string comment
    );
    event OfferDeleted(address indexed token, address indexed maker, Side side, FiatCode indexed fiat);

    event DealRequested(
        uint96 indexed id,
        address indexed token,
        Side side,
        address indexed maker,
        address taker,
        uint128 amount,
        string paymentDetails
    );
    event DealCanceled(uint96 indexed id, string reason);
    event DealAccepted(uint96 indexed id, string makerMessage);
    event DealPaid(uint96 indexed id, string message);
    event DealReleased(uint96 indexed id);

    event Chat(uint96 indexed id, address indexed from, string text);

    event FeeDistributed(
        uint96 indexed id,
        address indexed token,
        address indexed partner,
        uint128 fee,
        uint128 partnerShare
    );
    event PartnerBound(address indexed taker, address indexed partner);
    event MakerOnline(address indexed maker, bool online);
    // removed working hours

    // ────────────────────────────────────────────────────────────────────────
    constructor() {
        author = msg.sender;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Modifiers
    modifier onlyMaker(uint96 id) {
        if (msg.sender != deals[id].maker) revert WrongCaller();
        _;
    }
    modifier onlyTaker(uint96 id) {
        if (msg.sender != deals[id].taker) revert WrongCaller();
        _;
    }

    modifier touchActivity() {
        // update last activity for caller
        makerInfo[msg.sender].lastActivity = uint40(block.timestamp);
        _;
    }

    // Non-reentrancy is provided by OpenZeppelin ReentrancyGuard

    // ────────────────────────────────────────────────────────────────────────
    // Offer-key helpers
    function _addOfferKey(address token, address m, Side s, FiatCode f) private {
        if (_offerPos[token][m][s][f] == 0) {
            _offerPos[token][m][s][f] = _offerKeys[token][s][f].length + 1;
            _offerKeys[token][s][f].push(m);
        }
    }

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
    function _addOpen(address u, uint96 id) private {
        _openPos[u][id] = _openDeals[u].length + 1;
        _openDeals[u].push(id);
    }
    function _removeOpen(address u, uint96 id) private {
        uint pos = _openPos[u][id];
        if (pos == 0) return;
        uint idx = pos - 1;
        uint96[] storage arr = _openDeals[u];
        uint last = arr.length - 1;
        if (idx != last) {
            uint96 lastId = arr[last];
            arr[idx] = lastId;
            _openPos[u][lastId] = pos;
        }
        arr.pop();
        delete _openPos[u][id];
    }
    function _closeBoth(address m, address t, uint96 id) private {
        _removeOpen(m, id);
        _removeOpen(t, id);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Token transfer helpers
    function _pull(address token, address from, uint128 amt) internal {
        if (amt == 0) return;
        uint256 beforeBal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(from, address(this), amt);
        uint256 afterBal = IERC20(token).balanceOf(address(this));
        if (afterBal - beforeBal != amt) revert FeeOnTransferTokenNotSupported();
    }

    function _push(address token, address to, uint128 amt) internal {
        if (amt == 0) return;
        IERC20(token).safeTransfer(to, amt);
    }

    function _payWithFee(uint96 id, address token, address taker, address to, uint128 amt) internal {
        uint128 fee = uint128((uint256(amt) * FEE_BPS) / 10_000);
        _push(token, to, amt - fee);
        address p = affiliates[taker];
        if (p != address(0)) {
            uint128 share = uint128((uint256(fee) * AFF_SHARE_BP) / 10_000);
            _push(token, p, share);
            _push(token, author, fee - share);
            emit FeeDistributed(id, token, p, fee, share);
        } else {
            _push(token, author, fee);
            emit FeeDistributed(id, token, address(0), fee, 0);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // Maker profile
    function setOnline(bool on) external touchActivity {
        makerInfo[msg.sender].online = on;
        emit MakerOnline(msg.sender, on);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Offer management
    function maker_makeOffer(
        address  token,
        Side     s,
        FiatCode f,
        uint96   price,
        uint96   reserve,
        uint128  minAmt,
        uint128  maxAmt,
        string calldata paymentMethods,
        string calldata comment
    ) external {
        _addOfferKey(token, msg.sender, s, f);

        Offer storage o = offers[token][msg.sender][s][f];
        o.minAmt = minAmt;
        o.maxAmt = maxAmt;
        o.reserve = reserve;
        o.priceFiatPerToken = price;
        o.fiat = f;
        o.ts = uint32(block.timestamp);
        o.side = s;
        o.token = token;
        o.paymentMethods = paymentMethods;

        emit OfferUpsert(token, msg.sender, s, f, o, comment);
    }

    function maker_deleteOffer(address token, Side s, FiatCode f) external {
        delete offers[token][msg.sender][s][f];
        _removeOfferKey(token, msg.sender, s, f);
        emit OfferDeleted(token, msg.sender, s, f);
    }




    // ────────────────────────────────────────────────────────────────────────
    // Request (taker)
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
        uint96 id = ++_dealSeq;
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

        emit DealRequested(id, token, s, maker, msg.sender, amount, details);
    }


    // ────────────────────────────────────────────────────────────────────────
    // Cancel before accept (maker or taker)
    function cancelRequest(uint96 id, string calldata reason) external nonReentrant touchActivity {
        Deal storage d = deals[id];
        if (msg.sender != d.maker && msg.sender != d.taker) revert WrongCaller();
        if (d.state != DealState.REQUESTED) revert WrongState();
        d.state  = DealState.CANCELED;
        d.tsLast = uint40(block.timestamp);
        Offer storage off = offers[d.token][d.maker][d.side][d.fiat];
        if (off.maxAmt != 0) off.reserve += uint96(d.amount);
        uint128 back = d.side == Side.BUY ? d.amount * 2 : d.amount;
        _push(d.token, d.taker, back);
        _closeBoth(d.maker, d.taker, id);
        emit DealCanceled(id, reason);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Accept / Chat
    function maker_acceptRequest(uint96 id, string calldata msg_) external onlyMaker(id) nonReentrant touchActivity {
        Deal storage d = deals[id];
        if (d.state != DealState.REQUESTED) revert WrongState();
        uint128 need = d.side == Side.BUY ? d.amount : d.amount * 2;
        _pull(d.token, msg.sender, need);
        d.state  = DealState.ACCEPTED;
        d.tsLast = uint40(block.timestamp);
        emit DealAccepted(id, msg_);
    }

    function maker_sendMessage(uint96 id, string calldata t) external onlyMaker(id) touchActivity {
        DealState st = deals[id].state;
        if (st != DealState.ACCEPTED && st != DealState.PAID) revert WrongState();
        emit Chat(id, msg.sender, t);
    }
    function taker_sendMessage(uint96 id, string calldata t) external onlyTaker(id) touchActivity {
        DealState st = deals[id].state;
        if (st != DealState.ACCEPTED && st != DealState.PAID) revert WrongState();
        emit Chat(id, msg.sender, t);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Cancel after accept (restricted by side)
    function cancelDeal(uint96 id, string calldata reason) external nonReentrant touchActivity {
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

        d.state  = DealState.CANCELED;
        d.tsLast = uint40(block.timestamp);
        // restore maker offer reserve
        Offer storage off = offers[d.token][d.maker][d.side][d.fiat];
        if (off.maxAmt != 0) off.reserve += uint96(d.amount);
        if (d.side == Side.BUY) {
            _push(d.token, d.taker, d.amount * 2);
            _push(d.token, d.maker, d.amount);
        } else {
            _push(d.token, d.taker, d.amount);
            _push(d.token, d.maker, d.amount * 2);
        }
        _closeBoth(d.maker, d.taker, id);
        emit DealCanceled(id, reason);
    }

    // ────────────────────────────────────────────────────────────────────────
    // Mark paid / Release
    function markFiatPaid(uint96 id, string calldata msg_) external touchActivity {
        Deal storage d = deals[id];
        if (d.state != DealState.ACCEPTED) revert WrongState();
        if ((d.side == Side.BUY  && msg.sender != d.maker) ||
            (d.side == Side.SELL && msg.sender != d.taker)) revert NotFiatPayer();
        d.state  = DealState.PAID;
        d.tsLast = uint40(block.timestamp);
        emit DealPaid(id, msg_);
    }

    function release(uint96 id) external nonReentrant touchActivity {
        Deal storage d = deals[id];
        if (d.state != DealState.PAID) revert WrongState();
        if ((d.side == Side.BUY  && msg.sender != d.taker
        ) || (d.side == Side.SELL && msg.sender != d.maker)) {
            revert WrongCaller();
        }

        d.state  = DealState.RELEASED;
        d.tsLast = uint40(block.timestamp);
        _closeBoth(d.maker, d.taker, id);

        // main payout (crypto recipient)
        address payoutTo = (d.side == Side.BUY) ? d.maker : d.taker;
        _payWithFee(id, d.token, d.taker, payoutTo, d.amount);

        // return both deposits
        _push(d.token, d.taker, d.amount);
        _push(d.token, d.maker, d.amount);

        emit DealReleased(id);
    }

    // ────────────────────────────────────────────────────────────────────────
    // View helpers
    /// @notice Returns number of offers for given token/side/fiat.
    function getOfferCount(address token, Side s, FiatCode f) external view returns (uint) {
        return _offerKeys[token][s][f].length;
    }

    /// @notice Returns subset of offer maker addresses for pagination.
    function getOfferKeys(address token, Side s, FiatCode f, uint off, uint lim)
    external view returns (address[] memory out)
    {
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

    /// @notice Returns number of open deals for a user.
    function getOpenDealCount(address u) external view returns (uint) {
        return _openDeals[u].length;
    }

    /// @notice Returns paginated list of open deal IDs for a user.
    function getOpenDeals(address u, uint off, uint lim)
    external view returns (uint96[] memory out)
    {
        uint96[] storage arr = _openDeals[u];
        uint len = arr.length;
        if (off >= len) return out;
        uint end = off + lim;
        if (end > len) end = len;
        out = new uint96[](end - off);
        for (uint i = off; i < end; i++) {
            out[i - off] = arr[i];
        }
    }

    /// @notice Checks maker availability for current UTC hour.
    function areMakersAvailable(address[] calldata m) external view returns (bool[] memory a) {
        uint len = m.length;
        a = new bool[](len);
        for (uint i; i < len; i++) {
            MakerProfile storage p = makerInfo[m[i]];
            a[i] = p.online;
        }
    }

}
