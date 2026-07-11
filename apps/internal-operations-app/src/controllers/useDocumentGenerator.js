import { startTransition, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  buildStructuredDraft,
  getInitialValues,
  initialDraftState,
  serializeDraft,
} from "../models/documentModels";
import { clearDraftState, readDraftState, writeDraftState } from "../models/draftStorage";

function getGeneratorState(feature, t, language) {
  const saved = readDraftState(feature);
  if (saved.draft.status !== "ready") return saved;

  return {
    ...saved,
    draft: {
      status: "ready",
      document: buildStructuredDraft(feature, saved.formValues, t, language, {
        createdAtIso: saved.draft.document.createdAtIso,
      }),
    },
  };
}

export function useDocumentGenerator(feature) {
  const { i18n, t } = useTranslation();
  const initialState = getGeneratorState(feature, t, i18n.language);
  const [formValues, setFormValues] = useState(() => initialState.formValues);
  const [draft, setDraft] = useState(() => initialState.draft);
  const [fieldErrors, setFieldErrors] = useState({});
  const [actionMessage, setActionMessage] = useState(() => initialState.restored ? t("generator.restored") : "");
  const generationTimer = useRef(null);
  const featureIdRef = useRef(feature.id);
  const languageRef = useRef(i18n.language);
  const hydratedFeatureRef = useRef(feature.id);

  const hasLocalWork = draft.status !== "idle" || Object.values(formValues).some((value) => String(value || "").trim());

  useEffect(() => {
    if (hydratedFeatureRef.current !== feature.id) return;
    writeDraftState(feature.id, { formValues, draft });
  }, [feature.id, formValues, draft]);

  useEffect(() => {
    const featureChanged = featureIdRef.current !== feature.id;
    const languageChanged = languageRef.current !== i18n.language;

    if (featureChanged || languageChanged) {
      if (generationTimer.current) {
        window.clearTimeout(generationTimer.current);
        generationTimer.current = null;
      }
      const restored = getGeneratorState(feature, t, i18n.language);
      setFormValues(restored.formValues);
      setDraft(restored.draft);
      setFieldErrors({});
      setActionMessage(restored.restored ? t("generator.restored") : "");
      hydratedFeatureRef.current = feature.id;
    }

    featureIdRef.current = feature.id;
    languageRef.current = i18n.language;
  }, [feature.id, i18n.language]);

  useEffect(() => {
    function saveBeforeExit() {
      if (hasLocalWork) writeDraftState(feature.id, { formValues, draft });
    }

    window.addEventListener("beforeunload", saveBeforeExit);
    window.addEventListener("pagehide", saveBeforeExit);
    return () => {
      window.removeEventListener("beforeunload", saveBeforeExit);
      window.removeEventListener("pagehide", saveBeforeExit);
    };
  }, [feature.id, formValues, draft, hasLocalWork]);

  useEffect(() => {
    return () => {
      if (generationTimer.current) window.clearTimeout(generationTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!actionMessage) return undefined;
    const timer = window.setTimeout(() => setActionMessage(""), 4200);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  function handleFieldChange(fieldId, value) {
    const nextValues = { ...formValues, [fieldId]: value };
    const draftNeedsReset = draft.status !== "idle";
    const nextDraft = draftNeedsReset ? initialDraftState : draft;
    if (generationTimer.current && draft.status === "generating") {
      window.clearTimeout(generationTimer.current);
      generationTimer.current = null;
    }
    setFormValues(nextValues);
    if (draftNeedsReset) setDraft(initialDraftState);
    writeDraftState(feature.id, { formValues: nextValues, draft: nextDraft });
    if (draftNeedsReset) setActionMessage(t("generator.sourceChanged"));
    if (fieldErrors[fieldId]) {
      setFieldErrors((current) => ({ ...current, [fieldId]: "" }));
    }
  }

  function handleGenerate() {
    const missingFields = feature.fields.filter((field) => !String(formValues[field.id] || "").trim());
    const nextErrors = Object.fromEntries(missingFields.map((field) => [field.id, t("generator.validation.fieldRequired", { field: field.label })]));
    setFieldErrors(nextErrors);
    writeDraftState(feature.id, { formValues, draft });

    if (missingFields.length > 0) {
      setActionMessage(t("generator.validation.completeRequired"));
      window.requestAnimationFrame(() => document.getElementById(`${feature.id}-${missingFields[0].id}`)?.focus());
      return;
    }

    if (generationTimer.current) window.clearTimeout(generationTimer.current);
    setActionMessage("");
    setDraft((current) => ({ status: "generating", document: current.document }));
    generationTimer.current = window.setTimeout(() => {
      const nextDraft = { status: "ready", document: buildStructuredDraft(feature, formValues, t, i18n.language) };
      startTransition(() => {
        setDraft(nextDraft);
      });
      writeDraftState(feature.id, { formValues, draft: nextDraft });
      generationTimer.current = null;
      setActionMessage(t("generator.ready", { name: feature.name }));
    }, 700);
  }

  function handleDiscardDraft() {
    const confirmed = typeof window === "undefined" || typeof window.confirm !== "function" || window.confirm(t("generator.confirmDiscard"));
    if (!confirmed) return;

    if (generationTimer.current) {
      window.clearTimeout(generationTimer.current);
      generationTimer.current = null;
    }
    clearDraftState(feature.id);
    setFormValues(getInitialValues(feature));
    setDraft(initialDraftState);
    setFieldErrors({});
    setActionMessage(t("generator.discarded"));
  }

  async function handleCopyDraft() {
    if (!draft.document) return;
    try {
      await navigator.clipboard.writeText(serializeDraft(draft.document, t));
      setActionMessage(t("generator.copied"));
    } catch {
      setActionMessage(t("generator.clipboardUnavailable"));
    }
  }

  return {
    actionMessage,
    draft,
    fieldErrors,
    formValues,
    handleDiscardDraft,
    handleCopyDraft,
    handleFieldChange,
    handleGenerate,
    hasLocalWork,
  };
}
