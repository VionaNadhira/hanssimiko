// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title 0G Locker
/// @notice Non-custodial timelock for the native 0G token on 0G Chain.
/// @dev This contract is deliberately a *locker*, not a staking or yield
///      contract. It has no rewards, no emissions, no fees, no admin and no
///      privileged function of any kind. A user deposits native 0G, the amount
///      becomes non-withdrawable until `unlockTime`, and after that instant the
///      exact deposited amount is returned and nothing else.
///
///      Invariants:
///      1. `address(this).balance == getTotalLocked()` at all times. The
///         contract has no `receive`/`fallback`, so native 0G can only enter
///         through `createLock` and can only leave through `withdraw`.
///      2. The sum of a user's active lock amounts equals
///         `getUserLockedBalance(user)`.
///      3. Once `withdrawn` is set it is never unset, so a lock can be settled
///         exactly once.
///      4. No lock can be created with a duration outside the fixed allowlist.
contract ZeroGLocker is ReentrancyGuard {
    /// @notice A single, independently tracked lock of native 0G.
    struct Lock {
        address owner;
        uint256 amount;
        uint256 startTime;
        uint256 unlockTime;
        bool withdrawn;
    }

    /// @dev Amount must be strictly greater than zero.
    error ZeroAmount();
    /// @dev `duration` is not one of the supported durations.
    error UnsupportedDuration(uint256 duration);
    /// @dev `lockId` has never been created.
    error LockNotFound(uint256 lockId);
    /// @dev Caller is not the owner of `lockId`.
    error NotLockOwner(uint256 lockId, address caller);
    /// @dev `lockId` has already been settled.
    error AlreadyWithdrawn(uint256 lockId);
    /// @dev `block.timestamp` is still before `unlockTime`.
    error LockNotExpired(uint256 lockId, uint256 unlockTime, uint256 currentTime);
    /// @dev The native transfer to the owner failed.
    error NativeTransferFailed(uint256 lockId, address recipient, uint256 amount);
    /// @dev Direct native transfers are rejected to keep invariant (1) intact.
    error DirectTransferNotAllowed();

    /// @notice Emitted when a new lock is opened.
    /// @param lockId Unique identifier of the lock.
    /// @param owner Address that owns the lock.
    /// @param amount Native 0G amount locked, in wei.
    /// @param startTime Timestamp at which the lock was opened.
    /// @param unlockTime Timestamp from which withdrawal is permitted.
    /// @param duration Requested lock duration in seconds.
    event LockCreated(
        uint256 indexed lockId, address indexed owner, uint256 amount, uint256 startTime, uint256 unlockTime, uint256 duration
    );

    /// @notice Emitted when a matured lock is settled by its owner.
    /// @param lockId Identifier of the settled lock.
    /// @param owner Address that received the funds.
    /// @param amount Native 0G amount returned, in wei.
    /// @param unlockTime Unlock timestamp of the settled lock.
    /// @param withdrawnAt Timestamp at which the withdrawal executed.
    event LockWithdrawn(
        uint256 indexed lockId, address indexed owner, uint256 amount, uint256 unlockTime, uint256 withdrawnAt
    );

    uint256 private constant _SECONDS_PER_DAY = 1 days;

    /// @dev Length of the supported-duration allowlist.
    uint256 private constant _SUPPORTED_DURATION_COUNT = 6;

    /// @notice Total native 0G currently held on behalf of all users, in wei.
    uint256 private _totalLocked;

    /// @notice Number of locks ever created. Also the id of the next lock.
    uint256 private _lockCount;

    /// @dev lockId => lock. Ids start at 1 so that `0` is never a valid id.
    mapping(uint256 => Lock) private _locks;

    /// @dev owner => lock ids owned by that address, in creation order.
    mapping(address => uint256[]) private _userLockIds;

    /// @notice Emitted on deployment. Useful to pin the implementation in logs.
    event LockerDeployed(address indexed locker);

    constructor() {
        emit LockerDeployed(address(this));
    }

    // -------------------------------------------------------------------------
    // Lock lifecycle
    // -------------------------------------------------------------------------

    /// @notice Locks `msg.value` of native 0G for `duration` seconds.
    /// @param duration One of the supported durations, in seconds.
    /// @return lockId Identifier assigned to the new lock.
    function createLock(uint256 duration) external payable nonReentrant returns (uint256 lockId) {
        if (msg.value == 0) revert ZeroAmount();
        if (!_isSupportedDuration(duration)) revert UnsupportedDuration(duration);

        uint256 startTime = block.timestamp;
        uint256 unlockTime = startTime + duration;

        lockId = ++_lockCount;

        _locks[lockId] = Lock({
            owner: msg.sender,
            amount: msg.value,
            startTime: startTime,
            unlockTime: unlockTime,
            withdrawn: false
        });

        _userLockIds[msg.sender].push(lockId);
        _totalLocked += msg.value;

        emit LockCreated(lockId, msg.sender, msg.value, startTime, unlockTime, duration);
    }

    /// @notice Withdraws the exact amount originally locked, once `unlockTime` has been reached.
    /// @param lockId Identifier of the lock to settle.
    function withdraw(uint256 lockId) external nonReentrant {
        Lock storage lock = _locks[lockId];

        if (lock.owner == address(0)) revert LockNotFound(lockId);
        if (lock.owner != msg.sender) revert NotLockOwner(lockId, msg.sender);
        if (lock.withdrawn) revert AlreadyWithdrawn(lockId);
        // A timelock is defined in terms of wall-clock time. Validators on 0G Chain
        // have sub-second finality, so a few seconds of timestamp drift is
        // irrelevant next to a minimum lock length of 15 days.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < lock.unlockTime) revert LockNotExpired(lockId, lock.unlockTime, block.timestamp);

        // Checks-effects-interactions: state is finalised before any value is moved.
        uint256 amount = lock.amount;
        uint256 unlockTime = lock.unlockTime;

        lock.withdrawn = true;
        _totalLocked -= amount;

        // `nonReentrant` has already flipped `_status` to NOT_ENTERED before this
        // point, so the linter's reentrancy concern is already covered.
        // forge-lint: disable-next-line(reentrancy-eth)
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert NativeTransferFailed(lockId, msg.sender, amount);

        // Emitting after the transfer is required for CEI. `withdrawn` is already
        // true, so a reentrant call cannot produce a second identical log.
        // forge-lint: disable-next-line(reentrancy-events)
        emit LockWithdrawn(lockId, msg.sender, amount, unlockTime, block.timestamp);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Returns the full lock record.
    /// @param lockId Identifier of the lock.
    /// @return lock The stored lock. A non-existent id yields a zeroed struct.
    function getLock(uint256 lockId) external view returns (Lock memory lock) {
        return _locks[lockId];
    }

    /// @notice Returns every lock id owned by `user`, in creation order.
    /// @param user Address to query.
    /// @return lockIds The user's lock ids.
    function getUserLockIds(address user) external view returns (uint256[] memory lockIds) {
        return _userLockIds[user];
    }

    /// @notice Returns the number of active (not yet withdrawn) 0G locked by `user`.
    /// @param user Address to query.
    /// @return amount Sum of the user's unsettled lock amounts, in wei.
    function getUserLockedBalance(address user) external view returns (uint256 amount) {
        uint256[] memory lockIds = _userLockIds[user];
        for (uint256 i = 0; i < lockIds.length; ++i) {
            Lock storage lock = _locks[lockIds[i]];
            if (!lock.withdrawn) {
                amount += lock.amount;
            }
        }
    }

    /// @notice Returns the total native 0G currently locked by all users.
    /// @return amount Total unsettled value, in wei. Always equal to the contract balance.
    function getTotalLocked() external view returns (uint256 amount) {
        return _totalLocked;
    }

    /// @notice Returns the total native 0G held by the contract.
    /// @return amount Contract balance, in wei.
    function getContractBalance() external view returns (uint256 amount) {
        return address(this).balance;
    }

    /// @notice Returns the total number of locks ever created.
    /// @return count Lifetime lock count.
    function getLockCount() external view returns (uint256 count) {
        return _lockCount;
    }

    /// @notice Returns the number of locks owned by `user`, including settled ones.
    /// @param user Address to query.
    /// @return count User's lifetime lock count.
    function getUserLockCount(address user) external view returns (uint256 count) {
        return _userLockIds[user].length;
    }

    /// @notice Reports whether a lock may be withdrawn at the current block.
    /// @param lockId Identifier of the lock.
    /// @return withdrawable True when the lock exists, belongs to the caller and has matured.
    function isWithdrawable(uint256 lockId) external view returns (bool withdrawable) {
        Lock storage lock = _locks[lockId];
        if (lock.owner == address(0) || lock.owner != msg.sender || lock.withdrawn) return false;
        // forge-lint: disable-next-line(block-timestamp)
        return block.timestamp >= lock.unlockTime;
    }

    /// @notice Returns the seconds remaining before a lock may be withdrawn.
    /// @param lockId Identifier of the lock.
    /// @return remaining Seconds left, or 0 when matured, unknown or already settled.
    function timeUntilUnlock(uint256 lockId) external view returns (uint256 remaining) {
        Lock storage lock = _locks[lockId];
        if (lock.owner == address(0) || lock.withdrawn) return 0;
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp >= lock.unlockTime) return 0;
        return lock.unlockTime - block.timestamp;
    }

    /// @notice Returns the immutable allowlist of supported durations.
    /// @return durations Durations in seconds, in ascending order.
    function getSupportedDurations() external pure returns (uint256[] memory durations) {
        durations = new uint256[](_SUPPORTED_DURATION_COUNT);
        uint256[6] memory allowed = _allowedDurations();
        for (uint256 i = 0; i < _SUPPORTED_DURATION_COUNT; ++i) {
            durations[i] = allowed[i];
        }
    }

    /// @notice Reports whether `duration` is an accepted lock duration.
    /// @param duration Duration in seconds.
    /// @return supported True when the duration is on the allowlist.
    function isSupportedDuration(uint256 duration) external pure returns (bool supported) {
        return _isSupportedDuration(duration);
    }

    /// @dev The single source of truth for the duration allowlist.
    function _allowedDurations() private pure returns (uint256[6] memory durations) {
        durations = [
            uint256(15) * _SECONDS_PER_DAY,
            uint256(30) * _SECONDS_PER_DAY,
            uint256(60) * _SECONDS_PER_DAY,
            uint256(90) * _SECONDS_PER_DAY,
            uint256(180) * _SECONDS_PER_DAY,
            uint256(365) * _SECONDS_PER_DAY
        ];
    }

    function _isSupportedDuration(uint256 duration) private pure returns (bool) {
        uint256[6] memory durations = _allowedDurations();
        for (uint256 i = 0; i < durations.length; ++i) {
            if (durations[i] == duration) return true;
        }
        return false;
    }

    // -------------------------------------------------------------------------
    // Native transfer rejection
    // -------------------------------------------------------------------------

    // Rejecting bare transfers guarantees the contract can never hold 0G that
    // is not attributable to a live lock, so `getTotalLocked()` always equals
    // the contract balance.

    receive() external payable {
        revert DirectTransferNotAllowed();
    }

    fallback() external payable {
        revert DirectTransferNotAllowed();
    }
}
