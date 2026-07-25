function State({ state, error }) {
  if (state === "loading") return <p className="scada-state" role="status">Loading simulated fleet state…</p>;
  if (state === "error") return <p className="scada-state scada-state--error" role="alert">{error ?? "Fleet state could not be loaded."}</p>;
  if (state === "empty") return <p className="scada-state" role="status">No simulated EVSE assets are available.</p>;
  return null;
}

export function FleetPage({ fleet, state = "loading", error }) {
  if (!fleet || ["loading", "error", "empty"].includes(state)) return <State state={state} error={error} />;
  const evses = Array.isArray(fleet.evses) ? fleet.evses : [];
  const sessions = Array.isArray(fleet.sessions) ? fleet.sessions : [];
  if (!evses.length && !sessions.length) return <State state="empty" />;

  return (
    <section className="scada-page" aria-labelledby="fleet-title">
      <header className="scada-page__header">
        <div>
          <p className="scada-eyebrow">Simulator fleet · {fleet.site_id}</p>
          <h2 id="fleet-title">Fleet</h2>
        </div>
        <p className="scada-data-note">Simulator snapshot · quality not supplied by API</p>
      </header>
      <div className="scada-panel">
        <h3>EVSE availability</h3>
        <div className="scada-table-wrap">
          <table>
            <thead><tr><th scope="col">Asset</th><th scope="col">Name</th><th scope="col">State</th></tr></thead>
            <tbody>{evses.map((evse) => <tr key={evse.asset_id}><td>{evse.asset_id}</td><td>{evse.display_name}</td><td><span className={`scada-state-chip scada-state-chip--${evse.state.toLowerCase()}`}>{evse.state}</span></td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="scada-panel">
        <h3>Active simulated sessions</h3>
        {sessions.length ? <div className="scada-table-wrap"><table><thead><tr><th scope="col">Session</th><th scope="col">EVSE</th><th scope="col">State</th><th scope="col">Imported</th></tr></thead><tbody>{sessions.map((session) => <tr key={session.session_id}><td>{session.session_id}</td><td>{session.asset_id}</td><td>{session.state}</td><td>{session.energy_imported_kwh} kWh</td></tr>)}</tbody></table></div> : <p className="scada-empty">No active simulated sessions.</p>}
      </div>
    </section>
  );
}
