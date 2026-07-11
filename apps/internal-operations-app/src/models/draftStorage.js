import { getInitialValues, initialDraftState } from "./documentModels";

const storageVersion = 1;
const storagePrefix = "ems-document-draft:";

function getSessionStorage() {
  return typeof window !== "undefined" ? window.sessionStorage : null;
}

export function getDraftStorageKey(featureId) {
  return `${storagePrefix}${featureId}`;
}

function isReadyDraft(draft) {
  return draft?.status === "ready" && draft.document && Array.isArray(draft.document.sections);
}

export function readDraftState(feature) {
  const values = getInitialValues(feature);

  try {
    const raw = getSessionStorage()?.getItem(getDraftStorageKey(feature.id));
    if (!raw) return { formValues: values, draft: initialDraftState, restored: false };

    const saved = JSON.parse(raw);
    if (saved?.version !== storageVersion) return { formValues: values, draft: initialDraftState, restored: false };
    const savedValues = saved?.formValues && typeof saved.formValues === "object" ? saved.formValues : {};
    const hasSavedWork = Object.values(savedValues).some((value) => String(value || "").trim()) || isReadyDraft(saved.draft);
    return {
      formValues: { ...values, ...savedValues },
      draft: isReadyDraft(saved.draft) ? saved.draft : initialDraftState,
      restored: hasSavedWork,
    };
  } catch {
    return { formValues: values, draft: initialDraftState, restored: false };
  }
}

export function writeDraftState(featureId, { formValues, draft }) {
  try {
    const hasValues = Object.values(formValues || {}).some((value) => String(value || "").trim());
    const hasDraft = draft?.status === "ready" && draft.document;
    const storage = getSessionStorage();
    if (!hasValues && !hasDraft) {
      storage?.removeItem(getDraftStorageKey(featureId));
      return true;
    }

    storage?.setItem(getDraftStorageKey(featureId), JSON.stringify({
      version: storageVersion,
      savedAt: new Date().toISOString(),
      formValues,
      draft: draft?.status === "generating" ? initialDraftState : draft,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearDraftState(featureId) {
  try {
    getSessionStorage()?.removeItem(getDraftStorageKey(featureId));
  } catch {
    // Session recovery remains best effort when browser storage is blocked.
  }
}
