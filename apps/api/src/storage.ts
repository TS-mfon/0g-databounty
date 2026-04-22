import { ethers } from "ethers";
import { config } from "./config.js";

export interface UploadResult {
  rootHash: string;
  txHash?: string;
  sizeBytes: number;
}

export async function uploadJsonTo0G(payload: unknown): Promise<UploadResult> {
  if (!config.validatorPrivateKey) {
    throw new Error("0G Storage signer is not configured on the backend.");
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(config.validatorPrivateKey, provider);
  const balance = await provider.getBalance(signer.address);
  if (!config.enableRealStorage) {
    throw new Error(`0G Storage signer ${signer.address} is configured, but live uploads are paused in backend settings.`);
  }
  if (balance < ethers.parseEther("0.001")) {
    throw new Error(`0G Storage signer ${signer.address} only has ${ethers.formatEther(balance)} 0G. Fund it before uploading proofs.`);
  }

  const encoded = new TextEncoder().encode(JSON.stringify(payload, null, 2));
  const sdk = (await import("@0gfoundation/0g-ts-sdk")) as any;
  const memData = new sdk.MemData(encoded);
  const [tree, treeErr] = await memData.merkleTree();
  if (treeErr !== null) throw new Error(`0G merkle tree error: ${treeErr}`);

  const indexer = new sdk.Indexer(config.storageIndexer);
  let tx;
  let uploadErr;
  try {
    [tx, uploadErr] = await indexer.upload(memData, config.rpcUrl, signer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("ETIMEDOUT")) {
      throw new Error("0G Storage indexer timed out while preparing the upload. Retry once the network path is stable.");
    }
    throw error;
  }
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
