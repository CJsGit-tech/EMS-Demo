import { useState } from "react";

import { CommandApprovalDialog } from "../../components/CommandApprovalDialog.jsx";
import { isApprovalEligible, normalizeDispatchRecord } from "../../components/commandEligibility.js";
import { useI18n } from "../../i18n/I18nProvider.jsx";

const dispatchStateKeys = {
  requested: "dispatch.state.requested",
  awaiting_approval: "dispatch.state.awaiting_approval",
  proposed: "dispatch.state.proposed",
  approved: "dispatch.state.approved",
  rejected: "dispatch.state.rejected",
  simulated: "dispatch.state.simulated",
  failed: "dispatch.state.failed",
  expired: "dispatch.state.expired",
  cancelled: "dispatch.state.cancelled",
};

function displayState(t, state) {
  return t(dispatchStateKeys[state] ?? "dispatch.state.unknown");
}

function State({ state, error, t }) {
  if (state === "loading") return <p className="scada-state" role="status">{t("dispatch.loading")}</p>;
  if (state === "error") return <p className="scada-state scada-state--error" role="alert">{error ?? t("dispatch.error")}</p>;
  if (state === "empty") return <p className="scada-state" role="status">{t("dispatch.empty")}</p>;
  return null;
}

function formatExpiry(value) {
  const timestamp = new Date(value).valueOf();
  return Number.isNaN(timestamp) ? "Unavailable" : new Date(timestamp).toLocaleString();
}

export function DispatchPage({ recommendations, state = "loading", error, onApprove, onReject, onCommandResolved }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [resolvedStates, setResolvedStates] = useState({});
  const items = (recommendations ?? []).map((recommendation) => {
    const item = normalizeDispatchRecord(recommendation);
    return item.commandId && resolvedStates[item.commandId]
      ? { ...item, state: resolvedStates[item.commandId] }
      : item;
  });

  if (["loading", "error", "empty"].includes(state)) return <State state={state} error={error} t={t} />;
  if (!items.length) return <State state="empty" t={t} />;

  const act = async (action, command, reason, fallbackState) => {
    setActionError(null);
    try {
      if (typeof action !== "function") {
        throw new Error(t("dispatch.actionUnavailable"));
      }
      const response = await action?.(command.commandId, reason);
      const nextState = typeof response?.state === "string" && response.state.trim()
        ? response.state
        : fallbackState;
      setResolvedStates((states) => ({ ...states, [command.commandId]: nextState }));
      onCommandResolved?.({ command_id: command.commandId, state: nextState });
      setSelected(null);
    } catch (actionFailure) {
      setActionError(actionFailure.message ?? t("dispatch.actionFailed"));
    }
  };

  return (
    <section className="scada-page" aria-labelledby="dispatch-title">
      <header className="scada-page__header">
        <div><p className="scada-eyebrow">{t("dispatch.eyebrow")}</p><h2 id="dispatch-title">{t("dispatch.title")}</h2></div>
        <p className="scada-simulator-status"><span aria-hidden="true">●</span> {t("dispatch.advisoryOnly")}</p>
      </header>
      {actionError ? <p className="scada-state scada-state--error" role="alert">{actionError}</p> : null}
      {items.map((item, index) => {
        const pending = isApprovalEligible(item);
        return <article className="scada-panel scada-dispatch" key={item.commandId ?? `advisory-${index}`}>
          <div className="scada-dispatch__heading"><div><p className="scada-eyebrow">{pending ? t("dispatch.awaiting") : t("dispatch.advisory")}</p><h3>{item.reason ?? t("dispatch.advisory")}</h3></div><span className="scada-state-chip">{displayState(t, item.state)}</span></div>
          <dl className="scada-key-values"><div><dt>{t("dispatch.expiry")}</dt><dd>{formatExpiry(item.expiresAt)}</dd></div><div><dt>{t("dispatch.projectedSoc")}</dt><dd>{Number.isFinite(item.projectedSoc) ? `${item.projectedSoc}%` : t("dispatch.notSupplied")}</dd></div><div><dt>{t("dispatch.expectedImpact")}</dt><dd>{Number.isFinite(item.impactKw) ? `${item.impactKw} kW` : t("dispatch.notSupplied")}</dd></div></dl>
          <div className="scada-constraint-list"><strong>{t("dispatch.constraints")}</strong><ul>{item.constraints.length ? item.constraints.map((constraint) => <li key={constraint}>{constraint}</li>) : <li>{t("dispatch.noConstraints")}</li>}</ul></div>
          {item.assumptions.length ? <p className="scada-data-note">{t("dispatch.assumptions")}: {item.assumptions.join(" · ")}</p> : null}
          {!pending ? <p className="scada-data-note">{t("dispatch.noAction")}</p> : null}
          <button className="scada-button scada-button--approve" type="button" disabled={!pending} onClick={() => setSelected(item)}>{t("dispatch.approve")}</button>
        </article>;
      })}
      <CommandApprovalDialog recommendation={selected} onApprove={(id, reason) => act(onApprove, selected, reason, "approved")} onReject={(id, reason) => act(onReject, selected, reason, "rejected")} />
    </section>
  );
}
