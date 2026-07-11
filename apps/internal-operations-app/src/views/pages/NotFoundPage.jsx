import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <main className="app-page not-found-page">
      <p className="section-label">{t("pages.notFound.eyebrow")}</p>
      <h1>{t("pages.notFound.title")}</h1>
      <p className="page-description">{t("pages.notFound.description")}</p>
      <Link className="utility-button" to="/overview">{t("pages.notFound.return")}</Link>
    </main>
  );
}
