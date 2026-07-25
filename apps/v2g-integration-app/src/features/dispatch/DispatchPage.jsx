import { useState } from "react";

import { CommandApprovalDialog } from "../../components/CommandApprovalDialog.jsx";

function State({ state, error }) {
  if (state === "loading") return <p className="scada-state" role="status">Loading simulator dispatch advice…</p>;
  if (state === "error") return <p className="scada-state scada-state--error" role="alert">{error ?? "Dispatch recommendations could not be loaded."}</p>;
  if (state === "empty") return <p className="scada-state" role="status">There are no simulator recommendations to review.</p>;
  return null;
}

function normalizeRecommendation(recommendation, index) {
  return {
    id: recommendation.id ?? recommendation.command_id ?? `advisory-${index}`,
    status: recommendation.status,
    expiresAt: recommendation.expiresAt ?? recommendation.expires_at,
    projectedSoc: recommendation.projectedSoc ?? recommendation.projected_soc_percent ?? "Not supplied",
    impactKw: recommendation.impactKw ?? recommendation.expected_site_impact_kw ?? "Not supplied",
    constraints: recommendation.constraints ?? [],
    assumptions: recommendation.assumptions ?? [],
    reason: recommendation.reason,
  };
}

function formatExpiry(value) {
  const timestamp = new Date(value).valueOf();
  return Number.isNaN(timestamp) ? "Unavailable" : new Date(timestamp).toLocaleString();
}

export function DispatchPage({ recommendations, state = "loading", error, onApprove, onReject }) {
  const [selected, setSelected] = useState(null);
  const [actionError, setActionError] = useState(null);
  const items = (recommendations ?? []).map(normalizeRecommendation);

  if (["loading", "error", "empty"].includes(state)) return <State state={state} error={error} />;
  if (!items.length) return <State state="empty" />;

  const act = async (action, commandId, reason) => {
    setActionError(null);
    try {
      await action?.(commandId, reason);
      setSelected(null);
    } catch (actionFailure) {
      setActionError(actionFailure.message ?? "The simulator command action could not be recorded.");
    }
  };

  return (
    <section className="scada-page" aria-labelledby="dispatch-title">
      <header className="scada-page__header">
        <div><p className="scada-eyebrow">Human-in-the-loop · simulator only</p><h2 id="dispatch-title">Dispatch</h2></div>
        <p className="scada-simulator-status"><span aria-hidden="true">●</span> Advisory; never real control</p>
      </header>
      {actionError ? <p className="scada-state scada-state--error" role="alert">{actionError}</p> : null}
      {items.map((item) => {
        const pending = item.status === "awaiting_approval";
        return <article className="scada-panel scada-dispatch" key={item.id}>
          <div className="scada-dispatch__heading"><div><p className="scada-eyebrow">{pending ? "Awaiting human approval" : "Simulator advisory"}</p><h3>{item.reason ?? "Simulated dispatch recommendation"}</h3></div><span className="scada-state-chip">{item.status ?? "unknown"}</span></div>
          <dl className="scada-key-values"><div><dt>Expiry</dt><dd>{formatExpiry(item.expiresAt)}</dd></div><div><dt>Projected SOC</dt><dd>{item.projectedSoc}{typeof item.projectedSoc === "number" ? "%" : ""}</dd></div><div><dt>Expected site impact</dt><dd>{item.impactKw}{typeof item.impactKw === "number" ? " kW" : ""}</dd></div></dl>
          <div className="scada-constraint-list"><strong>Constraints</strong><ul>{item.constraints.length ? item.constraints.map((constraint) => <li key={constraint}>{constraint}</li>) : <li>No constraint summary supplied by the simulator.</li>}</ul></div>
          {item.assumptions.length ? <p className="scada-data-note">Assumptions: {item.assumptions.join(" · ")}</p> : null}
          {!pending ? <p className="scada-data-note">The Task 5 API returned an advisory proposal, not an approval-pending command. No simulated control action is available.</p> : null}
          <button className="scada-button scada-button--approve" type="button" disabled={!pending} onClick={() => setSelected(item)}>Approve simulated command</button>
        </article>;
      })}
      <CommandApprovalDialog recommendation={selected} onApprove={(id, reason) => act(onApprove, id, reason)} onReject={(id, reason) => act(onReject, id, reason)} />
    </section>
  );
}
