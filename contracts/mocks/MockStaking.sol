// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockStaking {
    uint256 public stakingPercent;
    uint256 public lockDuration;
    bool public failNextCall;

    function setStakingPercent(uint256 _percent) external {
        require(!failNextCall, "Call failed");
        stakingPercent = _percent;
    }

    function setLockDuration(uint256 _duration) external {
        lockDuration = _duration;
    }

    function setFailNextCall(bool _fail) external {
        failNextCall = _fail;
    }
}
