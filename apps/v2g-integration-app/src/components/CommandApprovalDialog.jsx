import { useEffect, useId, useRef, useState } from "react";

import "../styles.css";
import { hasFutureExpiry, isApprovalEligible } from "./commandEligibility.js";
import { useI18n } from "../i18n/I18nProvider.jsx";

function getExpiryTimestamp(expiresAt) {
  if (typeof expiresAt !== "string" || expiresAt.trim().length === 0) {
    return null;
  }

  const timestamp = new Date(expiresAt).valueOf();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatExpiry(expiresAt, t) {
  const timestamp = getExpiryTimestamp(expiresAt);
  return timestamp === null ? t("dispatch.unavailable") : new Date(timestamp).toLocaleString();
}

export function CommandApprovalDialog({ recommendation, onApprove, onReject }) {
  const { t } = useI18n();
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
      <form className="scada-dialog__form" aria-label={t("dispatch.dialogLabel")}>
        <p className="scada-eyebrow">{t("dispatch.simulatorOnlyRecommendation")}</p>
        <h2 id={titleId}>{t("dispatch.approve")}</h2>
        <p className="scada-dialog__intro" id={descriptionId}>{t("dispatch.dialogIntro")}</p>
        <dl className="scada-dialog__values">
          <div>
            <dt>{t("dispatch.expiry")}</dt>
            <dd>{formatExpiry(recommendation.expiresAt, t)}</dd>
          </div>
          <div>
            <dt>{t("dispatch.projectedSoc")}</dt>
            <dd>{recommendation.projectedSoc}{typeof recommendation.projectedSoc === "number" ? "%" : ""}</dd>
          </div>
          <div>
            <dt>{t("dispatch.expectedImpact")}</dt>
            <dd>{recommendation.impactKw}{typeof recommendation.impactKw === "number" ? " kW" : ""}</dd>
          </div>
        </dl>
        <section aria-label={t("dispatch.constraints")}>
          <h3>{t("dispatch.constraints")}</h3>
          <ul className="scada-constraints">
            {recommendation.constraints.map((constraint) => (
              <li key={constraint}>{constraint}</li>
            ))}
          </ul>
        </section>
        <label className="scada-reason" htmlFor={reasonId}>
          {t("dispatch.operatorReason")}
          <textarea
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("dispatch.reasonPlaceholder")}
            required
          />
        </label>
        {!hasFutureExpiry(recommendation.expiresAt) ? (
          <p className="scada-expired" role="status">
            {isExpired
              ? t("dispatch.expired")
              : t("dispatch.invalidExpiry")}
          </p>
        ) : null}
        <div className="scada-dialog__actions">
          <button type="button" onClick={reject} disabled={!canAct}>
            {t("dispatch.reject")}
          </button>
          <button type="button" className="scada-button--approve" onClick={approve} disabled={!canAct}>
            {t("dispatch.approve")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
