import { FilePlus2, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { featureCatalog, getLocalizedFeature, getRouteForFeature } from "../../models/documentModels";

export default function DocumentLibraryPage() {
  const { t } = useTranslation();

  return (
    <main className="app-page">
      <PageHeader
        eyebrow={t("pages.library.eyebrow")}
        title={t("pages.library.title")}
        description={t("pages.library.description")}
        actions={<Link className="primary-button page-primary-action" to="/documents/new"><FilePlus2 size={15} aria-hidden="true" />{t("common.newDocument")}</Link>}
      />

      <section className="empty-records" aria-labelledby="library-empty-title">
        <FolderOpen size={22} aria-hidden="true" />
        <h2 id="library-empty-title">{t("pages.library.emptyTitle")}</h2>
        <p>{t("pages.library.emptyDescription")}</p>
        <Link className="utility-button" to="/documents/new">{t("common.chooseGenerator")}</Link>
      </section>

      <section className="overview-section" aria-labelledby="library-index-title">
        <div className="section-heading">
          <div>
            <h2 id="library-index-title">{t("pages.library.indexTitle")}</h2>
            <p>{t("pages.library.indexDescription")}</p>
          </div>
        </div>
        <div className="library-table" role="table" aria-label={t("pages.library.tableLabel")}>
          <div className="library-table-row library-table-head" role="row"><span>{t("pages.library.table.record")}</span><span>{t("pages.library.table.output")}</span><span>{t("pages.library.table.route")}</span></div>
          {featureCatalog.map((feature) => {
            const localizedFeature = getLocalizedFeature(t, feature);
            return (
            <Link to={getRouteForFeature(feature.id)} className="library-table-row" role="row" key={feature.id}>
              <strong>{localizedFeature.name}</strong><span>{localizedFeature.outputs.slice(0, 2).join(" / ")}</span><span className="table-route">{t("pages.library.table.openGenerator")}</span>
            </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
