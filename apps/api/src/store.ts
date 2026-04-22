import type { Bounty, ProofSummary, Submission } from "@0g-databounty/shared";
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
  },
  examples() {
    return {
      bounty: {
        title: "APAC agent-training dataset",
        summary: "Public, sourced records for AI x Web3 projects, builders, tooling, and use cases across APAC.",
        requirements:
          "Provide structured records for active APAC AI x Web3 projects. Each row must include project name, region, category, source URL, public project link, short description, and why the record is useful for an agent builder.",
        formats: ["json", "csv"],
        evaluationRubric:
          "Score completeness, source quality, duplicate resistance, region relevance, usefulness for agent workflows, and licensing clarity. Reject private personal data and unverifiable claims.",
        privacyNotes:
          "Use public project information only. Do not include private emails, phone numbers, wallet doxxing, leaked data, or non-public personal data.",
        deadlineIso: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      dataset: {
        title: "APAC AI x Web3 project sample",
        description:
          "A structured starter dataset containing public ecosystem records, source notes, schema fields, and sample rows for validator-agent review.",
        license: "CC-BY-4.0",
        format: "json",
        recordCount: 25,
        sampleRows: [
          {
            project: "Example AI Agent Marketplace",
            region: "Singapore",
            category: "Agent commerce",
            source: "https://example.com/public-project-page",
            usefulness: "Useful for mapping agent-service demand in APAC."
          }
        ],
        sourceNotes:
          "Records are sourced only from public project websites, ecosystem pages, GitHub repositories, and public X posts.",
        privacyDeclaration:
          "This dataset contains public project information only and excludes private personal data."
      }
    };
  }
};
