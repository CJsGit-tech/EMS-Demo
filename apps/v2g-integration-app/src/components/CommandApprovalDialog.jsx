import { useId, useState } from "react";

import "../styles.css";

function formatExpiry(expiresAt) {
  const expiry = new Date(expiresAt);
  return Number.isNaN(expiry.valueOf()) ? "Unavailable" : expiry.toLocaleString();
}

export function CommandApprovalDialog({ recommendation, onApprove, onReject }) {
  const [reason, setReason] = useState("");
  const titleId = useId();

  if (!recommendation) return null;

  const isExpired = new Date(recommendation.expiresAt).valueOf() <= Date.now();
  const canAct = reason.trim().length > 0 && !isExpired;

  const approve = () => {
    if (canAct) onApprove(recommendation.id, reason.trim());
  };

  const reject = () => {
    if (canAct) onReject(recommendation.id, reason.trim());
  };

  return (
    <dialog className="scada-dialog" open aria-labelledby={titleId} aria-modal="true">
      <form className="scada-dialog__form" aria-label="Simulated command approval">
        <p className="scada-eyebrow">Simulator-only recommendation</p>
        <h2 id={titleId}>Review simulated command</h2>
        <dl className="scada-dialog__values">
          <div>
            <dt>Expires at</dt>
            <dd>{formatExpiry(recommendation.expiresAt)}</dd>
          </div>
          <div>
            <dt>Projected SOC</dt>
            <dd>{recommendation.projectedSoc}%</dd>
          </div>
          <div>
            <dt>Impact</dt>
            <dd>{recommendation.impactKw} kW</dd>
          </div>
        </dl>
        <section aria-label="Simulated command constraints">
          <h3>Constraints</h3>
          <ul className="scada-constraints">
            {recommendation.constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        </section>
        <label className="scada-reason" htmlFor="operator-reason">
          Operator reason
          <textarea
            id="operator-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Record why this simulated action is appropriate"
            required
          />
        </label>
        {isExpired ? (
          <p className="scada-expired" role="status">
            This simulated recommendation has expired and cannot be actioned.
          </p>
        ) : null}
        <div className="scada-dialog__actions">
          <button type="button" onClick={reject} disabled={!canAct}>
            Reject simulated command
          </button>
          <button type="button" className="scada-button--approve" onClick={approve} disabled={!canAct}>
            Approve simulated command
          </button>
        </div>
      </form>
    </dialog>
  );
}
