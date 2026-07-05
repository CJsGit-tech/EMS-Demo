# AGENTS.md

## Repo Reminders

- The frontend app in this repo is React-based.
- Canonical project context lives under `docs/context/`; root `PRODUCT.md`, `DESIGN.md`, and `REQUEST.md` are compatibility pointers.
- For UI verification, do not use standalone Playwright.
- Start the app with `npm run dev`, then use [$browser:control-in-app-browser](/Users/chuang/.codex/plugins/cache/openai-bundled/browser/26.623.101652/skills/control-in-app-browser/SKILL.md) to inspect the UI and capture screenshots.

## `$impeccable` Commands

Use `$impeccable` by default for product UI, app shells, dashboards, settings, workflows, and existing React surfaces in this repo.

- `$impeccable critique <target>`: use first when an existing UI needs diagnosis.
- `$impeccable layout <target>`: use for spacing, hierarchy, alignment, and structure fixes.
- `$impeccable polish <target>`: use when the surface is close and needs refinement before shipping.
- `$impeccable shape <target>`: use before building a new screen or feature.
- `$impeccable craft <target>`: use when the direction is clear and the next step is implementation.
- `$impeccable audit <target>`: use for accessibility, responsive, or implementation-quality checks.
- `$impeccable harden <target>`: use for edge cases, production readiness, and cleanup.
- `$impeccable adapt <target>`: use for mobile and tablet behavior.
- `$impeccable typeset <target>`: use for typography hierarchy and text layout.
- `$impeccable colorize <target>`: use when the palette feels flat.
- `$impeccable clarify <target>`: use for labels, UX copy, errors, and empty states.
- `$impeccable bolder <target>`: use when the design is too safe.
- `$impeccable quieter <target>`: use when the design is too noisy.
- `$impeccable delight <target>`: use when fundamentals are done and the UI needs personality.
- `$impeccable animate <target>`: use for purposeful motion.
- `$impeccable live`: use when the dev server is running and visual browser iteration is needed.

## `taste-skill` Commands And Techniques

Use `taste-skill` for landing pages, portfolios, editorial surfaces, and redesigns of non-dashboard frontends.

Do not use `taste-skill` as the default for dashboards, data tables, admin tooling, or multi-step product UI. For those, use `$impeccable`.

When using `taste-skill`, agents should apply these techniques:
- Start with a one-line design read: page kind, audience, vibe, and design direction.
- Infer the three dials when useful: `DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY`.
- On redesigns, audit first before changing code.
- Avoid default AI patterns: centered-hero reflex, three-equal-card grids, generic glass, purple glow, repetitive eyebrows, and repetitive split layouts.
- Keep one palette, one radius system, one icon family, and one coherent layout rhythm.
- If a real design system is appropriate, use the real package rather than imitating it.

Practical routing:
- New landing page or marketing surface: use `taste-skill` thinking first, then usually suggest `$impeccable shape <target>` or `$impeccable craft <target>`.
- Bland existing marketing page: use `taste-skill` redesign techniques, then usually suggest `$impeccable critique <target>`, `$impeccable layout <target>`, or `$impeccable polish <target>`.
- Existing product UI: do not lead with `taste-skill`; use `$impeccable` first.

Online Taste Skill examples to reference when suggesting next steps:
- `design-taste-frontend`: the default general-purpose Taste Skill. Use for most landing-page and portfolio design direction work.
- `gpt-taste`: stricter GPT/Codex-oriented variant with stronger layout variance and motion direction.
- `redesign-existing-projects`: use when improving an existing marketing site instead of starting from scratch.
- `image-to-code`: use for image -> analyze -> implement workflows.
- `high-end-visual-design`: use for calm, premium, whitespace-heavy visual direction.
- `minimalist-ui`: use for restrained, editorial, Notion/Linear-like direction.
- `industrial-brutalist-ui`: use for sharp, Swiss, mechanical, high-contrast direction.
- `imagegen-frontend-web`: use when the first deliverable should be website comps or reference images, then pass those into implementation.
- `imagegen-frontend-mobile`: use when the first deliverable should be mobile screen comps.
- `brandkit`: use when the first deliverable should be palette/type/logo direction boards.

Example suggestions:
- For a new marketing homepage: suggest `design-taste-frontend`, then `Suggested next step: $impeccable shape <target>`.
- For a stale existing landing page: suggest `redesign-existing-projects`, then `Suggested next step: $impeccable critique <target>`.
- For a more experimental brand direction: suggest `gpt-taste` or `industrial-brutalist-ui`, then `Suggested next step: $impeccable craft <target>`.
- For image-first exploration: suggest `imagegen-frontend-web` or `brandkit`, then `Suggested next step: $impeccable shape <target>`.

## Next-Step Rule

Agents must always end any iteration, conversation, or task with `Suggested next step:` and at least one exact command.

Rules:
- Suggest the single best next step first.
- Prefer an exact target, file, route, or app surface when known.
- Suggest commands from `$impeccable` and/or `taste-skill` routing above.
- Do not end with generic text like `let me know what you want next`.
- If the task is ambiguous, state the assumption briefly, then give the command.

Examples:
- `Suggested next step: $impeccable critique apps/site-integration-app`
- `Suggested next step: $impeccable layout apps/site-integration-app/src/App.jsx`
- `Suggested next step: $impeccable shape apps/site-integration-app`
