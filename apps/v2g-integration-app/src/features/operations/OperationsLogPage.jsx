import { PageState, SimulatorNote } from "../../components/PageState.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

export function OperationsLogPage({ data, state = "loading", error }) {
  const { t } = useI18n();
  const orders = data?.work_orders ?? [];
  if (!data || ["loading", "error", "empty"].includes(state)) return <PageState state={state} error={error} />;
  return <section className="scada-page" aria-labelledby="operations-log-title"><header className="scada-page__header"><h2 id="operations-log-title">{t("page.operationsLog")}</h2><SimulatorNote /></header><section className="scada-panel"><ol className="scada-timeline">{orders.map((order) => <li key={order.work_order_id}><strong>{order.created_at ?? "—"}</strong><span>{order.work_order_id} · {order.summary} · {t(`workOrders.state.${order.state}`)}</span></li>)}</ol></section></section>;
}
