# Verde EMS AgentCrew MVP — Integration Readiness Checklist

**Status:** Local runtime QA, live PostgreSQL EMS dashboard certification, and responsive current-data evidence verified; production-sized concurrency and full AgentCrew evidence archive remain pending. Deployment-specific SSO/RBAC wiring is outside this implementation plan.
**Owner:** Reality Checker  
**Dependencies:** all preceding documents, executable tests, in-app browser evidence  
**Decision source:** [AgentCrew grill session](../../agentcrew-grill-session.html)

## Certification gate

- [x] Documentation gate passed and interface conflicts resolved.
- [x] Frontend build passes; backend tests pass.
- [x] Security review passes for site-route enforcement, strict output schemas, report sanitization, and secret redaction.
- [x] Four runtime hats pass deterministic routing/validation paths; live device path also passes through `gpt-5-mini`.
- [ ] Report chain, sanitized preview, draft save, insufficiency, repair, and complete revision evidence pass. The report chain, sanitized preview, draft save, and revision confirmation are verified in-app; insufficiency and repair/failure journeys still require browser evidence.
- [x] No cross-site read, unsafe HTML, secret exposure, hidden reasoning exposure, or false success state was found in executed checks.
- [x] Visual evidence covers the verified desktop/narrow drawer states.
- [x] Current-data EMS dashboard uses the real REST response field contract, renders only supported observations/derived metrics, and keeps missing weather metrics visibly unavailable.

## Blocking defects

Any cross-site data exposure, approval carryover, unsafe HTML, secret in audit, unbounded retry/repair, missing audit event, or unverified success state is a release blocker. Missing polish, copy, or non-critical responsive refinements are tracked separately but cannot hide safety defects.

## Decision format

Return `READY`, `NEEDS WORK`, or `BLOCKED`, followed by evidence paths, test commands/results, blocking defects, non-blocking gaps, and the exact next owner/action. Default decision is `NEEDS WORK` until evidence proves readiness.
Memory/persona readiness additionally requires a same-site recall test, an explicit preference update, and a visible browser control; all three local checks pass. PostgreSQL live migration, grant inspection, 10× load/restart evidence, and the remaining report/failure evidence journeys remain release-readiness gaps. Report draft persistence, explicit revision confirmation, latest-five retention, typed insufficiency, and bounded repair logic now pass individually; the report draft and revision confirmation are also verified in-app at desktop width, with a 375px drawer overflow check. Retention scheduling, insufficiency/repair browser journeys, and the complete visual archive remain open. Production SSO/RBAC integration is a deployment prerequisite, not an unmet implementation-plan task.

## EMS database evidence

- [x] Schema-qualified EMS models and migrations `0002`–`0006` generate successfully in Alembic offline mode.
- [x] Deterministic seed, calculation, bounded retrieval, MCP allowlist, capability, and replay contract tests pass locally.
- [x] Apply migrations against PostgreSQL and verify downgrade/re-upgrade, grants, partitions, indexes, and bounded serving plans.
- [x] Run the 10× baseline-volume bounded-query suite with cleanup; the local bounded-retrieval target is p95 < 500 ms and passed, and 32-request concurrent p50/p95/p99 retrieval passed. This is local acceptance evidence, not production-sized concurrency certification.
- [x] The concurrent retrieval test accepts `EMS_CONCURRENCY` (default `32`) and percentile thresholds through environment variables, so higher-load runs use the same reproducible contract without code edits. The latest local PostgreSQL runs on 2026-07-24 passed at `128` requests (`p50=116.07ms`, `p95=150.19ms`, `p99=152.13ms`), `256` requests (`p50=150.45ms`, `p95=222.43ms`, `p99=229.16ms`), and `512` requests (`p50=233.75ms`, `p95=386.28ms`, `p99=402.03ms`). A declared `1024`-request stress run exceeded the local p95 target at `883.76ms` with the default pool; increasing the pool to 32 did not improve it (`p95=894.25ms`). These are heavier local acceptance runs, not production-sized certification, and the 1024 result remains an open capacity item.
- [x] Report draft durability is verified through the API/service path and a regression test: sanitized HTML, site ownership, draft state, version `1`, and two source-lineage records are present in `public.report_drafts`.
- [x] Report revision confirmation is verified through the API/service path and a regression test: confirmation is site-scoped, idempotent, increments the durable draft to version `2`, and writes an immutable record to `public.report_draft_revisions`.
- [x] Report revision retention is verified through a live PostgreSQL regression test: the site-scoped repository operation removes revisions older than the latest five versions per draft.
- [x] Typed insufficiency and bounded repair behavior are verified by regression tests: exhausted source retries return corrective `insufficient_data` without a draft, and the fourth invalid provider output becomes `failed_validation` after three repairs.
- [x] Verify the PostgreSQL-backed EMS panel and report revision confirmation in the required in-app browser; the visible state reports `PostgreSQL / live read`, `fresh`, `valid`, and two assets, and the AgentCrew report reaches `CONFIRMED REVISION · V2`. A 375px drawer check reports no horizontal overflow. The broader visual evidence archive remains pending.
- [x] Verify the current-data EMS dashboard at `site/taoyuan-logistics/ems`: PostgreSQL live source, fresh/valid metadata, KPI strip, calculated performance ratio, missing-metric truthfulness, and 375px no-overflow behavior.
