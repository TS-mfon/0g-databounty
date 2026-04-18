# 0G DataBounty

0G DataBounty is a verifiable dataset bounty market for AI builders. Teams post dataset needs, contributors upload dataset manifests to 0G Storage, validator agents score submissions through 0G Compute, and accepted work settles on 0G Chain.

This is not a judging or leaderboard site. It is an ecosystem utility for sourcing the data that AI agents, model trainers, and research teams need.

## Hackathon Fit

- **Primary track:** Agentic Economy & Autonomous Applications
- **Secondary tracks:** Agentic Infrastructure, Privacy & Sovereign Infrastructure
- **0G components:** 0G Chain, 0G Storage, 0G Compute, Agent ID, Privacy / Secure Execution

## Architecture

```text
Contributor browser
  -> Next.js app on Vercel
  -> Render API
  -> 0G Storage upload adapter
  -> 0G Compute validator adapter
  -> DataBountyRegistry on 0G Mainnet
  -> Proof Center shows ChainScan + Storage roots + Compute report status
```

## Core Flow

1. A creator defines a dataset bounty and escrows 0G on the `DataBountyRegistry` contract.
2. The API uploads the bounty metadata manifest to 0G Storage.
3. A contributor uploads a dataset manifest to 0G Storage and submits the root hash onchain.
4. A validator agent reviews the manifest with 0G Compute and stores the validation report root.
5. The creator accepts a submission, releasing the escrowed reward on 0G Chain.

## 0G Mainnet Settings

- Chain ID: `16661`
- RPC: `https://evmrpc.0g.ai`
- Storage Indexer: `https://indexer-storage-turbo.0g.ai`
- Explorer: `https://chainscan.0g.ai`

## Local Setup

```bash
npm install
cp .env.example .env
npm run build
npm run test:contracts
npm run dev:api
npm run dev:web
```

The app does not fabricate 0G proofs. Real Storage and Compute actions require funded 0G credentials and these flags:

```bash
ZERO_G_ENABLE_REAL_STORAGE=true
ZERO_G_ENABLE_REAL_COMPUTE=true
VALIDATOR_PRIVATE_KEY=...
ZERO_G_COMPUTE_PROVIDER=...
ZERO_G_COMPUTE_SECRET=...
```

## Deployment

### Contract

```bash
PRIVATE_KEY=... npm run deploy:contract
```

After deployment, set:

```bash
DATABOUNTY_CONTRACT=<0G mainnet address>
NEXT_PUBLIC_DATABOUNTY_CONTRACT=<0G mainnet address>
```

### Render API

Deploy `apps/api`.

Required environment variables:

- `DATABASE_URL`
- `CORS_ORIGIN`
- `ZERO_G_RPC_URL`
- `ZERO_G_STORAGE_INDEXER`
- `DATABOUNTY_CONTRACT`
- `VALIDATOR_PRIVATE_KEY`
- `ZERO_G_COMPUTE_PROVIDER`
- `ZERO_G_COMPUTE_SECRET`

### Vercel Web

Deploy `apps/web`.

Required environment variables:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_0G_CHAIN_ID=16661`
- `NEXT_PUBLIC_0G_RPC_URL=https://evmrpc.0g.ai`
- `NEXT_PUBLIC_STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai`
- `NEXT_PUBLIC_DATABOUNTY_CONTRACT`

## Demo Video Walkthrough

1. Open the landing page and explain the vision: data markets for AI agents on 0G.
2. Open Marketplace and show the current live bounty state.
3. Create a bounty and show the Storage metadata root.
4. Submit a dataset manifest and show the Storage root.
5. Run validator agent scoring.
6. Open Proof Center and show contract address, Explorer links, Storage roots, and Compute report status.
7. Accept a submission and show the final ChainScan transaction.

## Submission Copy

**Project name:** 0G DataBounty

**Short description:** A verifiable dataset bounty market where AI teams fund data needs and validator agents score submissions using 0G Storage, Compute, and Chain.

**X post:**

> Introducing 0G DataBounty: a verifiable dataset bounty market for AI builders. Teams fund dataset needs, contributors upload datasets to 0G Storage, and validator agents score submissions with 0G Compute before settlement on 0G Chain. Built for real AI x Web3 data markets. #0GHackathon #BuildOn0G @0G_labs @0g_CN @0g_Eco @HackQuest_

## Security

Never commit real keys. Any key or token previously pasted into chat should be treated as exposed and rotated before serious deployment.
