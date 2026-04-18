import { BrowserProvider, ContractTransactionResponse, Interface } from "ethers";
import { dataBountyAbi } from "@0g-databounty/shared";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) throw new Error("Install an EVM wallet to use 0G DataBounty.");
  const provider = new BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0];
}

export async function sendPreparedTransaction(tx: { to?: string; value: string; data: string }) {
  if (!tx.to) throw new Error("Contract address is not configured.");
  if (!window.ethereum) throw new Error("Install an EVM wallet to send transactions.");

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const sent = (await signer.sendTransaction({
    to: tx.to,
    value: BigInt(tx.value || "0"),
    data: tx.data
  })) as ContractTransactionResponse;
  const receipt = await sent.wait();
  if (!receipt) throw new Error("Transaction was not mined.");
  return { txHash: sent.hash, receipt };
}

export function parseCreatedBountyId(logs: Array<{ topics: string[]; data: string }>) {
  const iface = new Interface(dataBountyAbi);
  for (const log of logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "BountyCreated") return parsed.args.bountyId.toString();
    } catch {}
  }
  return undefined;
}
