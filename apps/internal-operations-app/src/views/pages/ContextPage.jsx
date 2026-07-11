import PageHeader from "../components/PageHeader";
import { useTranslation } from "react-i18next";

export default function ContextPage() {
  const { t } = useTranslation();

  return (
    <main className="app-page">
      <PageHeader
        eyebrow={t("pages.context.eyebrow")}
        title={t("pages.context.title")}
        description={t("pages.context.description")}
      />

      <section className="context-table" aria-label={t("pages.context.label")}>
        <div className="context-row"><span>{t("pages.context.rows.execution.0")}</span><strong>{t("pages.context.rows.execution.1")}</strong><p>{t("pages.context.rows.execution.2")}</p></div>
        <div className="context-row"><span>{t("pages.context.rows.model.0")}</span><strong>{t("pages.context.rows.model.1")}</strong><p>{t("pages.context.rows.model.2")}</p></div>
        <div className="context-row"><span>{t("pages.context.rows.persistence.0")}</span><strong>{t("pages.context.rows.persistence.1")}</strong><p>{t("pages.context.rows.persistence.2")}</p></div>
        <div className="context-row"><span>{t("pages.context.rows.review.0")}</span><strong>{t("pages.context.rows.review.1")}</strong><p>{t("pages.context.rows.review.2")}</p></div>
      </section>

      <section className="overview-section" aria-labelledby="next-layer-title">
        <div className="section-heading">
          <div>
            <h2 id="next-layer-title">{t("pages.context.nextTitle")}</h2>
            <p>{t("pages.context.nextDescription")}</p>
          </div>
        </div>
        <div className="architecture-list">
          <div><span>01</span><strong>{t("pages.context.architecture.source.0")}</strong><p>{t("pages.context.architecture.source.1")}</p></div>
          <div><span>02</span><strong>{t("pages.context.architecture.generation.0")}</strong><p>{t("pages.context.architecture.generation.1")}</p></div>
          <div><span>03</span><strong>{t("pages.context.architecture.handoff.0")}</strong><p>{t("pages.context.architecture.handoff.1")}</p></div>
        </div>
      </section>
    </main>
  );
}
