import { useEffect, useState } from "react";

import { PageState, SimulatorNote } from "../../components/PageState.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

const transitionTargets = {
  open: [{ state: "in_progress", key: "workOrders.start" }],
  in_progress: [{ state: "completed", key: "workOrders.complete" }, { state: "open", key: "workOrders.reopen" }],
  completed: [],
};

function stateLabel(t, state) {
  return t(`workOrders.state.${state}`);
}

export function WorkOrdersPage({ data, state = "loading", error, onTransition }) {
  const { t } = useI18n();
  const [orders, setOrders] = useState(data?.work_orders ?? []);
  const [actor, setActor] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState(null);
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => setOrders(data?.work_orders ?? []), [data]);
  if (!data || ["loading", "error", "empty"].includes(state)) return <PageState state={state} error={error} />;

  const transition = async (order, target) => {
    if (!reason.trim()) return setMessage({ type: "error", text: t("workOrders.reasonRequired") });
    if (!actor.trim()) return setMessage({ type: "error", text: t("workOrders.actorRequired") });
    if (typeof onTransition !== "function") return setMessage({ type: "error", text: t("dispatch.actionUnavailable") });
    setPendingId(order.work_order_id);
    setMessage(null);
    try {
      const updated = await onTransition(order.work_order_id, { state: target.state, actor: actor.trim(), reason: reason.trim() });
      setOrders((current) => current.map((item) => item.work_order_id === order.work_order_id ? { ...item, ...updated } : item));
      setReason("");
    } catch (failure) {
      setMessage({ type: "error", text: failure.message ?? t("dispatch.actionFailed") });
    } finally {
      setPendingId(null);
    }
  };

  return <section className="scada-page" aria-labelledby="work-orders-title">
    <header className="scada-page__header"><div><h2 id="work-orders-title">{t("page.workOrders")}</h2><p className="scada-data-note">{t("workOrders.localOnly")}</p></div><SimulatorNote /></header>
    <div className="scada-work-order-form">
      <label>{t("workOrders.actor")}<input value={actor} onChange={(event) => setActor(event.target.value)} /></label>
      <label>{t("workOrders.reason")}<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    </div>
    {message ? <p className="scada-state scada-state--error" role="alert">{message.text}</p> : null}
    <div className="scada-work-order-list">{orders.map((order) => <article className="scada-panel scada-work-order" key={order.work_order_id}>
      <header><div><p className="scada-eyebrow">{order.work_order_id}</p><h3>{order.summary}</h3></div><span className="scada-state-chip">{stateLabel(t, order.state)}</span></header>
      <dl className="scada-key-values"><div><dt>{t("workOrders.linkedAsset")}</dt><dd>{order.asset_id ?? "—"}</dd></div><div><dt>{t("workOrders.linkedAlarm")}</dt><dd>{order.source_alarm_code ?? "—"}</dd></div><div><dt>{t("workOrders.team")}</dt><dd>{order.assigned_team ?? "—"}</dd></div><div><dt>{t("event.severity")}</dt><dd>{order.severity ?? "—"}</dd></div></dl>
      <section aria-label={t("workOrders.timeline")}><h4>{t("workOrders.timeline")}</h4><ol className="scada-timeline"><li>{order.created_at ?? "—"} · {stateLabel(t, order.state)}</li></ol></section>
      <div className="scada-inline-actions">{(transitionTargets[order.state] ?? []).map((target) => <button className="scada-button scada-button--approve" type="button" key={target.state} disabled={pendingId === order.work_order_id} onClick={() => transition(order, target)}>{t(target.key)}</button>)}</div>
    </article>)}</div>
  </section>;
}
