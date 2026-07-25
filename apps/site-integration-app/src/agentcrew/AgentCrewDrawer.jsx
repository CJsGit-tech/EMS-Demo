import { Check, ChevronDown, ChevronUp, CircleAlert, Clock3, FileText, LockKeyhole, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { approveAgentCrewRun, confirmAgentCrewReport, createAgentCrewRun, getAgentCrewAudit, recallAgentCrewMemory, reduceAgentCrewStreamEvent, saveAgentCrewPreference } from "./api";
import { createTranslator } from "../i18nConfig";

const QUICK_STARTS = [
  { labelKey: "agentCrewQuickStartReport", message: "Create a site operations report draft" },
  { labelKey: "agentCrewQuickStartDevices", message: "Which devices need attention today?" },
  { labelKey: "agentCrewQuickStartEnergy", message: "Analyze the latest energy trend" },
];

function pluralizedCount(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function providerLabel(provider, t) {
  if (!provider) return "GPT-5 mini";
  if (provider?.model === "gpt-5-mini") return "GPT-5 mini";
  if (typeof provider?.model === "string") return provider.model;
  return provider?.mode === "deterministic-fixtures" ? t("agentCrewDemoMode") : "";
}

function streamedProvider(run) {
  if (run?.provider) return run.provider;
  return run?.streamEvents?.find((event) => event?.type === "run.started")?.data?.provider || null;
}

export default function AgentCrewDrawer({ siteContext, onClose, t: externalTranslator }) {
  const t = externalTranslator || createTranslator("en");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [run, setRun] = useState(null);
  const [streamProvider, setStreamProvider] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showAudit, setShowAudit] = useState(false);
  const [audit, setAudit] = useState(null);
  const [showMemory, setShowMemory] = useState(false);
  const [memory, setMemory] = useState(null);
  const [preferenceDraft, setPreferenceDraft] = useState("");
  const [utilityError, setUtilityError] = useState("");
  const [utilityBusy, setUtilityBusy] = useState(false);
  const [reportConfirmationBusy, setReportConfirmationBusy] = useState(false);

  const promptSuggestions = useMemo(() => QUICK_STARTS, []);
  const mission = useMemo(() => {
    if (!run) return null;
    return {
      demoMissionPreview: Boolean(run.demoMissionPreview),
      steps: Array.isArray(run.steps) ? run.steps : [],
      evidence: Array.isArray(run.evidence) ? run.evidence : [],
      limitations: Array.isArray(run.limitations) ? run.limitations : [],
      provenance: run.provenance && typeof run.provenance === "object" ? run.provenance : null,
    };
  }, [run]);

  async function submit(nextMessage = message) {
    const text = nextMessage.trim();
    if (!text || isRunning) return;
    setMessage("");
    setStreamProvider(null);
    let receivedAssistantDelta = false;
    setMessages((current) => [...current, { role: "user", text }, { role: "assistant", text: "", streaming: true }]);
    setRun({ requestMessage: text, status: "running", events: [], activities: [], citations: [], assistantText: "", steps: [], evidence: [], limitations: [], provenance: null });
    setIsRunning(true);
    try {
      const result = await createAgentCrewRun(siteContext, text, (event) => {
        if (event.type === "run.started" && event.data?.provider) setStreamProvider(event.data.provider);
        setRun((current) => reduceAgentCrewStreamEvent(current, event));
        if (event.type === "assistant.delta" && typeof event.data?.delta === "string") {
          receivedAssistantDelta = true;
          setMessages((current) => {
            const index = current.length - 1;
            const last = current[index];
            if (!last || last.role !== "assistant") return current;
            return [...current.slice(0, index), { ...last, text: `${last.text}${event.data.delta}`, streaming: true }];
          });
        }
      });
      setRun(result);
      if (!receivedAssistantDelta) {
        setMessages((current) => {
          const index = current.length - 1;
          const last = current[index];
          if (!last || last.role !== "assistant") return [...current, { role: "assistant", text: result.summary || t("agentCrewSpecialistResult") }];
          return [...current.slice(0, index), { ...last, text: result.summary || t("agentCrewSpecialistResult"), streaming: false }];
        });
      }
    } catch (error) {
      setRun((current) => ({ ...current, status: "failed", error: error.message || t("agentCrewUnavailable") }));
      setMessages((current) => {
        const index = current.length - 1;
        const last = current[index];
        const text = error.message || t("agentCrewUnavailable");
        if (!last || last.role !== "assistant") return [...current, { role: "assistant", text }];
        return [...current.slice(0, index), { ...last, text, streaming: false }];
      });
    } finally {
      setIsRunning(false);
    }
  }

  async function toggleAudit() {
    const next = !showAudit;
    setShowAudit(next);
    if (next && !audit) {
      setUtilityError("");
      setUtilityBusy(true);
      try {
        setAudit(await getAgentCrewAudit(siteContext));
      } catch (error) {
        setUtilityError(error.message || t("agentCrewAuditUnavailable"));
      } finally {
        setUtilityBusy(false);
      }
    }
  }

  async function toggleMemory() {
    const next = !showMemory;
    setShowMemory(next);
    if (next && !memory) {
      setUtilityError("");
      setUtilityBusy(true);
      try {
        setMemory(await recallAgentCrewMemory(siteContext, `session-${siteContext.userId}-${siteContext.siteId}`));
      } catch (error) {
        setUtilityError(error.message || t("agentCrewMemoryUnavailable"));
      } finally {
        setUtilityBusy(false);
      }
    }
  }

  async function savePreference() {
    const value = preferenceDraft.trim();
    if (!value) return;
    setUtilityError("");
    setUtilityBusy(true);
    try {
      await saveAgentCrewPreference(siteContext, "response_style", value);
      setPreferenceDraft("");
      setMemory(await recallAgentCrewMemory(siteContext, `session-${siteContext.userId}-${siteContext.siteId}`));
    } catch (error) {
      setUtilityError(error.message || t("agentCrewPreferenceUnavailable"));
    } finally {
      setUtilityBusy(false);
    }
  }

  async function approve(mode) {
    try {
      setIsRunning(true);
      const next = await approveAgentCrewRun(siteContext, run.runId, mode, run.requestMessage);
      setRun(next);
    } catch {
      setRun((current) => ({ ...current, status: "failed", message: t("agentCrewApprovalUnavailable") }));
    } finally {
      setIsRunning(false);
    }
  }

  async function confirmReport() {
    if (!run?.reportDraftId || reportConfirmationBusy) return;
    setReportConfirmationBusy(true);
    setUtilityError("");
    try {
      const report = await confirmAgentCrewReport(siteContext, run.reportDraftId);
      setRun((current) => ({ ...current, reportDraftState: report.state, reportDraftVersion: report.version, result: { ...current.result, draft: { ...current.result?.draft, ...report } } }));
    } catch (error) {
      setUtilityError(error.message || t("agentCrewRevisionUnavailable"));
    } finally {
      setReportConfirmationBusy(false);
    }
  }

  return (
    <aside id="agentcrew-drawer" className="agentcrew-drawer" aria-label="AgentCrew" aria-live="polite">
      <header className="agentcrew-header">
        <div>
          <div className="agentcrew-eyebrow"><Sparkles size={13} /> {t("agentCrewLabel")} <span>{t("agentCrewSiteScoped")}</span></div>
          <h2>{t("agentCrewOperatorCopilot")}</h2>
          <p><LockKeyhole size={13} /> {t("agentCrewCurrentSiteOnly", { site: siteContext.siteName })}</p>
        </div>
        <button type="button" className="icon-button" aria-label={t("agentCrewClose")} title={t("agentCrewClose")} onClick={onClose}><X size={17} /></button>
      </header>

      <div className="agentcrew-session-strip">
        <span><ShieldCheck size={14} /> {t("agentCrewSessionReset")}</span>
        <span className="agentcrew-session-status"><span className="agentcrew-status-dot" /> {run?.demoMode ? t("agentCrewDemoMode") : t("agentCrewLive")}</span>
      </div>

      <section className="agentcrew-body">
        {messages.length === 0 ? (
          <div className="agentcrew-empty">
            <div className="agentcrew-empty-icon"><Sparkles size={18} /></div>
            <div className="agentcrew-empty-kicker">{t("agentCrewQuickStarts")}</div>
            <h3>{t("agentCrewWhatInspect")}</h3>
            <p>{t("agentCrewPromptHint")}</p>
            <div className="agentcrew-suggestions">
              {promptSuggestions.map((prompt) => <button type="button" key={prompt.message} onClick={() => submit(prompt.message)}><span>{t(prompt.labelKey)}</span><Send size={13} aria-hidden="true" /></button>)}
            </div>
          </div>
        ) : (
          <div className="agentcrew-message-list">
            {messages.map((item, index) => <div className={`agentcrew-message ${item.role}`} key={`${item.role}-${index}`}><span>{item.role === "user" ? "You" : "AgentCrew"}</span>{item.role === "assistant" && item.streaming ? <small>{providerLabel(streamProvider || streamedProvider(run), t)}</small> : null}<p>{item.text || (item.streaming ? t("agentCrewStreaming") : "")}</p></div>)}
          </div>
        )}

        {isRunning ? <div className="agentcrew-running" role="status"><Clock3 size={15} /><span>{t("agentCrewRouting")}{providerLabel(streamProvider || streamedProvider(run), t) ? ` · ${providerLabel(streamProvider || streamedProvider(run), t)}` : ""}</span></div> : null}

        {run ? (
          <section className="agentcrew-run-card">
            <button type="button" className="agentcrew-run-toggle" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls="agentcrew-run-details">
              <span><span className="agentcrew-run-kicker">Run {run.runId?.slice(0, 12)}</span><strong>{run.title || "AgentCrew result"}</strong></span>
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expanded ? (
              <>
                <div id="agentcrew-run-details" className="agentcrew-run-details">
                <div className="agentcrew-run-events">
                  {providerLabel(streamProvider || streamedProvider(run), t) ? <div className="agentcrew-run-event"><Check size={14} /><span>{t("agentCrewProvider")}: {providerLabel(streamProvider || streamedProvider(run), t)}</span></div> : null}
                  {(run.events || []).filter((event) => !["tool.call", "web_search.started", "web_search.completed"].includes(event.kind)).map((event, index) => <div className="agentcrew-run-event" key={`${event.kind}-${index}`}><Check size={14} /><span>{event.label}</span></div>)}
                </div>
                {run.activities?.length ? <section className="agentcrew-mission-section" aria-labelledby="agentcrew-activity-title"><div className="agentcrew-section-heading"><span className="agentcrew-section-kicker">Live activity</span><h3 id="agentcrew-activity-title">{t("agentCrewActivity")}</h3></div><ul className="agentcrew-evidence-list">{run.activities.map((activity) => <li key={activity.id}><strong>{activity.label}</strong></li>)}</ul></section> : null}
                {run.citations?.length ? <section className="agentcrew-mission-section" aria-labelledby="agentcrew-citations-title"><div className="agentcrew-section-heading"><span className="agentcrew-section-kicker">Web grounding</span><h3 id="agentcrew-citations-title">{t("agentCrewCitations")}</h3></div><ul className="agentcrew-evidence-list">{run.citations.map((citation) => <li key={citation.url}><a href={citation.url} target="_blank" rel="noreferrer">{citation.title}</a></li>)}</ul></section> : null}
                <section className="agentcrew-mission-section agentcrew-trust-summary" aria-labelledby="agentcrew-trust-summary-title">
                  <div className="agentcrew-section-heading">
                    <span className="agentcrew-section-kicker">Mission record</span>
                    <h3 id="agentcrew-trust-summary-title">Trust summary</h3>
                  </div>
                  <dl className="agentcrew-trust-counts">
                    <div><dt>Agents</dt><dd>{pluralizedCount(mission.steps.length, "agent")}</dd></div>
                    <div><dt>Evidence</dt><dd>{pluralizedCount(mission.evidence.length, "evidence item")}</dd></div>
                    <div><dt>Limitations</dt><dd>{pluralizedCount(mission.limitations.length, "limitation")}</dd></div>
                  </dl>
                </section>
                <section className="agentcrew-mission-section" aria-labelledby="agentcrew-timeline-title">
                  <div className="agentcrew-section-heading">
                    <span className="agentcrew-section-kicker">{mission.demoMissionPreview ? "Demo collaboration preview" : "Specialist chain"}</span>
                    <h3 id="agentcrew-timeline-title">Mission handoff</h3>
                  </div>
                  {mission.steps.length ? (
                    <ol className="agentcrew-timeline" aria-label="Mission handoff timeline">
                      {mission.steps.map((step, index) => (
                        <li className="agentcrew-timeline-step" data-status={step.status || "unknown"} key={step.id || `${step.role}-${index}`}>
                          <span className="agentcrew-timeline-marker" aria-hidden="true">{index + 1}</span>
                          <article className="agentcrew-step-card">
                            <div className="agentcrew-step-heading">
                              <h4>{step.role || "AgentCrew"}</h4>
                              <span className="agentcrew-step-status"><span className="sr-only">Status: </span>{step.statusLabel || step.status || "Unknown"}</span>
                            </div>
                            {step.result ? <p>{step.result}</p> : <p className="agentcrew-empty-detail">No specialist result was returned for this step.</p>}
                            <dl className="agentcrew-step-metadata">
                              <div><dt>Evidence</dt><dd>{pluralizedCount(Number(step.evidenceCount) || 0, "evidence record")}</dd></div>
                              {step.handoff ? <div><dt>Handoff</dt><dd>Handoff to {step.handoff}</dd></div> : null}
                            </dl>
                          </article>
                        </li>
                      ))}
                    </ol>
                  ) : <p className="agentcrew-empty-detail">No specialist handoffs were recorded for this run.</p>}
                </section>
                <section className="agentcrew-mission-section" aria-labelledby="agentcrew-evidence-title">
                  <div className="agentcrew-section-heading">
                    <span className="agentcrew-section-kicker">Grounding record</span>
                    <h3 id="agentcrew-evidence-title">Evidence</h3>
                  </div>
                  {mission.evidence.length ? (
                    <ul className="agentcrew-evidence-list">
                      {mission.evidence.map((item) => <li key={item.id || item.label}><strong>{item.label || "Untitled evidence"}</strong><span>{item.statusLabel || item.status || "Unknown"}</span>{item.detail ? <p>{item.detail}</p> : null}</li>)}
                    </ul>
                  ) : <p className="agentcrew-empty-detail">No evidence items were provided for this run.</p>}
                </section>
                <section className="agentcrew-mission-section" aria-labelledby="agentcrew-provenance-title">
                  <div className="agentcrew-section-heading">
                    <span className="agentcrew-section-kicker">Source lineage</span>
                    <h3 id="agentcrew-provenance-title">Provenance</h3>
                  </div>
                  {mission.provenance ? (
                    <dl className="agentcrew-provenance-list">
                      {mission.provenance.generatedAt ? <div><dt>Generated</dt><dd>{mission.provenance.generatedAt}</dd></div> : null}
                      {mission.provenance.draftState ? <div><dt>Record state</dt><dd>{mission.provenance.draftState}</dd></div> : null}
                      <div><dt>Sources</dt><dd>{mission.provenance.sources?.length ? <ul>{mission.provenance.sources.map((source) => <li key={source}>{source}</li>)}</ul> : "No source identifiers were supplied."}</dd></div>
                    </dl>
                  ) : <p className="agentcrew-empty-detail">No provenance record was provided for this run.</p>}
                </section>
                <section className="agentcrew-mission-section agentcrew-limitations" aria-labelledby="agentcrew-limitations-title">
                  <div className="agentcrew-section-heading">
                    <span className="agentcrew-section-kicker">Known constraints</span>
                    <h3 id="agentcrew-limitations-title">Limitations</h3>
                  </div>
                  {mission.limitations.length ? <ul>{mission.limitations.map((limitation, index) => <li key={`${limitation}-${index}`}>{limitation}</li>)}</ul> : <p className="agentcrew-empty-detail">No limitations were reported for this run.</p>}
                </section>
                {run.status === "waiting_for_tool_approval" ? <div className="agentcrew-approval-card"><strong>{t("agentCrewApprovalNeeded")}</strong><p>{t("agentCrewApprovalPrompt")}</p><div><button type="button" onClick={() => approve("approve_step")}>{t("agentCrewApproveStep")}</button><button type="button" onClick={() => approve("approve_all_session")}>{t("agentCrewApproveSession")}</button></div></div> : null}
                {run.status === "completed" && !run.reportHtml ? <div className="agentcrew-result-panel"><div className="agentcrew-preview-label"><ShieldCheck size={13} /> Specialist result · current site</div><p>{run.resultSummary || run.summary || "Current-site evidence was retrieved and validated."}</p>{run.result?.records?.length ? <small>{run.result.records.length} evidence record{run.result.records.length === 1 ? "" : "s"} · source lineage retained</small> : null}</div> : null}
                {run.result?.kind === "insufficient_data" ? <div className="agentcrew-warning" role="status"><CircleAlert size={15} /><span>{run.result.message} {run.result.nextAction}</span></div> : null}
                {run.reportHtml ? <div className="agentcrew-report-preview"><div className="agentcrew-preview-label"><FileText size={13} /> {run.reportDraftState === "confirmed" ? `Confirmed revision · v${run.reportDraftVersion}` : "Draft preview · not final"}</div><iframe title="AgentCrew report draft preview" sandbox="" srcDoc={`<!doctype html><html><body>${run.reportHtml}</body></html>`} />{run.reportDraftState !== "confirmed" ? <button type="button" className="agentcrew-confirm-report" onClick={confirmReport} disabled={reportConfirmationBusy}>{reportConfirmationBusy ? "Confirming revision…" : "Confirm report revision"}</button> : null}</div> : null}
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {run?.status === "failed_validation" ? <div className="agentcrew-warning"><CircleAlert size={15} /> Validation failed. The partial preview and errors are preserved.</div> : null}
        {run?.status === "failed" && run.error ? <div className="agentcrew-warning" role="alert"><CircleAlert size={15} /> {run.error}</div> : null}
      </section>

      <footer className="agentcrew-footer">
        <div className="agentcrew-utility-row"><button type="button" onClick={toggleAudit} aria-pressed={showAudit} disabled={utilityBusy}><Clock3 size={14} /> {showAudit ? t("agentCrewHideAudit") : t("agentCrewAudit")}</button><button type="button" onClick={toggleMemory} aria-pressed={showMemory} disabled={utilityBusy}><ShieldCheck size={14} /> {showMemory ? t("agentCrewHideMemory") : t("agentCrewMemoryPersona")}</button></div>
        {utilityError ? <div className="agentcrew-inline-error" role="alert"><CircleAlert size={14} /><span>{utilityError}</span></div> : null}
        {showAudit ? <div className="agentcrew-audit-popover" aria-busy={utilityBusy}><strong>{t("agentCrewViewOnlyAudit")}</strong><p>{utilityBusy ? t("agentCrewLoadingAudit") : t("agentCrewAuditCount", { count: audit?.events?.length || 0 })}</p></div> : null}
        {showMemory ? <div className="agentcrew-audit-popover" aria-label={t("agentCrewSiteMemoryPreferences")} aria-busy={utilityBusy}><strong>{t("agentCrewSiteMemoryPreferences")}</strong><p>{utilityBusy ? t("agentCrewLoadingMemory") : t("agentCrewMemoryCount", { memories: memory?.memories?.length || 0, messages: memory?.messages?.length || 0 })}</p><input value={preferenceDraft} onChange={(event) => setPreferenceDraft(event.target.value)} placeholder={t("agentCrewPreferencePlaceholder")} aria-label={t("agentCrewResponsePreference")} disabled={utilityBusy} /><button type="button" onClick={savePreference} disabled={utilityBusy || !preferenceDraft.trim()}>{t("agentCrewSavePreference")}</button></div> : null}
        <form className="agentcrew-composer" onSubmit={(event) => { event.preventDefault(); submit(); }}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t("agentCrewAskPlaceholder")} aria-label={t("agentCrewAskLabel")} /><button type="submit" aria-label={t("agentCrewSendRequest")} disabled={isRunning || !message.trim()}><Send size={16} /></button></form>
      </footer>
    </aside>
  );
}
