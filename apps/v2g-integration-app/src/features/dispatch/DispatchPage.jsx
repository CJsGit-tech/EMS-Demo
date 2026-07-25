import { useState } from "react";

import { CommandApprovalDialog } from "../../components/CommandApprovalDialog.jsx";
import { isApprovalEligible, normalizeDispatchRecord } from "../../components/commandEligibility.js";

function State({ state, error }) {
  if (state === "loading") return <p className="scada-state" role="status">Loading simulator dispatch advice…</p>;
  if (state === "error") return <p className="scada-state scada-state--error" role="alert">{error ?? "Dispatch recommendations could not be loaded."}</p>;
  if (state === "empty") return <p className="scada-state" role="status">There are no simulator recommendations to review.</p>;
  return null;
}

function formatExpiry(value) {
  const timestamp = new Date(value).valueOf();
  return Number.isNaN(timestamp) ? "Unavailable" : new Date(timestamp).toLocaleString();
}

export function DispatchPage({ recommendations, state = "loading", error, onApprove, onReject, onCommandResolved }) {
  const [selected, setSelected] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [resolvedStates, setResolvedStates] = useState({});
  const items = (recommendations ?? []).map((recommendation) => {
    const item = normalizeDispatchRecord(recommendation);
    return item.commandId && resolvedStates[item.commandId]
      ? { ...item, state: resolvedStates[item.commandId] }
      : item;
  });

  if (["loading", "error", "empty"].includes(state)) return <State state={state} error={error} />;
  if (!items.length) return <State state="empty" />;

  const act = async (action, command, reason, fallbackState) => {
    setActionError(null);
    try {
      if (typeof action !== "function") {
        throw new Error("The simulator command action is unavailable.");
      }
      const response = await action?.(command.commandId, reason);
      const nextState = typeof response?.state === "string" && response.state.trim()
        ? response.state
        : fallbackState;
      setResolvedStates((states) => ({ ...states, [command.commandId]: nextState }));
      onCommandResolved?.({ command_id: command.commandId, state: nextState });
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
      {items.map((item, index) => {
        const pending = isApprovalEligible(item);
        return <article className="scada-panel scada-dispatch" key={item.commandId ?? `advisory-${index}`}>
          <div className="scada-dispatch__heading"><div><p className="scada-eyebrow">{pending ? "Awaiting human approval" : "Simulator advisory"}</p><h3>{item.reason ?? "Simulated dispatch recommendation"}</h3></div><span className="scada-state-chip">{item.state}</span></div>
          <dl className="scada-key-values"><div><dt>Expiry</dt><dd>{formatExpiry(item.expiresAt)}</dd></div><div><dt>Projected SOC</dt><dd>{Number.isFinite(item.projectedSoc) ? `${item.projectedSoc}%` : "Not supplied"}</dd></div><div><dt>Expected site impact</dt><dd>{Number.isFinite(item.impactKw) ? `${item.impactKw} kW` : "Not supplied"}</dd></div></dl>
          <div className="scada-constraint-list"><strong>Constraints</strong><ul>{item.constraints.length ? item.constraints.map((constraint) => <li key={constraint}>{constraint}</li>) : <li>No constraint summary supplied by the simulator.</li>}</ul></div>
          {item.assumptions.length ? <p className="scada-data-note">Assumptions: {item.assumptions.join(" · ")}</p> : null}
          {!pending ? <p className="scada-data-note">This record is advisory or incomplete, not an approval-pending simulator command. No simulated control action is available.</p> : null}
          <button className="scada-button scada-button--approve" type="button" disabled={!pending} onClick={() => setSelected(item)}>Approve simulated command</button>
        </article>;
      })}
      <CommandApprovalDialog recommendation={selected} onApprove={(id, reason) => act(onApprove, selected, reason, "approved")} onReject={(id, reason) => act(onReject, selected, reason, "rejected")} />
    </section>
  );
}
