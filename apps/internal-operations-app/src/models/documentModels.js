import { featureCatalog } from "../mockData";

export { featureCatalog } from "../mockData";

export const initialDraftState = {
  status: "idle",
  document: null,
};

export const featureRouteMap = {
  "tender-generation": "tender",
  "financial-report-generation": "financial-report",
  "pptx-content-generation": "pptx",
  "ops-memo-generation": "ops-memo",
};

export const navigationGroups = [
  {
    labelKey: "navigation.groups.workspace",
    items: [
      { labelKey: "navigation.items.overview", to: "/overview", end: true },
      { labelKey: "navigation.items.newDocument", to: "/documents/new", end: true },
    ],
  },
  {
    labelKey: "navigation.groups.records",
    items: [
      { labelKey: "navigation.items.library", to: "/documents", end: true },
      { labelKey: "navigation.items.runs", to: "/runs", end: true },
    ],
  },
  {
    labelKey: "navigation.groups.system",
    items: [{ labelKey: "navigation.items.context", to: "/context", end: true }],
  },
];

export function getInitialValues(feature) {
  return Object.fromEntries(feature.fields.map((field) => [field.id, ""]));
}

export function getFeatureByRoute(routeKey) {
  const featureId = Object.entries(featureRouteMap).find(([, route]) => route === routeKey)?.[0];
  return featureCatalog.find((feature) => feature.id === featureId) || null;
}

export function getRouteForFeature(featureId) {
  const routeKey = featureRouteMap[featureId];
  return routeKey ? `/documents/${routeKey}` : "/documents/new";
}

export function getLocalizedFeature(t, feature) {
  const root = `features.${feature.id}`;
  return {
    ...feature,
    name: t(`${root}.name`),
    category: t(`${root}.category`),
    summary: t(`${root}.summary`),
    outputs: feature.outputs.map((_, index) => t(`${root}.outputs.${index}`)),
    fields: feature.fields.map((field) => ({
      ...field,
      label: t(`${root}.fields.${field.id}.label`),
      placeholder: field.placeholder ? t(`${root}.fields.${field.id}.placeholder`) : undefined,
    })),
  };
}

export function getFileName(feature) {
  const slug = (feature.id || feature.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${slug}-local-draft.txt`;
}

function buildDraftSections(featureId, values, t) {
  const root = `features.${featureId}.draft.sections`;
  const sectionBuilders = {
    "tender-generation": [
      {
        title: t(`${root}.cover.0`),
        content: t(`${root}.cover.1`, values),
      },
      {
        title: t(`${root}.scope.0`),
        content: t(`${root}.scope.1`, values),
      },
      {
        title: t(`${root}.exclusions.0`),
        content: t(`${root}.exclusions.1`, values),
      },
      {
        title: t(`${root}.checklist.0`),
        content: t(`${root}.checklist.1`, values),
      },
    ],
    "financial-report-generation": [
      {
        title: t(`${root}.executive.0`),
        content: t(`${root}.executive.1`, values),
      },
      {
        title: t(`${root}.variance.0`),
        content: t(`${root}.variance.1`, values),
      },
      {
        title: t(`${root}.cash.0`),
        content: t(`${root}.cash.1`, values),
      },
      {
        title: t(`${root}.followUp.0`),
        content: t(`${root}.followUp.1`, values),
      },
    ],
    "pptx-content-generation": [
      {
        title: t(`${root}.storyline.0`),
        content: t(`${root}.storyline.1`, values),
      },
      {
        title: t(`${root}.headlines.0`),
        content: t(`${root}.headlines.1`, values),
      },
      {
        title: t(`${root}.notes.0`),
        content: t(`${root}.notes.1`, values),
      },
      {
        title: t(`${root}.ask.0`),
        content: t(`${root}.ask.1`, values),
      },
    ],
    "ops-memo-generation": [
      {
        title: t(`${root}.context.0`),
        content: t(`${root}.context.1`, values),
      },
      {
        title: t(`${root}.impact.0`),
        content: t(`${root}.impact.1`, values),
      },
      {
        title: t(`${root}.action.0`),
        content: t(`${root}.action.1`, values),
      },
      {
        title: t(`${root}.handoff.0`),
        content: t(`${root}.handoff.1`, values),
      },
    ],
  };

  return sectionBuilders[featureId];
}

export function buildStructuredDraft(feature, values, t, language = "en", options = {}) {
  const root = `features.${feature.id}.draft`;
  const candidateDate = options.createdAtIso ? new Date(options.createdAtIso) : new Date();
  const createdAt = Number.isNaN(candidateDate.getTime()) ? new Date() : candidateDate;

  return {
    title: t(`${root}.title`, values),
    summary: t(`${root}.summary`, values),
    sections: buildDraftSections(feature.id, values, t),
    sourceInputs: feature.fields.map((field) => ({ label: field.label, value: values[field.id] })),
    createdAtIso: createdAt.toISOString(),
    createdAtLabel: createdAt.toLocaleString(language === "zh-TW" ? "zh-TW" : "en-US", { dateStyle: "medium", timeStyle: "short" }),
    simulationStatus: t("generator.status.browser"),
    reviewStatus: t("generator.status.review"),
    storageStatus: t("generator.status.storage"),
  };
}

export function serializeDraft(document, t) {
  const copy = (key, fallback) => t ? t(key) : fallback;
  const sectionText = document.sections
    .map((section, index) => `${String(index + 1).padStart(2, "0")} ${section.title}\n${section.content}`)
    .join("\n\n");
  const sourceText = document.sourceInputs.map((input) => `${input.label}: ${input.value}`).join("\n");

  return [
    document.title,
    "",
    copy("generator.export.documentStatus", "DOCUMENT STATUS"),
    document.simulationStatus,
    document.reviewStatus,
    document.storageStatus,
    "",
    copy("generator.export.summary", "SUMMARY"),
    document.summary,
    "",
    copy("generator.export.sections", "DOCUMENT SECTIONS"),
    sectionText,
    "",
    copy("generator.export.sourceInputs", "SOURCE / CONTEXT INPUTS"),
    sourceText,
    "",
    `${copy("generator.export.timestamp", "TIMESTAMP")}\n${document.createdAtLabel} (${document.createdAtIso})`,
    "",
  ].join("\n");
}

export function getExportHref(document, t) {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(serializeDraft(document, t))}`;
}
