import { ArrowRight, FilePlus2, FolderOpen, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { featureCatalog, getLocalizedFeature, getRouteForFeature } from "../../models/documentModels";

export default function OverviewPage() {
  const { t } = useTranslation();

  return (
    <main className="app-page">
      <PageHeader
        eyebrow={t("pages.overview.eyebrow")}
        title={t("pages.overview.title")}
        description={t("pages.overview.description")}
        actions={<Link className="primary-button page-primary-action" to="/documents/new"><FilePlus2 size={15} aria-hidden="true" />{t("common.newDocument")}</Link>}
      />

      <section className="overview-register" aria-label={t("pages.overview.statusLabel")}>
        <div><span className="register-label">{t("pages.overview.status.workspace")}</span><strong>{t("pages.overview.status.workspaceValue")}</strong></div>
        <div><span className="register-label">{t("pages.overview.status.generators")}</span><strong>{t("pages.overview.status.generatorsValue", { count: featureCatalog.length })}</strong></div>
        <div><span className="register-label">{t("pages.overview.status.storage")}</span><strong>{t("pages.overview.status.storageValue")}</strong></div>
        <div><span className="register-label">{t("pages.overview.status.review")}</span><strong>{t("pages.overview.status.reviewValue")}</strong></div>
      </section>

      <section className="overview-section" aria-labelledby="start-title">
        <div className="section-heading">
          <div>
            <h2 id="start-title">{t("pages.overview.startTitle")}</h2>
            <p>{t("pages.overview.startDescription")}</p>
          </div>
        </div>
        <div className="task-list">
          <Link to="/documents/new" className="task-row">
            <span className="task-icon"><FilePlus2 size={17} aria-hidden="true" /></span>
            <span><strong>{t("pages.overview.tasks.createTitle")}</strong><small>{t("pages.overview.tasks.createDescription")}</small></span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link to="/documents" className="task-row">
            <span className="task-icon"><FolderOpen size={17} aria-hidden="true" /></span>
            <span><strong>{t("pages.overview.tasks.libraryTitle")}</strong><small>{t("pages.overview.tasks.libraryDescription")}</small></span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link to="/runs" className="task-row">
            <span className="task-icon"><ListChecks size={17} aria-hidden="true" /></span>
            <span><strong>{t("pages.overview.tasks.runsTitle")}</strong><small>{t("pages.overview.tasks.runsDescription")}</small></span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="overview-section" aria-labelledby="generator-index-title">
        <div className="section-heading">
          <div>
            <h2 id="generator-index-title">{t("pages.overview.indexTitle")}</h2>
            <p>{t("pages.overview.indexDescription")}</p>
          </div>
          <Link className="text-link" to="/documents/new">{t("common.viewAll")} <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
        <div className="index-list">
          {featureCatalog.map((feature, index) => {
            const localizedFeature = getLocalizedFeature(t, feature);
            return (
            <Link to={getRouteForFeature(feature.id)} key={feature.id} className="index-row">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{localizedFeature.name}</strong>
              <small>{localizedFeature.category}</small>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
