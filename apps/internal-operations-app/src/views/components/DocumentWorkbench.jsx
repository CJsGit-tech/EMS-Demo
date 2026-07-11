import { Copy, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getExportHref, getFileName } from "../../models/documentModels";

export default function DocumentWorkbench({ feature, generator }) {
  const { t } = useTranslation();
  const {
    draft,
    fieldErrors,
    formValues,
    handleCopyDraft,
    handleFieldChange,
    handleGenerate,
    handleDiscardDraft,
    hasLocalWork,
  } = generator;

  return (
    <section className="workbench" aria-labelledby="workspace-title">
      <header className="workbench-header">
        <div>
          <h2 id="workspace-title">{feature.name}</h2>
          <p>{feature.category} / {feature.summary}</p>
        </div>
        <dl className="workbench-register">
          <div><dt>{t("common.inputs")}</dt><dd>{t("common.requiredInputs", { count: feature.fields.length })}</dd></div>
          <div><dt>{t("common.state")}</dt><dd>{t("common.localDraft")}</dd></div>
        </dl>
      </header>

      <div className="workbench-grid">
        <form
          id="generator-form"
          className="source-panel"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            handleGenerate();
          }}
        >
          <div className="panel-heading">
          <div><h3>{t("common.sourceContext")}</h3><p>{t("common.recordFacts")}</p><p className="panel-help">{t("common.sourceContextHelp")}</p></div>
            <span>{t("common.allFieldsRequired")}</span>
          </div>
          <div className="input-form">
            {feature.fields.map((field) => {
              const error = fieldErrors[field.id];
              const errorId = `${feature.id}-${field.id}-error`;
              const inputId = `${feature.id}-${field.id}`;
              return (
                <div key={field.id} className={`field ${field.type === "textarea" ? "field-wide" : ""} ${error ? "has-error" : ""}`}>
                  <label htmlFor={inputId}>{field.label}</label>
                  {field.type === "textarea" ? (
                    <textarea
                      id={inputId}
                      rows="4"
                      value={formValues[field.id]}
                      placeholder={field.placeholder}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : undefined}
                      required
                      onChange={(event) => handleFieldChange(field.id, event.target.value)}
                      onInput={(event) => handleFieldChange(field.id, event.target.value)}
                    />
                  ) : (
                    <input
                      id={inputId}
                      type={field.type}
                      value={formValues[field.id]}
                      placeholder={field.placeholder}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : undefined}
                      required
                      onChange={(event) => handleFieldChange(field.id, event.target.value)}
                      onInput={(event) => handleFieldChange(field.id, event.target.value)}
                    />
                  )}
                  {error ? <small id={errorId} className="field-error">{error}</small> : null}
                </div>
              );
            })}
          </div>
        </form>

        <div className="preview-panel">
          <div className="panel-heading preview-heading">
            <div>
              <h3>{t("common.outputDocument")}</h3>
              <p>{draft.status === "ready" ? t("common.draftReady") : draft.status === "generating" ? t("common.assembling") : t("common.reviewResult")}</p>
            </div>
            <div className="preview-actions">
              {hasLocalWork ? <button type="button" className="utility-button" onClick={handleDiscardDraft}>{t("common.discardLocalDraft")}</button> : null}
              <button type="submit" form="generator-form" className="primary-button" disabled={draft.status === "generating"}>
                {draft.status === "generating" ? t("common.assembling") : t("common.createLocalDraft")}
              </button>
            </div>
          </div>

          <div className={`paper status-${draft.status}`} aria-live="polite" aria-busy={draft.status === "generating"}>
            {draft.status === "idle" ? (
              <div className="empty-preview">
                <p className="paper-overline">{t("common.documentPreview")}</p>
                <strong>{t("common.noDraftAssembled")}</strong>
                <p>{t("common.completeSource")}</p>
              </div>
            ) : null}

            {draft.status === "generating" ? (
              <div className="generation-state">
                <p className="paper-overline">{t("common.documentPreview")}</p>
                <strong>{t("common.formattingFacts")}</strong>
                <span className="progress-rule" aria-hidden="true" />
                <p>{t("common.buildingRegister")}</p>
              </div>
            ) : null}

            {draft.status === "ready" && draft.document ? (
              <article className="draft-document">
                <div className="document-status-line"><span>{draft.document.simulationStatus}</span><span>{draft.document.reviewStatus}</span></div>
                <header className="document-heading">
                  <p className="paper-overline">{t("common.internalDocument")} / {feature.category}</p>
                  <h4>{draft.document.title}</h4>
                  <p>{draft.document.summary}</p>
                </header>
                <div className="document-sections">
                  {draft.document.sections.map((section, index) => (
                    <section key={section.title}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><h5>{section.title}</h5><p>{section.content}</p></div>
                    </section>
                  ))}
                </div>
                <section className="source-register" aria-labelledby="source-record-title">
                  <h5 id="source-record-title">{t("common.sourceRegister")}</h5>
                  <dl>{draft.document.sourceInputs.map((input) => <div key={input.label}><dt>{input.label}</dt><dd>{input.value}</dd></div>)}</dl>
                </section>
                <footer className="document-footer">
                  <span><strong>{draft.document.storageStatus}</strong><time dateTime={draft.document.createdAtIso}>{draft.document.createdAtLabel}</time></span>
                  <div className="draft-actions">
                      <button type="button" className="utility-button" onClick={handleCopyDraft}><Copy size={15} aria-hidden="true" />{t("common.copyRecord")}</button>
                    <a className="utility-button" href={getExportHref(draft.document, t)} download={getFileName(feature)}><Download size={15} aria-hidden="true" />{t("common.exportTxt")}</a>
                  </div>
                </footer>
              </article>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
