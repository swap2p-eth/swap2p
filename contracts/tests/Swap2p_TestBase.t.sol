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
}

