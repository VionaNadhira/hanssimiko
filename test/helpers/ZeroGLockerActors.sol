// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ZeroGLocker} from "../../contracts/ZeroGLocker.sol";

/// @notice Attempts to re-enter `ZeroGLocker.withdraw` from its own `receive`
///         hook in order to drain a second, already matured lock.
contract ReentrancyAttacker {
    ZeroGLocker public immutable locker;

    uint256[] public attackLockIds;
    bool public reentryAttempted;
    bool public reentryReverted;
    bool public reentrySucceeded;
    bytes public reentryErrorData;
    uint256 public received;

    error UnexpectedReentrySuccess();

    constructor(ZeroGLocker locker_) {
        locker = locker_;
    }

    function openLocks(uint256 duration, uint256 amount) external payable {
        attackLockIds.push(locker.createLock{value: amount}(duration));
    }

    function lockCount() external view returns (uint256) {
        return attackLockIds.length;
    }

    /// @notice Dev: sanity helper so the test can assert the attacker holds locks.
    function hasLocks() external view returns (bool) {
        return attackLockIds.length > 0;
    }

    /// @notice Forwards a withdrawal to the locker, triggering `receive`.
    function withdrawExternal(uint256 lockId) external {
        locker.withdraw(lockId);
    }

    receive() external payable {
        received += msg.value;
        if (reentryAttempted) return;

        reentryAttempted = true;
        try locker.withdraw(attackLockIds[1]) {
            reentrySucceeded = true;
        } catch (bytes memory err) {
            reentryReverted = true;
            reentryErrorData = err;
        }
    }
}

/// @notice Attempts to re-enter `ZeroGLocker.createLock` from its own `receive`
///         hook, which must be blocked by the reentrancy guard before any
///         function body logic (including the zero-value check) runs.
contract CreateLockReentrancy {
    ZeroGLocker public immutable locker;

    bool public reentryAttempted;
    bool public reentryReverted;
    bytes public reentryErrorData;

    error UnexpectedReentrySuccess();

    constructor(ZeroGLocker locker_) {
        locker = locker_;
    }

    function openLock(uint256 duration) external payable {
        locker.createLock{value: msg.value}(duration);
    }

    /// @notice Forwards a withdrawal so the `receive` hook runs mid-call.
    function withdrawExternal(uint256 lockId) external {
        locker.withdraw(lockId);
    }

    receive() external payable {
        if (reentryAttempted) return;
        reentryAttempted = true;
        try locker.createLock{value: 0}(15 days) {
            revert UnexpectedReentrySuccess();
        } catch (bytes memory err) {
            reentryReverted = true;
            reentryErrorData = err;
        }
    }
}

/// @notice Accepts lock creation but refuses the withdrawal payout, so the
///         contract's `NativeTransferFailed` path can be exercised.
contract PayoutRejecter {
    ZeroGLocker public immutable locker;
    uint256 public lockId;

    error UnexpectedRejection();

    constructor(ZeroGLocker locker_) {
        locker = locker_;
    }

    function openLock(uint256 duration) external payable returns (uint256) {
        lockId = locker.createLock{value: msg.value}(duration);
        return lockId;
    }

    /// @notice Forwards a withdrawal so the reverting `receive` hook is exercised.
    function withdrawExternal(uint256 lockId_) external {
        locker.withdraw(lockId_);
    }

    receive() external payable {
        revert UnexpectedRejection();
    }
}
