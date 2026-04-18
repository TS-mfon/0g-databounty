# Architecture

```text
Vercel Next.js app
  | wallet tx
  v
0G Mainnet DataBountyRegistry

Vercel Next.js app
  | JSON API
  v
Render API
  | metadata/report upload
  v
0G Storage
  | validation prompt
  v
0G Compute provider
```

## Runtime Guarantees

- The frontend never receives server private keys.
- The backend refuses Storage uploads unless real 0G Storage is enabled.
- The backend refuses Compute validation unless real 0G Compute credentials are configured.
- Proof Center only renders records returned by the API.
- Contract settlement is native 0G escrow.

## Mainnet Constants

- Chain ID: `16661`
- RPC: `https://evmrpc.0g.ai`
- Storage Indexer: `https://indexer-storage-turbo.0g.ai`
- Explorer: `https://chainscan.0g.ai`
