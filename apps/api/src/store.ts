import type { AgentProfile, Bounty, ProofSummary, Submission } from "@0g-databounty/shared";
import { ZERO_G_MAINNET } from "@0g-databounty/shared";
import { config } from "./config.js";

const bounties = new Map<string, Bounty>();
const submissions = new Map<string, Submission>();

export const store = {
  listBounties() {
    return [...bounties.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  getBounty(id: string) {
    return bounties.get(id);
  },
  saveBounty(bounty: Bounty) {
    bounties.set(bounty.id, bounty);
    return bounty;
  },
  listSubmissions(bountyId?: string) {
    return [...submissions.values()]
      .filter((submission) => !bountyId || submission.bountyId === bountyId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  getSubmission(id: string) {
    return submissions.get(id);
  },
  saveSubmission(submission: Submission) {
    submissions.set(submission.id, submission);
    return submission;
  },
  agents(): AgentProfile[] {
    const configured = Boolean(config.validatorPrivateKey && config.computeProvider);
    return [
      {
        id: "quality-sentinel",
        name: "Quality Sentinel",
        wallet: configured ? "validator-wallet-configured-server-side" : "0x0000000000000000000000000000000000000000",
        role: "validator",
        status: configured ? "ready" : "unavailable",
        notes: configured
          ? "Validator is configured to call 0G Compute and attach reports."
          : "Set VALIDATOR_PRIVATE_KEY and ZERO_G_COMPUTE_PROVIDER to enable validation."
      },
      {
        id: "storage-keeper",
        name: "Storage Keeper",
        wallet: "0G Storage SDK",
        role: "storage",
        status: config.enableRealStorage ? "ready" : "unavailable",
        notes: config.enableRealStorage
          ? "0G Storage uploads are enabled."
          : "ZERO_G_ENABLE_REAL_STORAGE must be true before uploads are accepted."
      }
    ];
  },
  proofSummary(): ProofSummary {
    const recentTransactions = [...bounties.values()]
      .flatMap((bounty) =>
        bounty.createdTxHash
          ? [
              {
                label: `Bounty ${bounty.id}`,
                txHash: bounty.createdTxHash,
                url: `${ZERO_G_MAINNET.explorerUrl}/tx/${bounty.createdTxHash}`
              }
            ]
          : []
      )
      .concat(
        [...submissions.values()].flatMap((submission) =>
          submission.submittedTxHash
            ? [
                {
                  label: `Submission ${submission.id}`,
                  txHash: submission.submittedTxHash,
                  url: `${ZERO_G_MAINNET.explorerUrl}/tx/${submission.submittedTxHash}`
                }
              ]
            : []
        )
      );

    const storageRoots = [
      ...[...bounties.values()].map((bounty) => ({
        label: `Bounty metadata ${bounty.id}`,
        rootHash: bounty.metadataRoot,
        txHash: bounty.storageProof?.txHash
      })),
      ...[...submissions.values()].map((submission) => ({
        label: `Dataset ${submission.id}`,
        rootHash: submission.datasetRoot,
        txHash: submission.storageProof?.txHash
      }))
    ];

    const computeReports = [...submissions.values()].flatMap((submission) =>
      submission.validationReportRoot && submission.score !== undefined
        ? [
            {
              label: `Validation ${submission.id}`,
              reportRoot: submission.validationReportRoot,
              score: submission.score,
              validatorAgent: "quality-sentinel"
            }
          ]
        : []
    );

    return {
      chainId: ZERO_G_MAINNET.chainId,
      contractAddress: config.contractAddress,
      explorerUrl: ZERO_G_MAINNET.explorerUrl,
      storageIndexer: config.storageIndexer,
      recentTransactions,
      storageRoots,
      computeReports
    };
  }
};
