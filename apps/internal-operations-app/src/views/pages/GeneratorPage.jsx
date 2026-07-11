import { Navigate, useParams } from "react-router-dom";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import PageHeader from "../components/PageHeader";
import DocumentWorkbench from "../components/DocumentWorkbench";
import { featureCatalog, getFeatureByRoute, getLocalizedFeature } from "../../models/documentModels";
import { useDocumentGenerator } from "../../controllers/useDocumentGenerator";

export default function GeneratorPage() {
  const { documentType } = useParams();
  const { t } = useTranslation();
  const rawFeature = getFeatureByRoute(documentType);
  const feature = useMemo(() => rawFeature ? getLocalizedFeature(t, rawFeature) : null, [rawFeature, t]);
  const fallbackFeature = useMemo(() => getLocalizedFeature(t, featureCatalog[0]), [t]);
  const generator = useDocumentGenerator(feature || fallbackFeature);

  if (!feature) {
    return <Navigate to="/documents/new" replace />;
  }

  return (
    <main className="app-page app-page-workbench">
      <PageHeader
        eyebrow={t("generator.eyebrow")}
        title={feature.name}
        description={feature.summary}
        actions={<span className="page-boundary">{t("common.browserDraftManual")}</span>}
      />
      <DocumentWorkbench feature={feature} generator={generator} />
      <div className={`notification ${generator.actionMessage ? "is-visible" : ""}`} role="status" aria-live="polite">{generator.actionMessage}</div>
    </main>
  );
}
