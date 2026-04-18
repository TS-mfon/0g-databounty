"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgentProfile, Bounty, DatasetManifest, ProofSummary } from "@0g-databounty/shared";
import { API_URL, confirmBounty, createBounty, getAgents, getBounties, getProofs, submitDataset } from "../lib/api";
import { connectWallet, parseCreatedBountyId, sendPreparedTransaction } from "../lib/wallet";

const tomorrow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

export function DataBountyApp() {
  const [wallet, setWallet] = useState("");
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [proofs, setProofs] = useState<ProofSummary | null>(null);
  const [status, setStatus] = useState("Loading live state from the API.");
  const [error, setError] = useState("");
  const [selectedBountyId, setSelectedBountyId] = useState("");

  const [bountyForm, setBountyForm] = useState({
    title: "APAC onchain AI agent dataset",
    summary: "A high-signal dataset of APAC AI x Web3 builders, projects, use cases, and ecosystem links.",
    requirements:
      "Collect structured records for active APAC AI x Web3 projects. Each row must include project name, region, category, public link, source URL, short description, and usefulness notes for agent builders.",
    formats: "json,csv",
    evaluationRubric:
      "Score completeness, source quality, duplicate resistance, region relevance, usefulness for agent workflows, and licensing clarity. Penalize unverifiable claims and private personal data.",
    privacyNotes: "Do not include private emails, phone numbers, wallet doxxing, or non-public personal data.",
    rewardOg: "0.01",
    deadline: tomorrow
  });

  const [submissionForm, setSubmissionForm] = useState({
    title: "APAC AI x Web3 project sample",
    description:
      "A structured starter manifest with public ecosystem records, source notes, schema fields, and sample rows for validator-agent review.",
    license: "CC-BY-4.0",
    format: "json",
    recordCount: "25",
    sourceNotes: "Records are sourced only from public project websites, ecosystem pages, GitHub repos, and X posts.",
    privacyDeclaration: "This dataset contains public project information only and excludes private personal data."
  });

  async function refresh() {
    setError("");
    try {
      const [bountyData, agentData, proofData] = await Promise.all([getBounties(), getAgents(), getProofs()]);
      setBounties(bountyData.bounties);
      setAgents(agentData.agents);
      setProofs(proofData);
      setStatus(`Connected to ${API_URL}. ${bountyData.bounties.length} bounties loaded.`);
      if (!selectedBountyId && bountyData.bounties[0]) setSelectedBountyId(bountyData.bounties[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the API.");
      setStatus("API is not connected. Start the Render service or local API.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const selectedBounty = useMemo(
    () => bounties.find((bounty) => bounty.id === selectedBountyId) ?? bounties[0],
    [bounties, selectedBountyId]
  );

  async function handleConnect() {
    setError("");
    try {
      setWallet(await connectWallet());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed.");
    }
  }

  async function handleCreateBounty() {
    setError("");
    setStatus("Uploading bounty metadata to 0G Storage.");
    try {
      const metadata = {
        title: bountyForm.title,
        summary: bountyForm.summary,
        requirements: bountyForm.requirements,
        formats: bountyForm.formats.split(",").map((item) => item.trim()).filter(Boolean),
        evaluationRubric: bountyForm.evaluationRubric,
        privacyNotes: bountyForm.privacyNotes,
        deadlineIso: new Date(bountyForm.deadline).toISOString(),
        creator: wallet || undefined
      };
      const rewardWei = BigInt(Math.floor(Number(bountyForm.rewardOg) * 1e18)).toString();
      const prepared = await createBounty(metadata, rewardWei);
      setStatus("Storage proof created. Sending createBounty transaction to 0G Chain.");
      const sent = await sendPreparedTransaction(prepared.transaction);
      const chainId = parseCreatedBountyId(sent.receipt.logs.map((log) => ({ topics: [...log.topics], data: log.data })));
      if (chainId) await confirmBounty(prepared.bounty.id, { chainId, txHash: sent.txHash });
      setStatus(`Bounty transaction mined: ${sent.txHash}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create bounty failed.");
      setStatus("Create bounty stopped before a fake proof could be shown.");
    }
  }

  async function handleSubmitDataset() {
    if (!selectedBounty) return;
    setError("");
    setStatus("Uploading dataset manifest to 0G Storage.");
    try {
      const manifest: DatasetManifest = {
        bountyId: selectedBounty.id,
        contributor: wallet || undefined,
        title: submissionForm.title,
        description: submissionForm.description,
        license: submissionForm.license,
        format: submissionForm.format,
        recordCount: Number(submissionForm.recordCount),
        sampleRows: [
          {
            project: "0G DataBounty",
            category: "data market",
            source: "public demo manifest",
            usefulness: "shows the expected schema"
          }
        ],
        sourceNotes: submissionForm.sourceNotes,
        privacyDeclaration: submissionForm.privacyDeclaration
      };
      const prepared = await submitDataset(manifest);
      setStatus("Storage proof created. Send the prepared submitDataset transaction from your wallet.");
      await sendPreparedTransaction(prepared.transaction);
      setStatus("Dataset transaction mined. Use the API confirmation endpoint once the onchain submission id is known.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dataset submission failed.");
      setStatus("Submit stopped before a fake Storage or Chain proof could be shown.");
    }
  }

  return (
    <main>
      <nav className="nav">
        <a href="#top" className="brand">
          <span className="mark">0G</span>
          <span>DataBounty</span>
        </a>
        <div className="navlinks">
          <a href="#market">Market</a>
          <a href="#create">Create</a>
          <a href="#submit">Submit</a>
          <a href="#agents">Agents</a>
          <a href="#proof">Proof</a>
        </div>
        <button onClick={handleConnect}>{wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Connect"}</button>
      </nav>

      <section id="top" className="hero">
        <div className="heroCopy">
          <p className="eyebrow">Data markets for autonomous AI</p>
          <h1>Fund the datasets agents need. Verify every step on 0G.</h1>
          <p>
            0G DataBounty turns dataset requests into escrowed, verifiable workflows: requirements onchain, manifests in
            0G Storage, validator reports from 0G Compute, and settlement on 0G Chain.
          </p>
          <div className="actions">
            <a className="primary" href="#create">Create bounty</a>
            <a className="secondary" href="#walkthrough">Watch the flow</a>
          </div>
        </div>
        <div className="heroImage" aria-label="Dataset routing terminal">
          <img
            src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80"
            alt="Network infrastructure for decentralized data"
          />
        </div>
      </section>

      <section className="statusBand">
        <div>
          <strong>Live status</strong>
          <span>{status}</span>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      <section id="market" className="section">
        <div className="sectionHead">
          <p className="eyebrow">Marketplace</p>
          <h2>Open dataset bounties</h2>
          <button onClick={refresh}>Refresh</button>
        </div>
        <div className="grid">
          {bounties.length === 0 ? (
            <div className="empty">
              <h3>No live bounties yet</h3>
              <p>Create one after enabling real 0G Storage. The app will not display fake bounty proof.</p>
            </div>
          ) : (
            bounties.map((bounty) => (
              <button
                className={`bountyCard ${selectedBounty?.id === bounty.id ? "active" : ""}`}
                key={bounty.id}
                onClick={() => setSelectedBountyId(bounty.id)}
              >
                <span>{bounty.status}</span>
                <h3>{bounty.metadata?.title ?? `Bounty ${bounty.id}`}</h3>
                <p>{bounty.metadata?.summary}</p>
                <small>Root {bounty.metadataRoot.slice(0, 14)}...</small>
              </button>
            ))
          )}
        </div>
      </section>

      <section id="create" className="section split">
        <div>
          <p className="eyebrow">Creator flow</p>
          <h2>Create a bounty with real 0G proof</h2>
          <p>
            The API uploads metadata to 0G Storage first. Your wallet then escrows the reward on 0G Chain using that root.
          </p>
        </div>
        <form className="panel" onSubmit={(event) => event.preventDefault()}>
          <input value={bountyForm.title} onChange={(event) => setBountyForm({ ...bountyForm, title: event.target.value })} />
          <textarea value={bountyForm.summary} onChange={(event) => setBountyForm({ ...bountyForm, summary: event.target.value })} />
          <textarea value={bountyForm.requirements} onChange={(event) => setBountyForm({ ...bountyForm, requirements: event.target.value })} />
          <div className="two">
            <input value={bountyForm.formats} onChange={(event) => setBountyForm({ ...bountyForm, formats: event.target.value })} />
            <input value={bountyForm.rewardOg} onChange={(event) => setBountyForm({ ...bountyForm, rewardOg: event.target.value })} />
          </div>
          <textarea value={bountyForm.evaluationRubric} onChange={(event) => setBountyForm({ ...bountyForm, evaluationRubric: event.target.value })} />
          <input type="datetime-local" value={bountyForm.deadline} onChange={(event) => setBountyForm({ ...bountyForm, deadline: event.target.value })} />
          <button className="primaryButton" onClick={handleCreateBounty}>Upload to 0G Storage and create</button>
        </form>
      </section>

      <section id="submit" className="section split flip">
        <div>
          <p className="eyebrow">Contributor flow</p>
          <h2>Submit a dataset manifest</h2>
          <p>
            Contributors submit structured manifests first. Sensitive raw data can stay encrypted while validators inspect
            declared schema, samples, sources, and privacy posture.
          </p>
          <div className="selected">
            Selected bounty: <strong>{selectedBounty?.metadata?.title ?? "None"}</strong>
          </div>
        </div>
        <form className="panel" onSubmit={(event) => event.preventDefault()}>
          <input value={submissionForm.title} onChange={(event) => setSubmissionForm({ ...submissionForm, title: event.target.value })} />
          <textarea value={submissionForm.description} onChange={(event) => setSubmissionForm({ ...submissionForm, description: event.target.value })} />
          <div className="two">
            <input value={submissionForm.license} onChange={(event) => setSubmissionForm({ ...submissionForm, license: event.target.value })} />
            <input value={submissionForm.recordCount} onChange={(event) => setSubmissionForm({ ...submissionForm, recordCount: event.target.value })} />
          </div>
          <textarea value={submissionForm.sourceNotes} onChange={(event) => setSubmissionForm({ ...submissionForm, sourceNotes: event.target.value })} />
          <textarea value={submissionForm.privacyDeclaration} onChange={(event) => setSubmissionForm({ ...submissionForm, privacyDeclaration: event.target.value })} />
          <button className="primaryButton" onClick={handleSubmitDataset} disabled={!selectedBounty}>Submit dataset proof</button>
        </form>
      </section>

      <section id="agents" className="section">
        <div className="sectionHead">
          <p className="eyebrow">Agent layer</p>
          <h2>Validator agents</h2>
        </div>
        <div className="grid">
          {agents.map((agent) => (
            <article className="agentCard" key={agent.id}>
              <span className={agent.status}>{agent.status}</span>
              <h3>{agent.name}</h3>
              <p>{agent.notes}</p>
              <small>{agent.wallet}</small>
            </article>
          ))}
        </div>
      </section>

      <section id="proof" className="section proof">
        <p className="eyebrow">Proof center</p>
        <h2>What judges can verify</h2>
        <div className="proofGrid">
          <div>
            <strong>Contract</strong>
            <span>{proofs?.contractAddress ?? "Not configured yet"}</span>
          </div>
          <div>
            <strong>Explorer</strong>
            <span>{proofs?.explorerUrl ?? "https://chainscan.0g.ai"}</span>
          </div>
          <div>
            <strong>Storage roots</strong>
            <span>{proofs?.storageRoots.length ?? 0}</span>
          </div>
          <div>
            <strong>Compute reports</strong>
            <span>{proofs?.computeReports.length ?? 0}</span>
          </div>
        </div>
      </section>

      <section id="walkthrough" className="section walkthrough">
        <p className="eyebrow">Walkthrough</p>
        <h2>Demo path</h2>
        <ol>
          <li>Connect a wallet on 0G Mainnet.</li>
          <li>Create a bounty and wait for the Storage root.</li>
          <li>Sign the escrow transaction on 0G Chain.</li>
          <li>Submit a dataset manifest to an onchain-confirmed bounty.</li>
          <li>Run validator scoring once Compute credentials are funded.</li>
          <li>Open Proof Center and verify every root and transaction.</li>
        </ol>
      </section>
    </main>
  );
}
