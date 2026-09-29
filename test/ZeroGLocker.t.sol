// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ZeroGLocker} from "../contracts/ZeroGLocker.sol";
import {ReentrancyAttacker, PayoutRejecter, CreateLockReentrancy} from "./helpers/ZeroGLockerActors.sol";

/// @title ZeroGLocker test suite
/// @notice Covers lock creation, duration validation, settlement timing,
///         authorisation, reentrancy, event emission and balance accounting.
contract ZeroGLockerTest is Test {
    ZeroGLocker internal locker;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint256 internal constant FIFTEEN_DAYS = 15 days;
    uint256 internal constant ONE_ETH = 1 ether;

    /// @dev Fixed clock origin so elapsed-time assertions are deterministic.
    uint256 internal constant _FIXED_START = 1_800_000_000;

    /// @dev The six durations the contract must accept, in order.
    uint256[6] internal expectedDurations = [15 days, 30 days, 60 days, 90 days, 180 days, 365 days];

    function setUp() public {
        locker = new ZeroGLocker();
        vm.label(alice, "alice");
        vm.label(bob, "bob");
        vm.label(carol, "carol");
    }

    // =========================================================================
    // Deployment
    // =========================================================================

    function test_Deployment_EmitsLockerDeployed() public {
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        vm.expectEmit(true, false, false, true);
        emit ZeroGLocker.LockerDeployed(predicted);
        new ZeroGLocker();
    }

    function test_Deployment_StartsEmpty() public view {
        assertEq(locker.getTotalLocked(), 0, "total locked should start at zero");
        assertEq(locker.getLockCount(), 0, "lock count should start at zero");
        assertEq(locker.getContractBalance(), 0, "balance should start at zero");
    }

    function test_SupportedDurations_MatchSpecification() public view {
        uint256[] memory durations = locker.getSupportedDurations();
        assertEq(durations.length, 6, "there must be exactly six durations");
        for (uint256 i = 0; i < expectedDurations.length; ++i) {
            assertEq(durations[i], expectedDurations[i], "duration allowlist mismatch");
            assertTrue(locker.isSupportedDuration(durations[i]), "allowlisted duration must be supported");
        }
    }

    // =========================================================================
    // createLock
    // =========================================================================

    function test_CreateLock_RevertsOnZeroAmount() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        vm.expectRevert(ZeroGLocker.ZeroAmount.selector);
        locker.createLock{value: 0}(FIFTEEN_DAYS);
    }

    function test_CreateLock_RevertsOnOneWeiZeroValue() public {
        vm.deal(alice, 1);
        vm.prank(alice);
        vm.expectRevert(ZeroGLocker.ZeroAmount.selector);
        locker.createLock{value: 0}(FIFTEEN_DAYS);
    }

    function test_CreateLock_StoresExactAmountAndTimestamps() public {
        uint256 amount = 3.5 ether;
        uint256 startTime = 1_800_000_000;
        uint256 expectedUnlock = startTime + FIFTEEN_DAYS;

        vm.deal(alice, amount);
        vm.warp(startTime);
        vm.prank(alice);

        vm.expectEmit(true, true, false, false, address(locker));
        emit ZeroGLocker.LockCreated(1, alice, amount, startTime, expectedUnlock, FIFTEEN_DAYS);

        uint256 lockId = locker.createLock{value: amount}(FIFTEEN_DAYS);
        assertEq(lockId, 1, "first lock id must be 1");

        ZeroGLocker.Lock memory lock = locker.getLock(1);

        assertEq(lock.owner, alice, "owner mismatch");
        assertEq(lock.amount, amount, "amount must be stored exactly");
        assertEq(lock.startTime, startTime, "startTime must equal block.timestamp");
        assertEq(lock.unlockTime, expectedUnlock, "unlockTime must be startTime + duration");
        assertFalse(lock.withdrawn, "lock must not start withdrawn");
    }

    function test_CreateLock_AllValidDurations() public {
        vm.deal(alice, 100 ether);

        for (uint256 i = 0; i < expectedDurations.length; ++i) {
            uint256 duration = expectedDurations[i];
            uint256 amount = (i + 1) * ONE_ETH;
            uint256 startTime = 1_700_000_000 + i * 1_000;

            vm.warp(startTime);
            vm.prank(alice);
            uint256 lockId = locker.createLock{value: amount}(duration);

            ZeroGLocker.Lock memory lock = locker.getLock(lockId);
            assertEq(lock.unlockTime, startTime + duration, "unlockTime wrong for allowed duration");
            assertFalse(lock.withdrawn, "lock must not be withdrawn");
            assertEq(locker.timeUntilUnlock(lockId), duration, "timeUntilUnlock must equal the duration");
        }

        assertEq(locker.getLockCount(), 6, "six locks must exist");
        assertEq(locker.getTotalLocked(), (1 + 2 + 3 + 4 + 5 + 6) * ONE_ETH, "total locked must be the sum of deposits");
    }

    function test_CreateLock_RevertsOnInvalidDurations() public {
        uint256[8] memory invalid = [
            uint256(1 days),
            uint256(7 days),
            uint256(14 days),
            uint256(45 days),
            uint256(100 days),
            uint256(366 days),
            uint256(1000 days),
            uint256(0)
        ];

        vm.deal(alice, 100 ether);

        for (uint256 i = 0; i < invalid.length; ++i) {
            vm.prank(alice);
            vm.expectRevert(abi.encodeWithSelector(ZeroGLocker.UnsupportedDuration.selector, invalid[i]));
            locker.createLock{value: ONE_ETH}(invalid[i]);

            assertFalse(locker.isSupportedDuration(invalid[i]), "invalid duration must not be supported");
        }

        assertEq(locker.getLockCount(), 0, "no lock may be created with an invalid duration");
        assertEq(locker.getTotalLocked(), 0, "no value may be retained after a rejected createLock");
        assertEq(locker.getContractBalance(), 0, "rejected createLock must not leave value in the contract");
    }

    function test_CreateLock_RevertsOnOffByOneDurations() public {
        uint256[3] memory invalid = [uint256(15 days) - 1, uint256(365 days) + 1, uint256(30 days) + 1];

        vm.deal(alice, 100 ether);
        for (uint256 i = 0; i < invalid.length; ++i) {
            vm.prank(alice);
            vm.expectRevert(abi.encodeWithSelector(ZeroGLocker.UnsupportedDuration.selector, invalid[i]));
            locker.createLock{value: ONE_ETH}(invalid[i]);
        }
    }

    function test_CreateLock_MultipleLocksForOneUser() public {
        vm.deal(alice, 10 ether);

        vm.startPrank(alice);
        uint256 first = locker.createLock{value: ONE_ETH}(15 days);
        uint256 second = locker.createLock{value: 2 ether}(30 days);
        uint256 third = locker.createLock{value: 3 ether}(90 days);
        vm.stopPrank();

        assertEq(first, 1, "ids must be sequential");
        assertEq(second, 2, "ids must be sequential");
        assertEq(third, 3, "ids must be sequential");

        uint256[] memory ids = locker.getUserLockIds(alice);
        assertEq(ids.length, 3, "alice must own three locks");
        assertEq(ids[0], first, "order mismatch");
        assertEq(ids[1], second, "order mismatch");
        assertEq(ids[2], third, "order mismatch");

        assertEq(locker.getUserLockedBalance(alice), 6 ether, "user locked balance must be the sum of active locks");
        assertEq(locker.getTotalLocked(), 6 ether, "total locked must be the sum of active locks");
    }

    function test_CreateLock_MultipleUsersAreIndependent() public {
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);

        vm.prank(alice);
        uint256 aliceLock = locker.createLock{value: 1 ether}(15 days);
        vm.prank(bob);
        uint256 bobLock = locker.createLock{value: 2 ether}(30 days);
        vm.prank(carol);
        uint256 carolLock = locker.createLock{value: 4 ether}(365 days);
        assertEq(carolLock, 3, "carol lock id");

        assertEq(locker.getUserLockedBalance(alice), 1 ether, "alice balance");
        assertEq(locker.getUserLockedBalance(bob), 2 ether, "bob balance");
        assertEq(locker.getUserLockedBalance(carol), 4 ether, "carol balance");
        assertEq(locker.getTotalLocked(), 7 ether, "total locked");
        assertEq(locker.getUserLockCount(alice), 1, "alice lock count");
        assertEq(locker.getUserLockCount(bob), 1, "bob lock count");
        assertEq(locker.getUserLockCount(carol), 1, "carol lock count");

        // Bob's early withdrawal must not disturb Alice's or Carol's accounting.
        _advance(30 days);
        vm.prank(bob);
        locker.withdraw(bobLock);

        assertEq(locker.getUserLockedBalance(alice), 1 ether, "alice balance must be untouched");
        assertEq(locker.getUserLockedBalance(carol), 4 ether, "carol balance must be untouched");
        assertEq(locker.getUserLockCount(alice), 1, "alice must keep her lock record");
        assertFalse(_lockWithdrawn(aliceLock), "alice lock must stay active");
    }

    function test_GetLock_ReturnsZeroedStructForUnknownId() public view {
        ZeroGLocker.Lock memory lock = locker.getLock(999);
        assertEq(lock.owner, address(0), "owner must be zero");
        assertEq(lock.amount, 0, "amount must be zero");
        assertEq(lock.startTime, 0, "startTime must be zero");
        assertEq(lock.unlockTime, 0, "unlockTime must be zero");
        assertFalse(lock.withdrawn, "withdrawn must be false");
    }

    function test_TimeUntilUnlock_CountsDown() public {
        vm.deal(alice, 5 ether);
        vm.warp(1_000_000);
        vm.prank(alice);
        uint256 lockId = locker.createLock{value: ONE_ETH}(60 days);

        assertEq(locker.timeUntilUnlock(lockId), 60 days, "full duration at creation");
        vm.warp(1_000_000 + 20 days);
        assertEq(locker.timeUntilUnlock(lockId), 40 days, "countdown must track elapsed time");
        vm.warp(1_000_000 + 60 days);
        assertEq(locker.timeUntilUnlock(lockId), 0, "matured lock must report zero");
    }

    // =========================================================================
    // withdraw
    // =========================================================================

    function test_Withdraw_RevertsForUnknownLock() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ZeroGLocker.LockNotFound.selector, 1));
        locker.withdraw(1);
    }

    function test_Withdraw_RevertsForUnauthorizedCaller() public {
        vm.deal(alice, 5 ether);
        vm.prank(alice);
        uint256 lockId = locker.createLock{value: ONE_ETH}(15 days);

        _advance(15 days);
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(ZeroGLocker.NotLockOwner.selector, lockId, bob));
        locker.withdraw(lockId);

        assertFalse(_lockWithdrawn(lockId), "lock must remain active after a failed unauthorised withdrawal");
    }

    function test_Withdraw_RevertsOneSecondBeforeUnlock() public {
        vm.deal(alice, 5 ether);
        vm.warp(1_000);
        vm.prank(alice);
        uint256 lockId = locker.createLock{value: ONE_ETH}(15 days);

        vm.warp(1_000 + FIFTEEN_DAYS - 1);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(ZeroGLocker.LockNotExpired.selector, lockId, 1_000 + FIFTEEN_DAYS, block.timestamp)
        );
        locker.withdraw(lockId);

        assertEq(locker.getTotalLocked(), ONE_ETH, "value must stay locked");
        assertEq(alice.balance, 5 ether - ONE_ETH, "alice must not be paid early");
    }

    function test_Withdraw_SucceedsExactlyAtUnlockTime() public {
        vm.deal(alice, 5 ether);
        vm.warp(1_000);
        vm.prank(alice);
        uint256 lockId = locker.createLock{value: ONE_ETH}(15 days);

        uint256 unlockTime = 1_000 + FIFTEEN_DAYS;
        vm.warp(unlockTime);

        vm.expectEmit(true, true, false, false, address(locker));
        emit ZeroGLocker.LockWithdrawn(lockId, alice, ONE_ETH, unlockTime, unlockTime);

        vm.prank(alice);
        locker.withdraw(lockId);

        assertEq(alice.balance, 5 ether, "alice must receive the exact deposited amount");
        assertEq(locker.getTotalLocked(), 0, "total locked must be zero");
        assertTrue(_lockWithdrawn(lockId), "lock must be flagged as withdrawn");
    }

    function test_Withdraw_SucceedsAfterUnlockTime() public {
        vm.deal(alice, 5 ether);
        vm.warp(1_000);
        vm.prank(alice);
        uint256 lockId = locker.createLock{value: 2 ether}(30 days);

        vm.warp(1_000 + 30 days + 500 days);
        vm.prank(alice);
        locker.withdraw(lockId);

        assertEq(alice.balance, 5 ether, "alice must receive exactly what she locked, no more");
        assertEq(locker.getContractBalance(), 0, "contract must be empty");
    }

    function test_Withdraw_RevertsOnSecondAttempt() public {
        vm.deal(alice, 5 ether);
        vm.prank(alice);
        uint256 lockId = locker.createLock{value: ONE_ETH}(15 days);

        _advance(15 days);
        vm.prank(alice);
        locker.withdraw(lockId);

        uint256 balanceAfterFirst = alice.balance;
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ZeroGLocker.AlreadyWithdrawn.selector, lockId));
        locker.withdraw(lockId);

        assertEq(alice.balance, balanceAfterFirst, "a second withdrawal must not pay out again");
        assertEq(locker.getContractBalance(), 0, "contract must stay empty");
    }

    function test_Withdraw_AfterUnlock_ThenRevertsWhenCalledByOtherUser() public {
        vm.deal(alice, 5 ether);
        vm.prank(alice);
        uint256 lockId = locker.createLock{value: ONE_ETH}(15 days);

        _advance(15 days);
        vm.prank(alice);
        locker.withdraw(lockId);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(ZeroGLocker.NotLockOwner.selector, lockId, bob));
        locker.withdraw(lockId);
    }

    function test_Withdraw_SettlesEachLockIndependently() public {
        vm.deal(alice, 20 ether);
        vm.warp(10_000);

        vm.startPrank(alice);
        uint256 shortLock = locker.createLock{value: 1 ether}(15 days);
        uint256 longLock = locker.createLock{value: 2 ether}(90 days);
        vm.stopPrank();

        vm.warp(10_000 + 15 days);
        vm.prank(alice);
        locker.withdraw(shortLock);

        assertEq(alice.balance, 20 ether - 2 ether, "only the matured lock may be settled");
        assertEq(locker.getUserLockedBalance(alice), 2 ether, "the long lock must remain active");
        assertEq(locker.getTotalLocked(), 2 ether, "total locked must reflect the remaining lock");

        vm.warp(10_000 + 90 days);
        vm.prank(alice);
        locker.withdraw(longLock);

        assertEq(alice.balance, 20 ether, "both locks must settle at full value");
        assertEq(locker.getUserLockedBalance(alice), 0, "no active value may remain");
    }

    function test_Withdraw_RevertsWhenRecipientRejectsTransfer() public {
        ZeroGLocker fresh = new ZeroGLocker();
        PayoutRejecter rejecter = new PayoutRejecter(fresh);

        vm.deal(address(rejecter), 1 ether);
        uint256 lockId = rejecter.openLock{value: 1 ether}(15 days);

        _advance(15 days);
        vm.expectRevert(abi.encodeWithSelector(ZeroGLocker.NativeTransferFailed.selector, lockId, address(rejecter), 1 ether));
        rejecter.withdrawExternal(lockId);

        assertEq(fresh.getTotalLocked(), 1 ether, "a failed payout must roll back the accounting");
        assertEq(fresh.getContractBalance(), 1 ether, "value must remain in the contract");
    }

    // =========================================================================
    // Reentrancy
    // =========================================================================

    function test_Reentrancy_CannotDrainASecondLock() public {
        ZeroGLocker fresh = new ZeroGLocker();
        ReentrancyAttacker attacker = new ReentrancyAttacker(fresh);

        vm.deal(address(attacker), 10 ether);
        attacker.openLocks{value: 1 ether}(15 days, 1 ether);
        attacker.openLocks{value: 2 ether}(15 days, 2 ether);

        assertEq(fresh.getTotalLocked(), 3 ether, "attacker must have two funded locks");

        _advance(15 days);

        // The first withdrawal pays out and the `receive` hook tries to take the
        // second lock during the same call frame.
        attacker.withdrawExternal(1);

        assertTrue(attacker.reentryAttempted(), "the attacker must have attempted re-entry");
        assertTrue(attacker.reentryReverted(), "re-entry must revert");
        assertFalse(attacker.reentrySucceeded(), "re-entry must never succeed");

        bytes4 selector = bytes4(attacker.reentryErrorData());
        assertEq(
            selector,
            ReentrancyGuard.ReentrancyGuardReentrantCall.selector,
            "re-entry must revert with the reentrancy guard error"
        );

        assertEq(attacker.received(), 1 ether, "only the first lock may be paid out");
        assertEq(fresh.getTotalLocked(), 2 ether, "the second lock must remain fully accounted for");
        assertEq(fresh.getContractBalance(), 2 ether, "value must not leave the contract through re-entry");

        // The second lock is still perfectly withdrawable afterwards.
        attacker.withdrawExternal(2);
        assertEq(attacker.received(), 3 ether, "both locks settle normally, one at a time");
        assertEq(fresh.getContractBalance(), 0, "contract must be empty once settled");
    }

    function test_Reentrancy_CreateLockIsAlsoGuarded() public {
        ZeroGLocker fresh = new ZeroGLocker();
        ReentrancyAttacker attacker = new ReentrancyAttacker(fresh);

        vm.deal(address(attacker), 10 ether);
        attacker.openLocks{value: 1 ether}(15 days, 1 ether);
        attacker.openLocks{value: 2 ether}(15 days, 2 ether);

        _advance(15 days);
        attacker.withdrawExternal(1);

        // The reentrant call must not have created any additional lock.
        assertEq(fresh.getLockCount(), 2, "re-entry must not create locks");
        assertEq(attacker.lockCount(), 2, "attacker must still own exactly two locks");
    }

    function test_ReentrancyGuard_BlocksNestedCreateLock() public {
        ZeroGLocker fresh = new ZeroGLocker();
        CreateLockReentrancy attacker = new CreateLockReentrancy(fresh);

        vm.deal(address(attacker), 5 ether);
        attacker.openLock{value: 1 ether}(15 days);

        _advance(15 days);
        attacker.withdrawExternal(1);

        assertTrue(attacker.reentryAttempted(), "the attacker must have attempted re-entry");
        assertTrue(attacker.reentryReverted(), "re-entry into createLock must revert");
        assertEq(
            bytes4(attacker.reentryErrorData()),
            ReentrancyGuard.ReentrancyGuardReentrantCall.selector,
            "the guard must fire before the function body"
        );

        assertEq(fresh.getLockCount(), 1, "re-entry must not create a second lock");
        assertEq(fresh.getContractBalance(), 0, "contract must be empty");
    }

    // =========================================================================
    // Accounting and invariants
    // =========================================================================

    function test_Accounting_ContractBalanceAlwaysMatchesTotalLocked() public {
        vm.deal(alice, 50 ether);
        vm.deal(bob, 50 ether);

        vm.prank(alice);
        uint256 a1 = locker.createLock{value: 5 ether}(15 days);
        vm.prank(bob);
        uint256 b1 = locker.createLock{value: 7 ether}(60 days);
        vm.prank(alice);
        uint256 a2 = locker.createLock{value: 1 ether}(365 days);

        _assertInvariants(alice, bob);

        _advance(15 days);
        vm.prank(alice);
        locker.withdraw(a1);
        _assertInvariants(alice, bob);

        _advance(45 days);
        vm.prank(bob);
        locker.withdraw(b1);
        _assertInvariants(alice, bob);

        _advance(305 days);
        vm.prank(alice);
        locker.withdraw(a2);
        _assertInvariants(alice, bob);

        assertEq(locker.getContractBalance(), 0, "contract must be empty at the end");
        assertEq(locker.getTotalLocked(), 0, "total locked must be zero at the end");
    }

    function test_Accounting_WithdrawalsReturnExactlyTheDepositedAmount() public {
        uint256[3] memory amounts = [uint256(0.1 ether), 1 ether, 123.456789 ether];
        uint256 initialBalance = 10_000 ether;

        vm.deal(alice, initialBalance);

        for (uint256 i = 0; i < amounts.length; ++i) {
            uint256 beforeLock = alice.balance;
            vm.prank(alice);
            uint256 lockId = locker.createLock{value: amounts[i]}(15 days);
            assertEq(alice.balance, beforeLock - amounts[i], "the debit must equal the lock amount exactly");

            _advance(15 days);
            uint256 beforeWithdraw = alice.balance;
            vm.prank(alice);
            locker.withdraw(lockId);
            assertEq(
                alice.balance, beforeWithdraw + amounts[i], "the credit must equal the locked amount, with no reward"
            );
        }

        assertEq(alice.balance, initialBalance, "alice ends with her full balance back");
        assertEq(locker.getContractBalance(), 0, "no value may remain in the contract");
    }

    function test_Accounting_NoRewardsAreEverPaid() public {
        vm.deal(alice, 100 ether);
        vm.warp(1_000);
        vm.prank(alice);
        uint256 lockId = locker.createLock{value: 1 ether}(15 days);

        uint256 unlockTime = 1_000 + 15 days;
        vm.warp(unlockTime + 10_000 days);
        vm.prank(alice);
        locker.withdraw(lockId);

        assertEq(alice.balance, 100 ether, "only the principal is ever returned, decades later");
        assertEq(locker.getContractBalance(), 0, "no surplus may remain");
        assertEq(locker.getTotalLocked(), 0, "accounting returns to zero");
    }

    function test_DirectTransfers_AreRejected() public {
        vm.deal(alice, 5 ether);

        vm.prank(alice);
        (bool ok,) = address(locker).call{value: 1 ether}("");
        assertFalse(ok, "a bare native transfer must revert");

        vm.prank(alice);
        (bool ok2,) = address(locker).call{value: 1 ether}(abi.encodeWithSignature("unknownFunction()"));
        assertFalse(ok2, "an unknown payable function must revert");

        assertEq(locker.getContractBalance(), 0, "the contract must hold no unattributed value");
        assertEq(locker.getTotalLocked(), 0, "total locked must stay consistent");
    }

    function test_NoPrivilegedFunctionsExist() public {
        vm.deal(alice, 5 ether);
        vm.prank(alice);
        locker.createLock{value: ONE_ETH}(15 days);

        // Every one of these must hit the fallback and revert. The contract has
        // no ownership, no admin role, no sweep and no confiscation path.
        bytes4[8] memory forbidden = [
            bytes4(keccak256("owner()")),
            bytes4(keccak256("renounceOwnership()")),
            bytes4(keccak256("transferOwnership(address)")),
            bytes4(keccak256("transfer(address,uint256)")),
            bytes4(keccak256("withdrawAll()")),
            bytes4(keccak256("sweep(address)")),
            bytes4(keccak256("emergencyWithdraw(address,uint256)")),
            bytes4(keccak256("pause()"))
        ];

        for (uint256 i = 0; i < forbidden.length; ++i) {
            (bool ok,) = address(locker).call(abi.encodePacked(forbidden[i]));
            assertFalse(ok, "privileged/absent selector must revert");
        }

        // And the stored bytecode must not contain a function capable of moving
        // an arbitrary balance on someone's behalf.
        bytes memory code = address(locker).code;
        bytes32 needle = bytes32(keccak256("withdrawAll()"));
        for (uint256 i = 0; i + 4 <= code.length; ++i) {
            if (
                bytes4(code[i]) == bytes4(needle) || bytes4(code[i]) == bytes4(keccak256("sweep(address)"))
                    || bytes4(code[i]) == bytes4(keccak256("emergencyWithdraw(address,uint256)"))
            ) {
                revert("forbidden selector present in deployed bytecode");
            }
        }
    }

    function test_IsWithdrawable_ReflectsState() public {
        vm.deal(alice, 5 ether);
        vm.deal(bob, 5 ether);
        vm.warp(1_000);

        vm.prank(alice);
        uint256 lockId = locker.createLock{value: ONE_ETH}(15 days);

        vm.prank(alice);
        assertFalse(locker.isWithdrawable(lockId), "not withdrawable before maturity");
        vm.prank(alice);
        assertFalse(locker.isWithdrawable(1_000), "unknown ids are never withdrawable");

        vm.warp(1_000 + 15 days);
        vm.prank(alice);
        assertTrue(locker.isWithdrawable(lockId), "withdrawable at maturity");
        vm.prank(bob);
        assertFalse(locker.isWithdrawable(lockId), "only the owner sees it as withdrawable");

        vm.prank(alice);
        locker.withdraw(lockId);
        vm.prank(alice);
        assertFalse(locker.isWithdrawable(lockId), "withdrawable only once");
    }

    // =========================================================================
    // Fuzzing
    // =========================================================================

    function testFuzz_CreateLock_StoresExactValue(uint96 rawAmount, uint8 durationIndex) public {
        uint256 amount = bound(uint256(rawAmount), 1, 1_000_000 ether);
        uint256 duration = expectedDurations[bound(durationIndex, 0, 5)];
        vm.deal(alice, amount);

        uint256 startTime = bound(block.timestamp, 1, 4_000_000_000);
        vm.warp(startTime);

        vm.prank(alice);
        uint256 lockId = locker.createLock{value: amount}(duration);

        ZeroGLocker.Lock memory lock = locker.getLock(lockId);
        assertEq(lock.owner, alice, "fuzz: owner");
        assertEq(lock.amount, amount, "fuzz: exact value stored");
        assertEq(lock.startTime, startTime, "fuzz: start time");
        assertEq(lock.unlockTime, startTime + duration, "fuzz: unlock time");
        assertEq(locker.getTotalLocked(), amount, "fuzz: total locked");
        assertEq(locker.getContractBalance(), amount, "fuzz: balance consistency");
    }

    function testFuzz_Withdraw_ReturnsExactlyWhatWasLocked(uint96 rawAmount, uint8 durationIndex) public {
        uint256 amount = bound(uint256(rawAmount), 1, 1_000_000 ether);
        uint256 duration = expectedDurations[bound(durationIndex, 0, 5)];

        vm.deal(alice, amount);
        vm.prank(alice);
        uint256 lockId = locker.createLock{value: amount}(duration);

        uint256 extraWait = bound(block.timestamp, 0, 1_000_000_000);
        _advance(duration + extraWait);

        vm.prank(alice);
        locker.withdraw(lockId);

        assertEq(alice.balance, amount, "fuzz: principal returned in full, with no reward");
        assertEq(locker.getContractBalance(), 0, "fuzz: contract drained");
    }

    function testFuzz_Withdraw_BeforeUnlockAlwaysReverts(uint96 rawAmount, uint8 durationIndex, uint32 offset) public {
        uint256 amount = bound(uint256(rawAmount), 1, 1_000_000 ether);
        uint256 duration = expectedDurations[bound(durationIndex, 1, 5)];

        _advance(_FIXED_START - _now());
        uint256 startTime = _now();

        vm.deal(alice, amount);
        vm.prank(alice);
        uint256 lockId = locker.createLock{value: amount}(duration);

        uint256 wait = bound(uint256(offset), 0, duration - 1);
        _advance(wait);
        uint256 elapsed = block.timestamp - startTime;

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                ZeroGLocker.LockNotExpired.selector, lockId, startTime + duration, startTime + elapsed
            )
        );
        locker.withdraw(lockId);
    }

    function testFuzz_TotalLockedEqualsContractBalance(uint96[4] memory amounts, uint8[4] memory indices) public {
        uint256 expectedTotal;

        for (uint256 i = 0; i < 4; ++i) {
            uint256 amount = bound(uint256(amounts[i]), 1, 1_000 ether);
            uint256 duration = expectedDurations[bound(indices[i], 0, 5)];
            vm.deal(alice, amount);
            vm.prank(alice);
            locker.createLock{value: amount}(duration);
            expectedTotal += amount;
        }

        assertEq(locker.getTotalLocked(), expectedTotal, "fuzz: total locked matches deposits");
        assertEq(locker.getContractBalance(), expectedTotal, "fuzz: contract balance matches deposits");
        assertEq(locker.getUserLockedBalance(alice), expectedTotal, "fuzz: user balance matches deposits");
    }

    function testFuzz_NoAmountIsLostOrCreatedAcrossManyLocks(uint8 countSeed, uint8 durationSeed) public {
        uint256 count = bound(countSeed, 1, 20);
        uint256 expectedTotal;
        uint256[] memory ids = new uint256[](count);

        vm.deal(alice, 10_000 ether);
        vm.deal(bob, 10_000 ether);

        for (uint256 i = 0; i < count; ++i) {
            uint256 amount = (i + 1) * 0.01 ether;
            uint256 duration = expectedDurations[(uint256(durationSeed) + i) % 6];
            address user = i % 2 == 0 ? alice : bob;
            vm.prank(user);
            ids[i] = locker.createLock{value: amount}(duration);
            expectedTotal += amount;
        }

        assertEq(locker.getContractBalance(), expectedTotal, "fuzz: conservation of value on deposit");

        // Settle everything in a single far-future block.
        _advance(365 days + 1);
        for (uint256 i = 0; i < count; ++i) {
            address user = i % 2 == 0 ? alice : bob;
            vm.prank(user);
            locker.withdraw(ids[i]);
        }

        assertEq(locker.getContractBalance(), 0, "fuzz: all value returned");
        assertEq(locker.getTotalLocked(), 0, "fuzz: accounting returns to zero");
        assertEq(alice.balance, 10_000 ether, "fuzz: alice made whole");
        assertEq(bob.balance, 10_000 ether, "fuzz: bob made whole");
    }

    function testFuzz_RevertForArbitraryInvalidDuration(uint256 duration) public {
        vm.assume(duration != 0);
        bool supported;
        for (uint256 i = 0; i < expectedDurations.length; ++i) {
            if (expectedDurations[i] == duration) supported = true;
        }
        vm.assume(!supported);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ZeroGLocker.UnsupportedDuration.selector, duration));
        locker.createLock{value: 1 ether}(duration);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /// @dev Current chain clock.
    function _now() private view returns (uint256 timestamp) {
        return block.timestamp;
    }

    /// @dev Moves the chain clock forward by `delta` seconds.
    function _advance(uint256 delta) private {
        vm.warp(_now() + delta);
    }

    function _lockWithdrawn(uint256 lockId) private view returns (bool withdrawn) {
        return locker.getLock(lockId).withdrawn;
    }

    function _assertInvariants(address userA, address userB) private view {
        assertEq(
            locker.getContractBalance(), locker.getTotalLocked(), "invariant: balance equals total locked"
        );
        assertEq(
            locker.getUserLockedBalance(userA) + locker.getUserLockedBalance(userB),
            locker.getTotalLocked(),
            "invariant: user balances sum to total locked"
        );
    }
}
