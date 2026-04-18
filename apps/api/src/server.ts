import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { Interface } from "ethers";
import {
  bountyMetadataSchema,
  dataBountyAbi,
  datasetManifestSchema,
  validationReportSchema
} from "@0g-databounty/shared";
import type { Bounty, Submission } from "@0g-databounty/shared";
import { config } from "./config.js";
import { validateDataset } from "./compute.js";
import { store } from "./store.js";
import { uploadJsonTo0G } from "./storage.js";

const app = express();
app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin }));
app.use(express.json({ limit: "2mb" }));

const abi = new Interface(dataBountyAbi);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "0g-databounty-api",
    storage: config.enableRealStorage ? "enabled" : "disabled",
    compute: config.enableRealCompute ? "enabled" : "disabled",
    contractConfigured: Boolean(config.contractAddress)
  });
});

app.get("/api/agents", (_req, res) => {
  res.json({ agents: store.agents() });
});

app.get("/api/proofs", (_req, res) => {
  res.json(store.proofSummary());
});

app.get("/api/bounties", (_req, res) => {
  res.json({ bounties: store.listBounties() });
});

app.get("/api/bounties/:id", (req, res) => {
  const bounty = store.getBounty(req.params.id);
  if (!bounty) return res.status(404).json({ error: "Bounty not found" });
  res.json({ bounty, submissions: store.listSubmissions(req.params.id) });
});

app.post("/api/bounties", async (req, res) => {
  try {
    const metadata = bountyMetadataSchema.parse(req.body.metadata);
    const rewardWei = String(req.body.rewardWei ?? "0");
    const upload = await uploadJsonTo0G({ kind: "bounty-metadata", metadata });
    const deadline = Math.floor(new Date(metadata.deadlineIso).getTime() / 1000);
    const callData = abi.encodeFunctionData("createBounty", [upload.rootHash, BigInt(deadline)]);

    const bounty: Bounty = {
      id: randomUUID(),
      creator: metadata.creator ?? "0x0000000000000000000000000000000000000000",
      rewardWei,
      deadline: metadata.deadlineIso,
      metadataRoot: upload.rootHash,
      metadata,
      storageProof: { ...upload, uploadedAt: new Date().toISOString() },
      status: "open",
      createdAt: new Date().toISOString()
    };
    store.saveBounty(bounty);

    res.status(201).json({
      bounty,
      transaction: {
        to: config.contractAddress,
        value: rewardWei,
        data: callData
      }
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not create bounty" });
  }
});

app.post("/api/submissions", async (req, res) => {
  try {
    const manifest = datasetManifestSchema.parse(req.body.manifest);
    const bounty = store.getBounty(manifest.bountyId);
    if (!bounty) return res.status(404).json({ error: "Bounty not found" });
    if (!bounty.chainId) {
      return res.status(409).json({
        error: "Bounty is not confirmed onchain yet. Confirm the createBounty transaction before accepting submissions."
      });
    }

    const upload = await uploadJsonTo0G({ kind: "dataset-manifest", manifest });
    const callData = abi.encodeFunctionData("submitDataset", [
      BigInt(bounty.chainId),
      upload.rootHash,
      upload.rootHash
    ]);

    const submission: Submission = {
      id: randomUUID(),
      bountyId: manifest.bountyId,
      contributor: manifest.contributor ?? "0x0000000000000000000000000000000000000000",
      datasetRoot: upload.rootHash,
      manifestRoot: upload.rootHash,
      storageProof: { ...upload, uploadedAt: new Date().toISOString() },
      status: "submitted",
      createdAt: new Date().toISOString()
    };
    store.saveSubmission(submission);

    res.status(201).json({
      submission,
      transaction: {
        to: config.contractAddress,
        value: "0",
        data: callData
      }
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not submit dataset" });
  }
});

app.post("/api/submissions/:id/validate", async (req, res) => {
  try {
    const submission = store.getSubmission(req.params.id);
    if (!submission) return res.status(404).json({ error: "Submission not found" });
    if (!submission.chainId) {
      return res.status(409).json({
        error: "Submission is not confirmed onchain yet. Confirm the submitDataset transaction before validation."
      });
    }
    const bounty = store.getBounty(submission.bountyId);
    if (!bounty?.metadata) return res.status(404).json({ error: "Bounty metadata not found" });

    const manifest = datasetManifestSchema.parse(req.body.manifest);
    const report = validationReportSchema.parse(
      await validateDataset({
        bountyId: bounty.id,
        submissionId: submission.id,
        requirements: bounty.metadata.requirements,
        manifest
      })
    );
    const upload = await uploadJsonTo0G({ kind: "validation-report", report });
    const callData = abi.encodeFunctionData("attachValidation", [
      BigInt(submission.chainId),
      upload.rootHash,
      report.score
    ]);

    const updated: Submission = {
      ...submission,
      status: "validated",
      score: report.score,
      validationReportRoot: upload.rootHash
    };
    store.saveSubmission(updated);

    res.json({
      report,
      submission: updated,
      transaction: {
        to: config.contractAddress,
        value: "0",
        data: callData
      }
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not validate submission" });
  }
});

app.post("/api/bounties/:id/confirm", (req, res) => {
  const bounty = store.getBounty(req.params.id);
  if (!bounty) return res.status(404).json({ error: "Bounty not found" });
  const chainId = String(req.body.chainId ?? "");
  const txHash = String(req.body.txHash ?? "");
  if (!/^\d+$/.test(chainId)) return res.status(400).json({ error: "chainId must be the onchain bounty id" });
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return res.status(400).json({ error: "txHash must be a transaction hash" });
  const updated = store.saveBounty({ ...bounty, chainId, createdTxHash: txHash });
  res.json({ bounty: updated });
});

app.post("/api/submissions/:id/confirm", (req, res) => {
  const submission = store.getSubmission(req.params.id);
  if (!submission) return res.status(404).json({ error: "Submission not found" });
  const chainId = String(req.body.chainId ?? "");
  const txHash = String(req.body.txHash ?? "");
  if (!/^\d+$/.test(chainId)) return res.status(400).json({ error: "chainId must be the onchain submission id" });
  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) return res.status(400).json({ error: "txHash must be a transaction hash" });
  const updated = store.saveSubmission({ ...submission, chainId, submittedTxHash: txHash });
  res.json({ submission: updated });
});

const server = app.listen(config.port, config.host, () => {
  console.log(`0G DataBounty API listening on ${config.host}:${config.port}`);
});

server.on("error", (error) => {
  console.error("API server failed to listen", error);
  process.exit(1);
});
