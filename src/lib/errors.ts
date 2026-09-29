/**
 * Turns a viem or wallet error into a sentence a user can act on.
 *
 * The contract reverts with named custom errors, so the message can be
 * specific: a rejected duration and a rejected zero deposit are very different
 * problems and should not read the same to the person fixing them.
 */
export function readableError(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;

  const candidate = error as {shortMessage?: string; message?: string; name?: string};
  const short = candidate.shortMessage ?? '';
  const name = candidate.name ?? '';

  if (name === 'UserRejectedRequestError' || /rejected|denied|cancell?ed/i.test(short)) {
    return 'You rejected the request in your wallet.';
  }
  if (/insufficient funds/i.test(short)) {
    return 'Your wallet does not hold enough 0G to cover the deposit and the network fee.';
  }
  if (/UnsupportedDuration/.test(short)) {
    return 'The contract rejected this term. Only 15, 30, 60, 90, 180 and 365 day locks exist.';
  }
  if (/ZeroAmount/.test(short)) {
    return 'The contract rejected a zero-value deposit.';
  }
  if (/AlreadyWithdrawn/.test(short)) {
    return 'This lock has already been settled.';
  }
  if (/LockNotExpired/.test(short)) {
    return 'The unlock timestamp has not been reached yet.';
  }
  if (/NotLockOwner/.test(short)) {
    return 'This lock belongs to a different address.';
  }
  if (/LockNotFound/.test(short)) {
    return 'This lock does not exist.';
  }
  if (/DirectTransferNotAllowed/.test(short)) {
    return 'The contract only accepts 0G through createLock.';
  }
  if (/intrinsic gas too low|out of gas/i.test(short)) {
    return 'The network fee limit was too low. Try again.';
  }
  if (/could not coalesce error|execution reverted/i.test(short)) {
    return 'The transaction would revert. Check the amount and the term, then try again.';
  }

  if (short) return short;
  if (candidate.message) return candidate.message;
  return 'Unknown error';
}
