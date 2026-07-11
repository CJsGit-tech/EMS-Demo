import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PageHeader from "../components/PageHeader";
import { activityFeed } from "../../mockData";

export default function RunsPage() {
  const { t } = useTranslation();

  return (
    <main className="app-page">
      <PageHeader
        eyebrow={t("pages.runs.eyebrow")}
        title={t("pages.runs.title")}
        description={t("pages.runs.description")}
      />

      <section className="boundary-note" aria-labelledby="runs-boundary-title">
        <div className="boundary-index">01</div>
        <div>
          <h2 id="runs-boundary-title">{t("pages.runs.emptyTitle")}</h2>
          <p>{t("pages.runs.emptyDescription")}</p>
          <Link className="text-link" to="/context">{t("pages.runs.readContext")}</Link>
        </div>
      </section>

      <section className="overview-section" aria-labelledby="activity-pattern-title">
        <div className="section-heading">
          <div>
            <h2 id="activity-pattern-title">{t("pages.runs.activityTitle")}</h2>
            <p>{t("pages.runs.activityDescription")}</p>
          </div>
        </div>
        <div className="activity-list">
          {activityFeed.map((activity) => (
            <div className="activity-row" key={activity.id}>
              <span className="activity-dot" aria-hidden="true" />
              <div><strong>{t(`pages.runs.activity.${activity.id}.title`)}</strong><p>{t(`pages.runs.activity.${activity.id}.detail`)}</p></div>
              <time>{t(`pages.runs.activity.${activity.id}.time`, activity.time)}</time>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
