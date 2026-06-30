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

## Git Remote Preference

For this repository, if GitHub push/authentication is blocked because `origin` uses HTTPS, the agent should ask for approval to run:

`git remote set-url origin git@github.com:CJsGit-tech/EMS-Demo.git`

This is the preferred remote format for future Codex push workflows in this repo.
