import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  rpcUrl: process.env.ZERO_G_RPC_URL ?? "https://evmrpc.0g.ai",
  storageIndexer: process.env.ZERO_G_STORAGE_INDEXER ?? "https://indexer-storage-turbo.0g.ai",
  contractAddress: process.env.DATABOUNTY_CONTRACT,
  validatorPrivateKey: process.env.VALIDATOR_PRIVATE_KEY,
  computeProvider: process.env.ZERO_G_COMPUTE_PROVIDER,
  computeSecret: process.env.ZERO_G_COMPUTE_SECRET,
  enableRealStorage: process.env.ZERO_G_ENABLE_REAL_STORAGE === "true",
  enableRealCompute: process.env.ZERO_G_ENABLE_REAL_COMPUTE === "true"
};
