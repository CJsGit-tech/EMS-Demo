import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDeferredValue, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { featureCatalog, getLocalizedFeature, getRouteForFeature } from "../../models/documentModels";

export default function NewDocumentPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalized = deferredQuery.trim().toLowerCase();
  const localizedFeatures = featureCatalog.map((feature) => getLocalizedFeature(t, feature));
  const filteredFeatures = normalized
    ? localizedFeatures.filter((feature) => [feature.name, feature.category, feature.summary].some((value) => value.toLowerCase().includes(normalized)))
    : localizedFeatures;

  return (
    <main className="app-page">
      <PageHeader
        eyebrow={t("pages.newDocument.eyebrow")}
        title={t("pages.newDocument.title")}
        description={t("pages.newDocument.description")}
      />

      <section className="catalog-section" aria-labelledby="catalog-title">
        <div className="section-bar">
          <div className="section-heading">
            <div>
              <h2 id="catalog-title">{t("pages.newDocument.sectionTitle")}</h2>
              <p>{t("pages.newDocument.sectionDescription")}</p>
            </div>
          </div>
          <label className="search-field" htmlFor="feature-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">{t("common.searchDocumentTypes")}</span>
            <input id="feature-search" type="search" value={query} aria-label={t("common.searchDocumentTypes")} onChange={(event) => setQuery(event.target.value)} placeholder={t("common.filterDocumentTypes")} />
            {query ? <button type="button" className="clear-search" aria-label={t("common.clearSearch")} onClick={() => setQuery("")}><X size={15} /></button> : null}
          </label>
        </div>

        {filteredFeatures.length > 0 ? (
          <div className="template-list">
            {filteredFeatures.map((feature) => {
              const templateNumber = String(featureCatalog.findIndex((item) => item.id === feature.id) + 1).padStart(2, "0");
              return (
                <Link key={feature.id} to={getRouteForFeature(feature.id)} className="template-row template-link">
                  <span className="template-number">{templateNumber}</span>
                  <span className="template-name"><strong>{feature.name}</strong><small>{feature.category}</small></span>
                  <span className="template-output">{feature.outputs.slice(0, 2).join(" / ")}</span>
                  <span className="template-action">{t("common.open")}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty-catalog" role="status">
            <strong>{t("common.noDocumentTypes", { query })}</strong>
            <p>{t("common.trySearch")}</p>
            <button type="button" className="utility-button" onClick={() => setQuery("")}>{t("common.clearSearch")}</button>
          </div>
        )}
      </section>
    </main>
  );
}
