import type { AgentProfile, Bounty, BountyMetadata, DatasetManifest, ProofSummary, Submission } from "@0g-databounty/shared";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://zerog-databounty-api.onrender.com";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers ?? {})
        },
        cache: "no-store"
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? `Request failed: ${response.status}`);
      }
      return body as T;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("API request failed.");
}

export function getBounties() {
  return request<{ bounties: Bounty[] }>("/api/bounties");
}

export function getAgents() {
  return request<{ agents: AgentProfile[] }>("/api/agents");
}

export function getProofs() {
  return request<ProofSummary>("/api/proofs");
}

export function getExamples() {
  return request<{ bounty: BountyMetadata; dataset: Omit<DatasetManifest, "bountyId" | "contributor"> }>("/api/examples");
}

export function createBounty(metadata: unknown, rewardWei: string) {
  return request<{ bounty: Bounty; transaction: { to?: string; value: string; data: string } }>("/api/bounties", {
    method: "POST",
    body: JSON.stringify({ metadata, rewardWei })
  });
}

export function submitDataset(manifest: DatasetManifest) {
  return request<{ submission: Submission; transaction: { to?: string; value: string; data: string } }>("/api/submissions", {
    method: "POST",
    body: JSON.stringify({ manifest })
  });
}

export function confirmBounty(id: string, payload: { chainId: string; txHash: string }) {
  return request<{ bounty: Bounty }>(`/api/bounties/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
