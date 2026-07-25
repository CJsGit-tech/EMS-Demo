import { useEffect, useId, useRef, useState } from "react";

import "../styles.css";
import { hasFutureExpiry, isApprovalEligible } from "./commandEligibility.js";

function getExpiryTimestamp(expiresAt) {
  if (typeof expiresAt !== "string" || expiresAt.trim().length === 0) {
    return null;
  }

  const timestamp = new Date(expiresAt).valueOf();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatExpiry(expiresAt) {
  const timestamp = getExpiryTimestamp(expiresAt);
  return timestamp === null ? "Unavailable" : new Date(timestamp).toLocaleString();
}

export function CommandApprovalDialog({ recommendation, onApprove, onReject }) {
  const dialogRef = useRef(null);
  const [reason, setReason] = useState("");
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!recommendation || !dialog) return undefined;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const restoreFocus = () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
    const cancelDialog = (event) => {
      event.preventDefault();
      if (dialog.open) dialog.close();
    };

    dialog.addEventListener("cancel", cancelDialog);
    dialog.addEventListener("close", restoreFocus);

    if (!dialog.open) dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
      dialog.removeEventListener("cancel", cancelDialog);
      dialog.removeEventListener("close", restoreFocus);
    };
  }, [recommendation]);

  if (!recommendation) return null;

  const expiryTimestamp = getExpiryTimestamp(recommendation.expiresAt);
  const hasValidExpiry = expiryTimestamp !== null;
  const isExpired = hasValidExpiry && expiryTimestamp <= Date.now();
  const canAct = reason.trim().length > 0 && isApprovalEligible(recommendation);

  const approve = () => {
    if (canAct) onApprove(recommendation.commandId, reason.trim());
  };

  const reject = () => {
    if (canAct) onReject(recommendation.commandId, reason.trim());
  };

  return (
    <dialog ref={dialogRef} className="scada-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <form className="scada-dialog__form" aria-label="Simulated command approval">
        <p className="scada-eyebrow">Simulator-only recommendation</p>
        <h2 id={titleId}>Approve simulated command</h2>
        <p className="scada-dialog__intro" id={descriptionId}>This records a human decision in the local simulator only. It does not contact equipment, vehicles, or the grid.</p>
        <dl className="scada-dialog__values">
          <div>
            <dt>Expires at</dt>
            <dd>{formatExpiry(recommendation.expiresAt)}</dd>
          </div>
          <div>
            <dt>Projected SOC</dt>
            <dd>{recommendation.projectedSoc}{typeof recommendation.projectedSoc === "number" ? "%" : ""}</dd>
          </div>
          <div>
            <dt>Impact</dt>
            <dd>{recommendation.impactKw}{typeof recommendation.impactKw === "number" ? " kW" : ""}</dd>
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
        <label className="scada-reason" htmlFor={reasonId}>
          Operator reason
          <textarea
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Record why this simulated action is appropriate"
            required
          />
        </label>
        {!hasFutureExpiry(recommendation.expiresAt) ? (
          <p className="scada-expired" role="status">
            {isExpired
              ? "This simulated recommendation has expired and cannot be actioned."
              : "This simulated recommendation has no valid expiry and cannot be actioned."}
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
