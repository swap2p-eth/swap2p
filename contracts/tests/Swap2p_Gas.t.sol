// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {console2 as console} from "forge-std/console2.sol";

import {Swap2p} from "../Swap2p.sol";
import {MintableERC20} from "./mocks/MintableERC20.sol";

contract Swap2p_GasTest is Test {
    Swap2p internal swap;
    MintableERC20 internal token;

    address internal maker;
    address internal taker;
    address internal partner;
    address internal author;

    // Only current gas table is printed; no baselines/deltas

    function setUp() public {
        maker = makeAddr("maker");
        taker = makeAddr("taker");
        partner = makeAddr("partner");
        author = makeAddr("author");

        swap = new Swap2p(author);
        token = new MintableERC20("Mock", "MCK");

        token.mint(maker, 1e24);
        token.mint(taker, 1e24);

        vm.startPrank(maker);
        token.approve(address(swap), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(taker);
        token.approve(address(swap), type(uint256).max);
        vm.stopPrank();

        // Example to set baselines (edit after first run):
        // baseline.push(Baseline({name: "SELL:setOnline", gas: 0}));
    }

    function _previewNextDealId(address taker_) internal view returns (bytes32) {
        (bytes32 id, ) = swap.previewNextDealId(taker_);
        return id;
    }

    // no baseline helpers

    // ---------- formatting helpers ----------
    function _utoa(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 temp = v; uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buf = new bytes(digits);
        while (v != 0) { digits -= 1; buf[digits] = bytes1(uint8(48 + v % 10)); v /= 10; }
        return string(buf);
    }
    function _padRight(string memory s, uint256 width) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        if (b.length >= width) return s;
        bytes memory out = new bytes(width);
        for (uint i; i < b.length; i++) out[i] = b[i];
        for (uint i = b.length; i < width; i++) out[i] = 0x20; // space
        return string(out);
    }
    function _row(string memory name, string memory gasStr) internal pure returns (string memory) {
        return string(abi.encodePacked(
            "| ", _padRight(name, 26),
            " | ", _padRight(gasStr, 10),
            " |"
        ));
    }
    function _printHeader() internal pure {
        console.log("+----------------------------+------------+");
        console.log("| op                         | gas        |");
        console.log("+----------------------------+------------+");
    }
    function _printFooter() internal pure {
        console.log("+----------------------------+------------+");
    }
    function _printRow(string memory name, uint256 gasUsed) internal pure {
        string memory gasStr = _utoa(gasUsed);
        console.log(_row(name, gasStr));
    }

    function test_Gas_HappyPaths_Table() public {
        console.log("=== Gas report: Swap2p happy paths ===");
        _printHeader();

        // SELL happy path
        uint256 g;

        vm.prank(maker);
        g = gasleft();
        swap.setOnline(true);
        g -= gasleft();
        _printRow("SELL:setOnline", g);

        vm.prank(maker);
        g = gasleft();
        swap.maker_makeOffer(address(token), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 100e18, 1_000e18, 1e18, 500e18, "wire", "");
        g -= gasleft();
        _printRow("SELL:maker_makeOffer", g);

        uint128 amount = 100e18;
        bytes32 sellDealId = _previewNextDealId(taker);
        vm.prank(taker);
        g = gasleft();
        swap.taker_requestOffer(address(token), Swap2p.Side.SELL, maker, amount, Swap2p.FiatCode.wrap(840), 100e18, "details", address(0));
        g -= gasleft();
        _printRow("SELL:taker_requestOffer", g);

        vm.prank(maker);
        g = gasleft();
        swap.maker_acceptRequest(sellDealId, bytes("ok"));
        g -= gasleft();
        _printRow("SELL:maker_acceptRequest", g);

        vm.prank(taker);
        g = gasleft();
        swap.sendMessage(sellDealId, bytes("hi"));
        g -= gasleft();
        _printRow("SELL:sendMessage", g);

        vm.prank(taker);
        g = gasleft();
        swap.markFiatPaid(sellDealId, bytes("paid"));
        g -= gasleft();
        _printRow("SELL:markFiatPaid", g);

        vm.prank(maker);
        g = gasleft();
        swap.release(sellDealId, bytes("release"));
        g -= gasleft();
        _printRow("SELL:release", g);

        // BUY happy path
        vm.prank(maker);
        g = gasleft();
        swap.maker_makeOffer(address(token), Swap2p.Side.BUY, Swap2p.FiatCode.wrap(978), 100e18, 1_000e18, 1e18, 500e18, "sepa", "");
        g -= gasleft();
        _printRow("BUY:maker_makeOffer", g);

        amount = 200e18;
        bytes32 buyDealId = _previewNextDealId(taker);
        vm.prank(taker);
        g = gasleft();
        swap.taker_requestOffer(address(token), Swap2p.Side.BUY, maker, amount, Swap2p.FiatCode.wrap(978), 100e18, "details", partner);
        g -= gasleft();
        _printRow("BUY:taker_requestOffer", g);

        vm.prank(maker);
        g = gasleft();
        swap.maker_acceptRequest(buyDealId, bytes("ok"));
        g -= gasleft();
        _printRow("BUY:maker_acceptRequest", g);

        vm.prank(maker);
        g = gasleft();
        swap.markFiatPaid(buyDealId, bytes("paid"));
        g -= gasleft();
        _printRow("BUY:markFiatPaid", g);

        vm.prank(taker);
        g = gasleft();
        swap.release(buyDealId, bytes("release"));
        g -= gasleft();
        _printRow("BUY:release", g);
        _printFooter();
        
        // keep test green
        assertTrue(true);
    }
}
