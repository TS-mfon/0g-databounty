import { z } from "zod";

export const ZERO_G_MAINNET = {
  chainId: 16661,
  name: "0G Mainnet",
  currency: "0G",
  rpcUrl: "https://evmrpc.0g.ai",
  storageIndexer: "https://indexer-storage-turbo.0g.ai",
  explorerUrl: "https://chainscan.0g.ai"
} as const;

export const hashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Expected 32-byte hex hash");
export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Expected EVM address");

export const bountyMetadataSchema = z.object({
  title: z.string().min(6).max(90),
  summary: z.string().min(20).max(280),
  requirements: z.string().min(40).max(5000),
  formats: z.array(z.string().min(2).max(24)).min(1).max(8),
  evaluationRubric: z.string().min(40).max(4000),
  privacyNotes: z.string().max(2000).optional().default(""),
  deadlineIso: z.string().datetime(),
  creator: addressSchema.optional()
});

export const datasetManifestSchema = z.object({
  bountyId: z.string().min(1),
  contributor: addressSchema.optional(),
  title: z.string().min(6).max(90),
  description: z.string().min(30).max(2500),
  license: z.string().min(2).max(80),
  format: z.string().min(2).max(40),
  recordCount: z.number().int().nonnegative(),
  sampleRows: z.array(z.record(z.string(), z.unknown())).max(10),
  sourceNotes: z.string().min(20).max(2500),
  privacyDeclaration: z.string().min(10).max(2000)
});

export const validationReportSchema = z.object({
  bountyId: z.string(),
  submissionId: z.string(),
  validatorAgent: addressSchema,
  score: z.number().int().min(0).max(100),
  verdict: z.enum(["accept", "revise", "reject"]),
  strengths: z.array(z.string()).min(1).max(8),
  risks: z.array(z.string()).max(8),
  notes: z.string().min(20).max(4000),
  computeProvider: addressSchema.optional(),
  computeReceiptId: z.string().optional(),
  createdAt: z.string().datetime()
});

export type BountyMetadata = z.infer<typeof bountyMetadataSchema>;
export type DatasetManifest = z.infer<typeof datasetManifestSchema>;
export type ValidationReport = z.infer<typeof validationReportSchema>;

export type BountyStatus = "open" | "accepted" | "cancelled" | "expired";
export type SubmissionStatus = "submitted" | "validated" | "accepted" | "rejected";

export interface StorageProof {
  rootHash: string;
  txHash?: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface Bounty {
  id: string;
  chainId?: string;
  creator: string;
  rewardWei: string;
  deadline: string;
  metadataRoot: string;
  metadata?: BountyMetadata;
  storageProof?: StorageProof;
  status: BountyStatus;
  createdTxHash?: string;
  createdAt: string;
}

export interface Submission {
  id: string;
  chainId?: string;
  bountyId: string;
  contributor: string;
  datasetRoot: string;
  manifestRoot: string;
  storageProof?: StorageProof;
  status: SubmissionStatus;
  score?: number;
  validationReportRoot?: string;
  submittedTxHash?: string;
  createdAt: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  wallet: string;
  role: "validator" | "storage" | "settlement";
  status: "ready" | "unavailable" | "needs_funding";
  lastRunAt?: string;
  notes: string;
}

export interface ProofSummary {
  chainId: number;
  contractAddress?: string;
  explorerUrl: string;
  storageIndexer: string;
  recentTransactions: Array<{ label: string; txHash: string; url: string }>;
  storageRoots: Array<{ label: string; rootHash: string; txHash?: string }>;
  computeReports: Array<{ label: string; reportRoot: string; score: number; validatorAgent: string }>;
}

export const dataBountyAbi = [
  {
    type: "function",
    name: "createBounty",
    stateMutability: "payable",
    inputs: [
      { name: "metadataRoot", type: "bytes32" },
      { name: "deadline", type: "uint64" }
    ],
    outputs: [{ name: "bountyId", type: "uint256" }]
  },
  {
    type: "function",
    name: "submitDataset",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "datasetRoot", type: "bytes32" },
      { name: "manifestRoot", type: "bytes32" }
    ],
    outputs: [{ name: "submissionId", type: "uint256" }]
  },
  {
    type: "function",
    name: "attachValidation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "submissionId", type: "uint256" },
      { name: "reportRoot", type: "bytes32" },
      { name: "score", type: "uint8" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "acceptSubmission",
    stateMutability: "nonpayable",
    inputs: [{ name: "submissionId", type: "uint256" }],
    outputs: []
  }
] as const;
