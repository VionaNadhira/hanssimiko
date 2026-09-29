# Hanssimiko Bunker

**Non-custodial timelock vault for native 0G on 0G Chain (Mainnet)**

Hanssimiko Bunker is a decentralized application that allows users to lock their native **0G tokens** in a self-custodial smart contract with a configurable time lock. Funds can only be withdrawn after the chosen lock period expires — no admin keys, no backdoors.

---

## Features

- **Create locks** — choose amount and lock duration (1 day to 4 years)
- **My Locks** — view all your active and expired locks
- **History** — full on-chain event history (deposits and withdrawals)
- **Overview** — global lock stats on 0G Mainnet
- **WalletConnect** — supports MetaMask, Rainbow, and 400+ wallets
- **Built on 0G Chain** — fast, low-cost EVM-compatible L1

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | [Next.js 15](https://nextjs.org/) (App Router) |
| Styling | Tailwind CSS v4 |
| Wallet | [Reown AppKit](https://reown.com/) + Wagmi |
| Chain Interaction | [viem](https://viem.sh/) |
| Smart Contract | Solidity 0.8.26 (Foundry) |
| Deployment | Railway |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (for contract work only)

### 1. Clone the repo

```bash
git clone https://github.com/VionaNadhira/hanssimiko.git
cd hanssimiko
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env`:

```env
# Smart contract deployment (Foundry CLI - server side only)
DEPLOYER_PRIVATE_KEY=0x...
ZERO_G_RPC_URL=https://evmrpc.0g.ai
ZERO_G_CHAIN_ID=16661
ZERO_G_EXPLORER_URL=https://chainscan.0g.ai
ZERO_G_LOCKER_ADDRESS=0x...

# Next.js frontend (browser-accessible)
NEXT_PUBLIC_ZERO_G_RPC_URL=https://evmrpc.0g.ai
NEXT_PUBLIC_ZERO_G_LOCKER_ADDRESS=0x...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_ZERO_G_DEPLOY_BLOCK=45611985
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Smart Contract

The `ZeroGLocker` contract is located in `contracts/ZeroGLocker.sol`.

### Build and test

```bash
npm run contracts:build   # forge build
npm run contracts:test    # forge test -vv
```

### Deploy

```bash
forge script script/DeployZeroGLocker.s.sol \
  --rpc-url mainnet \
  --broadcast \
  --verify
```

After deployment, update `NEXT_PUBLIC_ZERO_G_LOCKER_ADDRESS` and `NEXT_PUBLIC_ZERO_G_DEPLOY_BLOCK` in your `.env`, then redeploy the frontend.

---

## Deploy on Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) -> **New Project** -> **Deploy from GitHub repo**
3. Select this repository
4. In **Variables**, add all `NEXT_PUBLIC_*` variables from your `.env`
5. Set the **Start Command** to: `npm run start`
6. Set the **Build Command** to: `npm run build`
7. Railway will auto-deploy on every push to `main`

> **Note:** Do NOT add `DEPLOYER_PRIVATE_KEY` to Railway environment variables — it is only needed locally for contract deployment.

---

## Project Structure

```
hanssimiko/
├── contracts/           # Solidity smart contracts
├── script/              # Foundry deploy scripts
├── test/                # Foundry tests
├── src/
│   ├── app/             # Next.js App Router pages
│   ├── components/      # React UI components
│   ├── config/          # Chain and contract config
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Wagmi / viem setup
│   └── abi/             # Generated ABI files
├── public/              # Static assets
├── .env.example         # Environment template
└── foundry.toml         # Foundry configuration
```

---

## 0G Chain Info

| Field | Value |
|---|---|
| Network | 0G Mainnet (Aristotle) |
| Chain ID | 16661 |
| Symbol | 0G |
| RPC | https://evmrpc.0g.ai |
| Explorer | https://chainscan.0g.ai |
| Faucet | https://faucet.0g.ai |

---

## License

MIT
