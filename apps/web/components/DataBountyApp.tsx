"use client";

import { useEffect, useMemo, useState } from "react";
import type { AgentProfile, Bounty, DatasetManifest, ProofSummary, SetupStatus } from "@0g-databounty/shared";
import { API_URL, confirmBounty, createBounty, getAgents, getBounties, getExamples, getProofs, getSetup, submitDataset } from "../lib/api";
import { connectWallet, parseCreatedBountyId, sendPreparedTransaction } from "../lib/wallet";

type View = "landing" | "market" | "create" | "submit" | "agents" | "proof" | "docs";

const tomorrow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

const navItems: Array<{ href: string; label: string; view?: View }> = [
  { href: "/", label: "Home", view: "landing" },
  { href: "/market", label: "Market", view: "market" },
  { href: "/create", label: "Create", view: "create" },
  { href: "/submit", label: "Submit", view: "submit" },
  { href: "/agents", label: "Agents", view: "agents" },
  { href: "/proof", label: "Proof", view: "proof" },
  { href: "/docs", label: "Docs", view: "docs" }
];

export function DataBountyApp({ view = "landing" }: { view?: View }) {
  const [wallet, setWallet] = useState("");
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [proofs, setProofs] = useState<ProofSummary | null>(null);
  const [setup, setSetup] = useState<SetupStatus | null>(null);
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
      const [bountyData, agentData, proofData, setupData] = await Promise.all([
        getBounties(),
        getAgents(),
        getProofs(),
        getSetup()
      ]);
      setBounties(bountyData.bounties);
      setAgents(agentData.agents);
      setProofs(proofData);
      setSetup(setupData);
      setStatus(`Connected to ${API_URL}. ${bountyData.bounties.length} live bounties loaded.`);
      if (!selectedBountyId && bountyData.bounties[0]) setSelectedBountyId(bountyData.bounties[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the API.");
      setStatus("API wake-up failed. Render may still be cold-starting; press Refresh in a few seconds.");
    }
  }

  async function loadExamples() {
    setError("");
    try {
      const examples = await getExamples();
      setBountyForm((current) => ({
        ...current,
        title: examples.bounty.title,
        summary: examples.bounty.summary,
        requirements: examples.bounty.requirements,
        formats: examples.bounty.formats.join(","),
        evaluationRubric: examples.bounty.evaluationRubric,
        privacyNotes: examples.bounty.privacyNotes ?? "",
        deadline: examples.bounty.deadlineIso.slice(0, 16)
      }));
      setSubmissionForm({
        title: examples.dataset.title,
        description: examples.dataset.description,
        license: examples.dataset.license,
        format: examples.dataset.format,
        recordCount: String(examples.dataset.recordCount),
        sourceNotes: examples.dataset.sourceNotes,
        privacyDeclaration: examples.dataset.privacyDeclaration
      });
      setStatus("Loaded a test-ready example payload from the live API. It will not appear in the market until it is uploaded and signed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load example data.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const selectedBounty = useMemo(
    () => bounties.find((bounty) => bounty.id === selectedBountyId) ?? bounties[0],
    [bounties, selectedBountyId]
  );

  const createBlockedReason =
    !setup?.contract.address
      ? "Contract deployment must be completed before creators can escrow a bounty."
      : setup.storage.state !== "ready"
        ? setup.storage.note
        : "";

  const submitBlockedReason =
    !selectedBounty
      ? "Pick a live bounty before submitting a dataset."
      : !setup?.contract.address
        ? "Contract deployment must be completed before contributors can submit to a bounty."
        : setup.storage.state !== "ready"
          ? setup.storage.note
          : "";

  async function handleConnect() {
    setError("");
    try {
      setWallet(await connectWallet());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed.");
    }
  }

  async function handleCreateBounty() {
    if (createBlockedReason) {
      setError(createBlockedReason);
      return;
    }
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
      setStatus("Create bounty stopped before any fake proof could be shown.");
    }
  }

  async function handleSubmitDataset() {
    if (submitBlockedReason || !selectedBounty) {
      setError(submitBlockedReason || "Choose a bounty first.");
      return;
    }
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
            region: "APAC",
            category: "Dataset market",
            source: "public example row",
            usefulness: "Demonstrates the expected schema for the validator agent."
          }
        ],
        sourceNotes: submissionForm.sourceNotes,
        privacyDeclaration: submissionForm.privacyDeclaration
      };
      const prepared = await submitDataset(manifest);
      setStatus("Storage proof created. Sending submitDataset transaction to 0G Chain.");
      await sendPreparedTransaction(prepared.transaction);
      setStatus("Dataset transaction mined. Confirm the onchain submission id so it appears in the market.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dataset submission failed.");
      setStatus("Submit stopped before any fake Storage or Chain proof could be shown.");
    }
  }

  function renderNav() {
    return (
      <nav className="nav">
        <a href="/" className="brand">
          <span className="mark">0G</span>
          <span>DataBounty</span>
        </a>
        <div className="navlinks">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className={item.view === view ? "activeLink" : ""}>
              {item.label}
            </a>
          ))}
        </div>
        <button onClick={handleConnect}>{wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : "Connect"}</button>
      </nav>
    );
  }

  function renderStatusBand() {
    return (
      <section className="statusBand">
        <div>
          <strong>Live status</strong>
          <span>{status}</span>
        </div>
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  function renderSetupCards() {
    if (!setup) return null;
    const cards = [
      { title: "Contract", block: setup.contract, extra: setup.contract.address ?? "No mainnet address configured" },
      { title: "Storage", block: setup.storage, extra: setup.signerAddress ?? "No signer configured" },
      { title: "Compute", block: setup.compute, extra: setup.compute.provider ?? setup.signerAddress ?? "No provider selected" }
    ];
    return (
      <section className="section">
        <div className="sectionHead">
          <div>
            <p className="eyebrow">Mainnet setup</p>
            <h2>Current live readiness</h2>
          </div>
          <button onClick={refresh}>Refresh</button>
        </div>
        <div className="grid">
          {cards.map((card) => (
            <article className="agentCard" key={card.title}>
              <span className={card.block.state}>{card.block.label}</span>
              <h3>{card.title}</h3>
              <p>{card.block.note}</p>
              <small>{card.extra}</small>
            </article>
          ))}
        </div>
        {setup.signerAddress && (
          <p className="notice">
            Backend signer: <strong>{setup.signerAddress}</strong> with <strong>{setup.signerBalanceOg} 0G</strong>.
          </p>
        )}
      </section>
    );
  }

  function renderLanding() {
    return (
      <>
        <section className="hero">
          <div className="heroCopy">
            <p className="eyebrow">Data markets for autonomous AI</p>
            <h1>Fund the datasets agents need. Verify every step on 0G.</h1>
            <p>
              0G DataBounty is a buyer-seller market for AI datasets. Builders post a data need, contributors submit a
              structured manifest, validator agents score it, and every proof lives on 0G infrastructure.
            </p>
            <div className="actions">
              <a className="primary" href="/docs">Understand the product</a>
              <a className="secondary" href="/create">Try the creator flow</a>
            </div>
          </div>
          <div className="heroImage" aria-label="Dataset routing terminal">
            <img
              src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80"
              alt="Network infrastructure for decentralized data"
            />
          </div>
        </section>
        <section className="section start">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">Why it matters</p>
              <h2>What this product actually does</h2>
            </div>
            <button onClick={loadExamples}>Load test example</button>
          </div>
          <div className="stepGrid">
            <article>
              <strong>For creators</strong>
              <p>Define a dataset you need, post the reward, and turn the request into an auditable onchain bounty.</p>
            </article>
            <article>
              <strong>For contributors</strong>
              <p>Submit a dataset manifest with source notes, schema, sample rows, and privacy posture.</p>
            </article>
            <article>
              <strong>For validators</strong>
              <p>Use agent scoring to review usefulness, completeness, duplication risk, and policy fit.</p>
            </article>
            <article>
              <strong>For judges</strong>
              <p>Verify the contract, Storage roots, transactions, and validation reports without trusting the frontend.</p>
            </article>
          </div>
        </section>
        {renderSetupCards()}
        <section className="section">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">Try it fast</p>
              <h2>Best test path</h2>
            </div>
          </div>
          <div className="docGrid">
            <article className="infoCard">
              <h3>1. Load the example</h3>
              <p>Use the built-in example to prefill the Create and Submit pages with a realistic APAC dataset workflow.</p>
            </article>
            <article className="infoCard">
              <h3>2. Review setup</h3>
              <p>Open Proof and Agents to see exactly which 0G components are live and which still need funding or a provider.</p>
            </article>
            <article className="infoCard">
              <h3>3. Use the docs page</h3>
              <p>The docs page explains the business model, judge story, verification path, and the exact example to show in a demo video.</p>
            </article>
          </div>
        </section>
      </>
    );
  }

  function renderMarket() {
    return (
      <>
        <section className="pageHero">
          <p className="eyebrow">Marketplace</p>
          <h1>Open dataset bounties</h1>
          <p>Every market row here comes from the live API. The page stays empty until a real bounty is created.</p>
        </section>
        <section className="section">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">Live market</p>
              <h2>Bounties</h2>
            </div>
            <button onClick={refresh}>Refresh</button>
          </div>
          <div className="grid">
            {bounties.length === 0 ? (
              <div className="empty">
                <h3>No live bounties yet</h3>
                <p>
                  This is deliberate. The market only lists real backend records. Use the Create page once the contract and storage
                  setup are ready.
                </p>
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
                  <small>Root {bounty.metadataRoot.slice(0, 18)}...</small>
                </button>
              ))
            )}
          </div>
        </section>
      </>
    );
  }

  function renderCreate() {
    return (
      <>
        <section className="pageHero">
          <p className="eyebrow">Creator flow</p>
          <h1>Create a bounty</h1>
          <p>Creators publish a dataset need, upload the metadata manifest to 0G Storage, and escrow the reward on 0G Chain.</p>
        </section>
        <section className="section split">
          <div>
            <p className="eyebrow">Before you begin</p>
            <h2>Checklist</h2>
            <ul className="list">
              <li>Connect a wallet on 0G Mainnet.</li>
              <li>Load the example if you want a quick test payload.</li>
              <li>Make sure the backend contract and storage cards show `ready`.</li>
            </ul>
            {createBlockedReason && <p className="notice">{createBlockedReason}</p>}
            <button onClick={loadExamples}>Load test example</button>
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
            <textarea value={bountyForm.privacyNotes} onChange={(event) => setBountyForm({ ...bountyForm, privacyNotes: event.target.value })} />
            <input type="datetime-local" value={bountyForm.deadline} onChange={(event) => setBountyForm({ ...bountyForm, deadline: event.target.value })} />
            <button className="primaryButton" onClick={handleCreateBounty} disabled={Boolean(createBlockedReason)}>
              Upload to 0G Storage and create
            </button>
          </form>
        </section>
      </>
    );
  }

  function renderSubmit() {
    return (
      <>
        <section className="pageHero">
          <p className="eyebrow">Contributor flow</p>
          <h1>Submit a dataset</h1>
          <p>Contributors submit structured manifests first, so sensitive raw data can stay private until acceptance.</p>
        </section>
        <section className="section split flip">
          <div>
            <p className="eyebrow">Choose bounty</p>
            <h2>Submission target</h2>
            <div className="grid singleGrid">
              {bounties.length === 0 ? (
                <div className="empty">
                  <h3>No live bounty to submit to</h3>
                  <p>Create a real bounty first, then it will appear here for contributors.</p>
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
                  </button>
                ))
              )}
            </div>
            {submitBlockedReason && <p className="notice">{submitBlockedReason}</p>}
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
            <button className="primaryButton" onClick={handleSubmitDataset} disabled={Boolean(submitBlockedReason)}>
              Submit dataset proof
            </button>
          </form>
        </section>
      </>
    );
  }

  function renderAgents() {
    return (
      <>
        <section className="pageHero">
          <p className="eyebrow">Agent layer</p>
          <h1>Validator and settlement agents</h1>
          <p>The product shows the real backend setup instead of generic placeholders, so judges can see exactly what is configured.</p>
        </section>
        <section className="section">
          <div className="grid">
            {agents.map((agent) => (
              <article className="agentCard" key={agent.id}>
                <span className={agent.status}>{agent.status.replace("_", " ")}</span>
                <h3>{agent.name}</h3>
                <p>{agent.notes}</p>
                <small>{agent.wallet}</small>
              </article>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderProof() {
    return (
      <>
        <section className="pageHero darkHero">
          <p className="eyebrow">Proof center</p>
          <h1>What judges can verify</h1>
          <p>The proof page ties together contract address, Storage roots, compute reports, and transaction links.</p>
        </section>
        <section className="section proof">
          <div className="proofGrid">
            <div>
              <strong>Contract</strong>
              <span>{setup?.contract.address ?? "Deployment still pending funding"}</span>
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
          <div className="docGrid topGap">
            <article className="infoCard darkCard">
              <h3>Submission requirement</h3>
              <p>A valid hackathon submission still needs a real 0G mainnet contract address and real onchain activity.</p>
            </article>
            <article className="infoCard darkCard">
              <h3>Current blocker</h3>
              <p>{setup?.contract.note ?? "Contract setup not loaded yet."}</p>
            </article>
            <article className="infoCard darkCard">
              <h3>Live API path</h3>
              <p>Even before full mainnet proof, judges can inspect setup, examples, and proof endpoints from the live API.</p>
            </article>
          </div>
        </section>
      </>
    );
  }

  function renderDocs() {
    return (
      <>
        <section className="pageHero">
          <p className="eyebrow">Documentation</p>
          <h1>What 0G DataBounty is for</h1>
          <p>0G DataBounty turns dataset sourcing into a verifiable market for agent builders, model trainers, and AI-native apps.</p>
        </section>
        <section className="section">
          <div className="docGrid">
            <article className="infoCard">
              <h3>The problem</h3>
              <p>AI teams need niche, fresh, domain-specific datasets. Most datasets are hard to source, hard to verify, and impossible to buy in a trust-minimized way.</p>
            </article>
            <article className="infoCard">
              <h3>The product</h3>
              <p>Creators post dataset bounties, contributors submit manifests, validators score the work, and settlement happens only after verifiable review.</p>
            </article>
            <article className="infoCard">
              <h3>Why 0G</h3>
              <p>0G Storage keeps dataset proofs and reports, 0G Chain holds the bounty registry, and 0G Compute is the natural validator layer for scoring submissions.</p>
            </article>
          </div>
        </section>
        <section className="section">
          <div className="sectionHead">
            <div>
              <p className="eyebrow">How to test</p>
              <h2>Best demo example</h2>
            </div>
            <button onClick={loadExamples}>Load test example</button>
          </div>
          <div className="docGrid">
            <article className="infoCard">
              <h3>Bounty example</h3>
              <p><strong>Title:</strong> {bountyForm.title}</p>
              <p><strong>Reward:</strong> {bountyForm.rewardOg} 0G</p>
              <p><strong>Formats:</strong> {bountyForm.formats}</p>
            </article>
            <article className="infoCard">
              <h3>Submission example</h3>
              <p><strong>Title:</strong> {submissionForm.title}</p>
              <p><strong>License:</strong> {submissionForm.license}</p>
              <p><strong>Records:</strong> {submissionForm.recordCount}</p>
            </article>
            <article className="infoCard">
              <h3>Judge story</h3>
              <p>Show landing page, open docs, load example, inspect setup, then walk through Create, Submit, Agents, and Proof as the product story.</p>
            </article>
          </div>
          <ol className="walkList">
            <li>Open Home and explain that the app is a dataset market for AI builders on 0G.</li>
            <li>Open Docs and load the test example to show a concrete dataset request.</li>
            <li>Open Agents and Proof to show live backend setup and current mainnet readiness.</li>
            <li>Open Create and Submit to show the exact user flow once funding and contract deployment are complete.</li>
          </ol>
        </section>
      </>
    );
  }

  return (
    <main>
      {renderNav()}
      {renderStatusBand()}
      {view === "landing" && renderLanding()}
      {view === "market" && renderMarket()}
      {view === "create" && renderCreate()}
      {view === "submit" && renderSubmit()}
      {view === "agents" && renderAgents()}
      {view === "proof" && renderProof()}
      {view === "docs" && renderDocs()}
    </main>
  );
}
