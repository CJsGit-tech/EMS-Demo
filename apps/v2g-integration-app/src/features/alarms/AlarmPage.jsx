function State({ state, error }) {
  if (state === "loading") return <p className="scada-state" role="status">Loading simulator alarms…</p>;
  if (state === "error") return <p className="scada-state scada-state--error" role="alert">{error ?? "Alarm data could not be loaded."}</p>;
  if (state === "empty") return <p className="scada-state" role="status">No simulator alarms are currently available.</p>;
  return null;
}

export function AlarmPage({ alarms, state = "loading", error }) {
  if (!alarms || ["loading", "error", "empty"].includes(state)) return <State state={state} error={error} />;
  const alarmItems = Array.isArray(alarms.alarms) ? alarms.alarms : [];
  if (!alarmItems.length) return <State state="empty" />;

  return (
    <section className="scada-page" aria-labelledby="alarms-title">
      <header className="scada-page__header"><div><p className="scada-eyebrow">Simulator event reduction · {alarms.site_id}</p><h2 id="alarms-title">Alarms</h2></div><p className="scada-data-note">Read-only alarm feed</p></header>
      <div className="scada-panel"><div className="scada-table-wrap"><table><thead><tr><th scope="col">Severity</th><th scope="col">Source</th><th scope="col">Alarm</th><th scope="col">State</th><th scope="col">Raised</th></tr></thead><tbody>{alarmItems.map((alarm) => <tr key={`${alarm.asset_id}-${alarm.code}`}><td><span className={`scada-severity scada-severity--${alarm.severity}`}>{alarm.severity}</span></td><td>{alarm.asset_id ?? "site"}</td><td><strong>{alarm.code}</strong><br /><span className="scada-muted">{alarm.message}</span></td><td>{alarm.state}</td><td>{new Date(alarm.raised_at).toLocaleString()}</td></tr>)}</tbody></table></div></div>
    </section>
  );
}
