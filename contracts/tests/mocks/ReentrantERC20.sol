// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IReenterTarget {
    function cancelRequest(bytes32 id, bytes calldata reason) external;
}

// ERC20 that attempts a reentrant call during transferFrom
contract ReentrantERC20 is ERC20 {
    address public reenterTarget;
    bytes32 public reenterId;
    bytes public reenterReason;
    bool public enableReenter;

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setReenter(address target, bytes32 id, bytes calldata reason, bool enabled) external {
        reenterTarget = target;
        reenterId = id;
        reenterReason = reason;
        enableReenter = enabled;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (enableReenter && reenterTarget != address(0)) {
            // attempt reentrancy before state update; bubble any revert
            IReenterTarget(reenterTarget).cancelRequest(reenterId, reenterReason);
        }
        return super.transferFrom(from, to, value);
    }
}
