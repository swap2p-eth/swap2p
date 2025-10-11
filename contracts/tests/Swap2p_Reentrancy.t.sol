// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Swap2p} from "../Swap2p.sol";
import {Swap2p_TestBase} from "./Swap2p_TestBase.t.sol";
import {ReentrantERC20} from "./mocks/ReentrantERC20.sol";

contract Swap2p_ReentrancyTest is Swap2p_TestBase {
    ReentrantERC20 internal rtoken;

    function setUp() public override {
        super.setUp();
        // Replace token with reentrant token for this test
        rtoken = new ReentrantERC20("Re", "RE");
        rtoken.mint(maker, 1e24);
        rtoken.mint(taker, 1e24);
        vm.startPrank(maker);
        rtoken.approve(address(swap), type(uint256).max);
        vm.stopPrank();
        vm.startPrank(taker);
        rtoken.approve(address(swap), type(uint256).max);
        vm.stopPrank();
        vm.prank(maker);
        swap.setOnline(true);
    }

    function test_Reenter_OnTakerRequest_RevertsNonReentrant() public {
        // sell flow; taker requests, token attempts to reenter cancelRequest
        vm.prank(maker);
        swap.maker_makeOffer(address(rtoken), Swap2p.Side.SELL, Swap2p.FiatCode.wrap(840), 0, 1_000e18, 1e18, 500e18, "wire", "");
        rtoken.setReenter(address(swap), 1, "re", true);
        vm.startPrank(taker);
        vm.expectRevert();
        swap.taker_requestOffer(address(rtoken), Swap2p.Side.SELL, maker, 10e18, Swap2p.FiatCode.wrap(840), 100e18, "", address(0));
        vm.stopPrank();
    }
}
