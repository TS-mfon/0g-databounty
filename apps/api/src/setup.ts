import { ethers } from "ethers";
import type { AgentProfile, SetupStatus } from "@0g-databounty/shared";
import { ZERO_G_MAINNET } from "@0g-databounty/shared";
import { config } from "./config.js";

const STORAGE_MINIMUM = ethers.parseEther("0.001");
const CONTRACT_MINIMUM = ethers.parseEther("0.02");
const COMPUTE_MINIMUM = ethers.parseEther("0.01");

function formatOg(balanceWei: bigint) {
  return Number(ethers.formatEther(balanceWei)).toFixed(6);
}

export async function getSetupStatus(): Promise<SetupStatus> {
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signerAddress = config.validatorPrivateKey ? new ethers.Wallet(config.validatorPrivateKey).address : undefined;
  const signerBalanceWei = signerAddress ? await provider.getBalance(signerAddress) : undefined;
  const signerBalanceOg = signerBalanceWei !== undefined ? formatOg(signerBalanceWei) : undefined;

  const contract =
    config.contractAddress
      ? {
          state: "ready" as const,
          label: "Contract configured",
          note: "The 0G mainnet contract address is configured for the API and frontend.",
          address: config.contractAddress
        }
      : {
          state: signerBalanceWei !== undefined && signerBalanceWei >= CONTRACT_MINIMUM ? ("configured" as const) : ("needs_funding" as const),
          label: "Contract deployment pending",
          note: signerBalanceWei !== undefined && signerBalanceWei >= CONTRACT_MINIMUM
            ? "The deployer wallet is funded enough to broadcast a 0G mainnet deployment, but no contract address has been configured yet."
            : `The deployer wallet needs at least ${ethers.formatEther(CONTRACT_MINIMUM)} 0G before a safe mainnet deployment can be broadcast.`,
          address: undefined
        };

  const storage =
    !signerAddress
      ? {
          state: "missing" as const,
          label: "Storage signer missing",
          note: "The backend does not have a validator signer configured for 0G Storage uploads."
        }
      : !config.enableRealStorage
        ? {
            state: "configured" as const,
            label: "Storage signer configured",
            note: `Signer ${signerAddress} is configured, but live 0G Storage uploads are currently paused in backend settings.`
          }
        : signerBalanceWei !== undefined && signerBalanceWei < STORAGE_MINIMUM
          ? {
              state: "needs_funding" as const,
              label: "Storage funding required",
              note: `Signer ${signerAddress} only has ${signerBalanceOg} 0G. Uploads should be funded above ${ethers.formatEther(STORAGE_MINIMUM)} 0G.`
            }
          : {
              state: "ready" as const,
              label: "Storage ready",
              note: `Signer ${signerAddress} is configured and live 0G Storage uploads are enabled.`
            };

  const compute =
    !signerAddress
      ? {
          state: "missing" as const,
          label: "Validator signer missing",
          note: "The validator agent cannot run until the backend signer is configured.",
          provider: config.computeProvider
        }
      : !config.computeProvider
        ? {
            state: "needs_provider" as const,
            label: "Compute provider required",
            note: `Signer ${signerAddress} is configured, but a 0G Compute provider has not been selected for validation jobs.`,
            provider: undefined
          }
        : !config.enableRealCompute
          ? {
              state: "configured" as const,
              label: "Compute pipeline configured",
              note: `Provider ${config.computeProvider} is configured, but live validation calls are paused in backend settings.`,
              provider: config.computeProvider
            }
          : signerBalanceWei !== undefined && signerBalanceWei < COMPUTE_MINIMUM
            ? {
                state: "needs_funding" as const,
                label: "Compute funding required",
                note: `Signer ${signerAddress} has ${signerBalanceOg} 0G, which is too low for reliable 0G Compute usage.`,
                provider: config.computeProvider
              }
            : {
                state: "ready" as const,
                label: "Compute ready",
                note: `Provider ${config.computeProvider} is configured and live validation calls are enabled.`,
                provider: config.computeProvider
              };

  return {
    network: ZERO_G_MAINNET,
    signerAddress,
    signerBalanceWei: signerBalanceWei?.toString(),
    signerBalanceOg,
    contract,
    storage,
    compute
  };
}

export async function getAgentProfiles(): Promise<AgentProfile[]> {
  const setup = await getSetupStatus();
  const wallet = setup.signerAddress ?? "not configured";
  return [
    {
      id: "quality-sentinel",
      name: "Quality Sentinel",
      wallet,
      role: "validator",
      status: setup.compute.state,
      notes: setup.compute.note
    },
    {
      id: "storage-keeper",
      name: "Storage Keeper",
      wallet,
      role: "storage",
      status: setup.storage.state,
      notes: setup.storage.note
    },
    {
      id: "settlement-engine",
      name: "Settlement Engine",
      wallet: wallet,
      role: "settlement",
      status: setup.contract.state,
      notes: setup.contract.note
    }
  ];
}
