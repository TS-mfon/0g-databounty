import type { DatasetManifest, ValidationReport } from "@0g-databounty/shared";
import { config } from "./config.js";

export async function validateDataset(params: {
  bountyId: string;
  submissionId: string;
  requirements: string;
  manifest: DatasetManifest;
}): Promise<ValidationReport> {
  if (!config.enableRealCompute) {
    throw new Error("0G Compute is disabled. Set ZERO_G_ENABLE_REAL_COMPUTE=true and configure a provider secret.");
  }
  if (!config.computeProvider || !config.computeSecret) {
    throw new Error("ZERO_G_COMPUTE_PROVIDER and ZERO_G_COMPUTE_SECRET are required.");
  }

  const endpoint = process.env.ZERO_G_COMPUTE_ENDPOINT;
  const model = process.env.ZERO_G_COMPUTE_MODEL;
  if (!endpoint || !model) {
    throw new Error("ZERO_G_COMPUTE_ENDPOINT and ZERO_G_COMPUTE_MODEL are required for direct Compute calls.");
  }

  const response = await fetch(`${endpoint.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.computeSecret}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a strict dataset validator. Return compact JSON with score 0-100, verdict accept/revise/reject, strengths, risks, and notes."
        },
        {
          role: "user",
          content: JSON.stringify({
            requirements: params.requirements,
            manifest: params.manifest
          })
        }
      ],
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`0G Compute request failed with ${response.status}`);
  }

  const data = (await response.json()) as any;
  const text = data.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text);

  return {
    bountyId: params.bountyId,
    submissionId: params.submissionId,
    validatorAgent: process.env.VALIDATOR_AGENT_ADDRESS ?? "0x0000000000000000000000000000000000000000",
    score: Math.max(0, Math.min(100, Number(parsed.score ?? 0))),
    verdict: ["accept", "revise", "reject"].includes(parsed.verdict) ? parsed.verdict : "revise",
    strengths: Array.isArray(parsed.strengths) && parsed.strengths.length ? parsed.strengths : ["Compute report returned no strengths."],
    risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    notes: String(parsed.notes ?? "0G Compute completed without detailed notes."),
    computeProvider: config.computeProvider,
    computeReceiptId: response.headers.get("ZG-Res-Key") ?? data.id,
    createdAt: new Date().toISOString()
  };
}
