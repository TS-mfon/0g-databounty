import { ethers } from "ethers";
import { config } from "./config.js";

export interface UploadResult {
  rootHash: string;
  txHash?: string;
  sizeBytes: number;
}

export async function uploadJsonTo0G(payload: unknown): Promise<UploadResult> {
  if (!config.enableRealStorage) {
    throw new Error("0G Storage is disabled. Set ZERO_G_ENABLE_REAL_STORAGE=true and provide a funded VALIDATOR_PRIVATE_KEY.");
  }
  if (!config.validatorPrivateKey) {
    throw new Error("VALIDATOR_PRIVATE_KEY is required for 0G Storage uploads.");
  }

  const encoded = new TextEncoder().encode(JSON.stringify(payload, null, 2));
  const sdk = (await import("@0gfoundation/0g-ts-sdk")) as any;
  const memData = new sdk.MemData(encoded);
  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr !== null) throw new Error(`0G merkle tree error: ${treeErr}`);

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(config.validatorPrivateKey, provider);
  const indexer = new sdk.Indexer(config.storageIndexer);
  const [tx, uploadErr] = await indexer.upload(memData, config.rpcUrl, signer);
  if (uploadErr !== null) throw new Error(`0G upload error: ${uploadErr}`);

  const rootHash = tx?.rootHash ?? tree?.rootHash?.();
  const txHash = tx?.txHash;
  if (!rootHash) throw new Error("0G upload completed without a root hash.");

  return {
    rootHash: String(rootHash),
    txHash: txHash ? String(txHash) : undefined,
    sizeBytes: encoded.byteLength
  };
}
