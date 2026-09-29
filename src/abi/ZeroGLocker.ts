// GENERATED FILE — DO NOT EDIT BY HAND.
// Regenerate with `forge build && npm run abi`.
// Source: contracts/ZeroGLocker.sol

/**
 * ABI of `ZeroGLocker`, generated from the compiled Foundry artifact.
 * Kept as a literal so wagmi/viem get exact ABI types without runtime parsing.
 */
export const ZERO_G_LOCKER_ABI = [
    {
      "type": "constructor",
      "inputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "error",
      "name": "AlreadyWithdrawn",
      "inputs": [
        {
          "name": "lockId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "DirectTransferNotAllowed",
      "inputs": []
    },
    {
      "type": "error",
      "name": "LockNotExpired",
      "inputs": [
        {
          "name": "lockId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "unlockTime",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "currentTime",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "LockNotFound",
      "inputs": [
        {
          "name": "lockId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "NativeTransferFailed",
      "inputs": [
        {
          "name": "lockId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "recipient",
          "type": "address",
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "NotLockOwner",
      "inputs": [
        {
          "name": "lockId",
          "type": "uint256",
          "internalType": "uint256"
        },
        {
          "name": "caller",
          "type": "address",
          "internalType": "address"
        }
      ]
    },
    {
      "type": "error",
      "name": "ReentrancyGuardReentrantCall",
      "inputs": []
    },
    {
      "type": "error",
      "name": "UnsupportedDuration",
      "inputs": [
        {
          "name": "duration",
          "type": "uint256",
          "internalType": "uint256"
        }
      ]
    },
    {
      "type": "error",
      "name": "ZeroAmount",
      "inputs": []
    },
    {
      "type": "event",
      "name": "LockCreated",
      "inputs": [
        {
          "name": "lockId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "owner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "startTime",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "unlockTime",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "duration",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "LockerDeployed",
      "inputs": [
        {
          "name": "locker",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        }
      ],
      "anonymous": false
    },
    {
      "type": "event",
      "name": "LockWithdrawn",
      "inputs": [
        {
          "name": "lockId",
          "type": "uint256",
          "indexed": true,
          "internalType": "uint256"
        },
        {
          "name": "owner",
          "type": "address",
          "indexed": true,
          "internalType": "address"
        },
        {
          "name": "amount",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "unlockTime",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        },
        {
          "name": "withdrawnAt",
          "type": "uint256",
          "indexed": false,
          "internalType": "uint256"
        }
      ],
      "anonymous": false
    },
    {
      "type": "fallback",
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "createLock",
      "inputs": [
        {
          "name": "duration",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "lockId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "payable"
    },
    {
      "type": "function",
      "name": "getContractBalance",
      "inputs": [],
      "outputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getLock",
      "inputs": [
        {
          "name": "lockId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "lock",
          "type": "tuple",
          "internalType": "struct ZeroGLocker.Lock",
          "components": [
            {
              "name": "owner",
              "type": "address",
              "internalType": "address"
            },
            {
              "name": "amount",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "startTime",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "unlockTime",
              "type": "uint256",
              "internalType": "uint256"
            },
            {
              "name": "withdrawn",
              "type": "bool",
              "internalType": "bool"
            }
          ]
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getLockCount",
      "inputs": [],
      "outputs": [
        {
          "name": "count",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getSupportedDurations",
      "inputs": [],
      "outputs": [
        {
          "name": "durations",
          "type": "uint256[]",
          "internalType": "uint256[]"
        }
      ],
      "stateMutability": "pure"
    },
    {
      "type": "function",
      "name": "getTotalLocked",
      "inputs": [],
      "outputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getUserLockCount",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "count",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getUserLockedBalance",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "amount",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "getUserLockIds",
      "inputs": [
        {
          "name": "user",
          "type": "address",
          "internalType": "address"
        }
      ],
      "outputs": [
        {
          "name": "lockIds",
          "type": "uint256[]",
          "internalType": "uint256[]"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "isSupportedDuration",
      "inputs": [
        {
          "name": "duration",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "supported",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "pure"
    },
    {
      "type": "function",
      "name": "isWithdrawable",
      "inputs": [
        {
          "name": "lockId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "withdrawable",
          "type": "bool",
          "internalType": "bool"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "timeUntilUnlock",
      "inputs": [
        {
          "name": "lockId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [
        {
          "name": "remaining",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "stateMutability": "view"
    },
    {
      "type": "function",
      "name": "withdraw",
      "inputs": [
        {
          "name": "lockId",
          "type": "uint256",
          "internalType": "uint256"
        }
      ],
      "outputs": [],
      "stateMutability": "nonpayable"
    },
    {
      "type": "receive",
      "stateMutability": "payable"
    }
  ] as const;

export type ZeroGLockerAbi = typeof ZERO_G_LOCKER_ABI;
