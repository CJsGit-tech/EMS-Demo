# AGENTS.md

## Design Decision Documentation

When a discussion, recommendation, architecture choice, scope decision, or product boundary is explicitly treated as finalized, document it as a timestamped design record.

Rules:
- Store finalized decision documents under `design/`.
- Use filename format: `YYYYMMDD-HHMMSS-topic.md`.
- Keep the topic short, concrete, and hyphenated.
- Each finalized document should state:
  - the timestamp
  - the topic
  - the decision
  - the rationale
  - scope included
  - scope deferred or excluded
  - risks or review triggers
- Prefer creating a new timestamped document rather than silently overwriting a prior finalized decision.
- If a prior decision is superseded, create a new document and reference the older one.

## Current Repository Convention

- Root policy/instructions live in `AGENTS.md`.
- Finalized design and product-scope records live in `design/`.

## UI Verification Preference

For UI app checks in this repository:

- Do not use standalone Playwright.
- Use [$browser:control-in-app-browser](/Users/chuang/.codex/plugins/cache/openai-bundled/browser/26.623.101652/skills/control-in-app-browser/SKILL.md) for browser interaction and screenshots.
- Start the local UI with `npm run dev` before checking the app in the browser.
- When validating UI changes, open the app in the in-app browser and take screenshots there.

## LLM Next-Step Contract

Agents in this repository must not end an iteration without telling the user what to do next.

Required output behavior:
- Every meaningful progress update should include `Suggested next step:` followed by an exact command or action.
- Every final task-completion response must end with `Suggested next step:` followed by at least one exact `$impeccable ...` command.
- This rule applies even if the completed task did not use `$impeccable`.
- Do not end with a generic sentence like `let me know what you want next`. Name the next command.
- Prefer one best command. Include up to two fallback commands only when there is real uncertainty.

Required recommendation quality:
- Make the recommendation specific to the current repo state, edited files, route, surface, and user goal.
- Prefer the exact target when known, for example `$impeccable critique apps/site-integration-app` instead of `$impeccable critique`.
- If the next step depends on an assumption, state the assumption briefly, then give the command.
- Do not dump the full command catalog unless the user explicitly asks for it.

Project-state routing:
- Existing project or existing surface: prefer commands that inspect, review, refine, or harden what already exists.
- From scratch: prefer commands that establish context, define the target, shape the UX, and create the first solid structure.
- Ambiguous state: say which case you are assuming, then recommend the command for that case.

## `$impeccable` Command Guide

Use this quick routing map when deciding what to suggest next:

- `init`: project setup, missing product/design context, or greenfield start.
- `document`: existing UI code exists but the design system or design document is not captured.
- `shape <target>`: plan a feature or surface before implementation.
- `craft <target>`: build a feature end to end after the target is clear.
- `critique <target>`: review an existing surface and identify design/UX weaknesses.
- `audit <target>`: check accessibility, responsiveness, performance, or implementation quality.
- `polish <target>`: improve a surface after critique/audit findings or before shipping.
- `layout <target>`: fix spacing, hierarchy, rhythm, and alignment.
- `typeset <target>`: improve typography, sizing, wrapping, and text hierarchy.
- `colorize <target>`: strengthen a weak or flat palette.
- `clarify <target>`: improve labels, copy, empty states, and error states.
- `adapt <target>`: improve mobile/tablet behavior and responsive layout.
- `harden <target>`: handle edge cases, i18n, and production-readiness issues.
- `animate <target>`: add or refine purposeful motion.
- `delight <target>`: add personality once the fundamentals are already strong.
- `bolder <target>`: push a bland design further.
- `quieter <target>`: tone down a noisy or visually overloaded design.
- `distill <target>`: remove clutter and simplify.
- `live`: iterate visually when the dev server is running and the user needs browser-driven refinement.

Default suggestion rules:
- If there is an existing UI and no clear diagnosis yet, suggest `$impeccable critique <target>`.
- If diagnosis exists and issues are mostly implementation quality, suggest `$impeccable audit <target>` or `$impeccable harden <target>`.
- If diagnosis exists and the surface is close to done, suggest `$impeccable polish <target>`.
- If the user is asking what to build or how to structure a new surface, suggest `$impeccable shape <target>`.
- If the design direction is already clear and the next move is implementation, suggest `$impeccable craft <target>`.

## Git Remote Preference

For this repository, if GitHub push/authentication is blocked because `origin` uses HTTPS, the agent should ask for approval to run:

`git remote set-url origin git@github.com:CJsGit-tech/EMS-Demo.git`

This is the preferred remote format for future Codex push workflows in this repo.
