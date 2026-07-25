import { MetricStrip } from "../../components/MetricStrip.jsx";
import { TimeSeriesChart } from "../../components/TimeSeriesChart.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";

function formatObservedAt(t, locale, observedAt) {
  if (!observedAt) return t("operations.timestampUnavailable");
  const value = new Date(observedAt);
  return Number.isNaN(value.valueOf()) ? t("operations.timestampUnavailable") : value.toLocaleString(locale);
}

function PageState({ state, message, t }) {
  if (state === "loading") return <p className="scada-state" role="status">{t("operations.loading")}</p>;
  if (state === "error") return <p className="scada-state scada-state--error" role="alert">{message ?? t("operations.error")}</p>;
  if (state === "empty") return <p className="scada-state" role="status">{t("operations.empty")}</p>;
  return null;
}

function normalizedState(value) {
  return String(value ?? "unknown").toLowerCase();
}

function compactExpiry(t, locale, value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return t("operations.timeUnavailable");
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function localizedValue(t, prefix, value, fallback) {
  const key = `${prefix}.${normalizedState(value)}`;
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function OperationsPage({ overview, fleet, alarms, recommendations, historian, state = "loading", error }) {
  const { locale, t } = useI18n();
  if (!overview || ["loading", "error", "empty"].includes(state)) {
    return <PageState state={state} message={error} t={t} />;
  }

  const freshness = overview.data_freshness ?? {};
  const isStale = state === "stale" || freshness.quality === "stale";
  const evses = Array.isArray(fleet?.evses) ? fleet.evses : [];
  const availableEvses = evses.filter((evse) => ["available", "charging"].includes(normalizedState(evse.state))).length;
  const openAlarms = (alarms?.alarms ?? []).filter((alarm) => normalizedState(alarm.state) !== "cleared");
  const recommendation = recommendations?.recommendations?.[0];
  const points = (historian?.points ?? []).map((point) => ({ at: point.occurred_at, value: point.value }));
  const historianQuality = (historian?.points ?? []).some((point) => point.quality === "stale") ? "stale" : freshness.quality;
  const recommendationStatus = recommendation ? localizedValue(t, "dispatch.state", recommendation.status, t("operations.unknown")) : t("operations.noAdvice");

  return (
    <section className="scada-page" aria-labelledby="operations-title">
      <header className="scada-page__header">
        <div>
          <p className="scada-eyebrow">{t("header.siteOverview")} · {overview.site_id}</p>
          <h2 id="operations-title">{t("page.operations")}</h2>
        </div>
        <p className="scada-simulator-status"><span aria-hidden="true">●</span> {t("operations.simulatorStatus")}</p>
      </header>
      {isStale ? <p className="scada-state scada-state--warning" role="status">{t("operations.stale")}</p> : null}
      <MetricStrip
        metrics={[
          {
            label: t("metric.sitePower"),
            value: `${overview.site_power_kw} kW`,
            detail: t("operations.observed", { timestamp: formatObservedAt(t, locale, freshness.observed_at) }),
            quality: freshness.quality,
            status: isStale ? "warning" : "normal",
          },
          {
            label: t("metric.flexibleCapacity"),
            value: `${overview.available_flexible_kw} kW`,
            detail: t("operations.dispatchHeadroom"),
            quality: freshness.quality,
            status: isStale ? "warning" : "normal",
          },
          {
            label: t("operations.evseAvailability"),
            value: evses.length ? `${availableEvses} / ${evses.length}` : "—",
            detail: evses.length ? t("operations.availableOrCharging") : t("operations.fleetSnapshotLoading"),
            quality: freshness.quality,
            status: availableEvses === evses.length && evses.length ? "normal" : "warning",
          },
          {
            label: t("metric.openAlarms"),
            value: String(openAlarms.length),
            detail: openAlarms.length ? t("operations.requiresAttention") : t("operations.noActiveAlarms"),
            quality: freshness.quality,
            status: openAlarms.length ? "warning" : "normal",
          },
        ]}
      />
      <div className="scada-operations-grid">
        <TimeSeriesChart title={t("operations.sitePowerTrajectory")} unit="kW" quality={historianQuality} points={points} />
        <section className="scada-panel scada-fleet-glance" aria-labelledby="fleet-glance-title">
          <div className="scada-panel__heading"><div><p className="scada-eyebrow">{t("operations.fleetPosture")}</p><h3 id="fleet-glance-title">{t("operations.evseAvailability")}</h3></div><strong>{evses.length ? `${availableEvses}/${evses.length}` : "—"}</strong></div>
          {evses.length ? <div className="scada-evse-grid" aria-label={t("operations.evseAvailabilityDescription", { available: availableEvses, total: evses.length })}>{evses.map((evse) => <div className="scada-evse-tile" key={evse.asset_id}><span className={`scada-evse-tile__dot scada-evse-tile__dot--${normalizedState(evse.state)}`} aria-hidden="true" /><span>{evse.display_name}</span><small>{localizedValue(t, "operations.evseState", evse.state, evse.state)}</small></div>)}</div> : <p className="scada-empty">{t("operations.fleetSnapshotUnavailable")}</p>}
        </section>
      </div>
      <div className="scada-operations-grid scada-operations-grid--rail">
        <section className="scada-panel" aria-labelledby="dispatch-glance-title">
          <div className="scada-panel__heading"><div><p className="scada-eyebrow">{t("panel.dispatchPosture")}</p><h3 id="dispatch-glance-title">{recommendation?.status === "awaiting_approval" ? t("operations.humanReviewPending") : t("operations.advisoryOnly")}</h3></div><span className="scada-state-chip">{recommendationStatus}</span></div>
          {recommendation ? <dl className="scada-glance-values"><div><dt>{t("dispatch.expectedImpact")}</dt><dd>{recommendation.expected_site_impact_kw} kW</dd></div><div><dt>{t("operations.confidence")}</dt><dd>{Math.round((recommendation.confidence ?? 0) * 100)}%</dd></div><div><dt>{t("dispatch.expiry")}</dt><dd>{compactExpiry(t, locale, recommendation.expires_at)}</dd></div></dl> : <p className="scada-empty">{t("operations.noDispatchAdvice")}</p>}
        </section>
        <section className="scada-panel" aria-labelledby="alarm-glance-title">
          <div className="scada-panel__heading"><div><p className="scada-eyebrow">{t("panel.attentionRail")}</p><h3 id="alarm-glance-title">{t("nav.activeAlarms")}</h3></div><strong className={openAlarms.length ? "scada-alert-count" : "scada-ok-count"}>{openAlarms.length}</strong></div>
          {openAlarms.length ? <ul className="scada-alarm-list">{openAlarms.slice(0, 3).map((alarm) => <li key={`${alarm.asset_id}-${alarm.code}`}><span className={`scada-severity scada-severity--${alarm.severity}`}>{localizedValue(t, "operations.severity", alarm.severity, alarm.severity)}</span><span><strong>{alarm.code}</strong><small>{alarm.asset_id ?? t("operations.site")} · {alarm.message}</small></span></li>)}</ul> : <p className="scada-empty">{t("operations.noActiveAlarms")}</p>}
        </section>
      </div>
    </section>
  );
}
