# Design Direction

## Direction

**Operational document desk:** editorial structure, restrained dark ink, warm paper surfaces, thin rules, and one controlled green accent. The interface should feel like a dependable internal register rather than a generic AI chat product.

## Design read

- Product type: internal operations workspace with document-generation tools.
- Audience: desktop-based operations and administrative users.
- Vibe: calm, precise, accountable, lightly editorial.
- Design variance: medium; use strong hierarchy and document conventions instead of novelty.
- Motion intensity: low; motion only communicates generation progress and state change.
- Visual density: medium; enough structure for operational scanning, enough whitespace for draft review.

## Visual rules

### Color

- Ink and paper are the primary relationship; dark mode inverts the relationship without becoming neon.
- Green is reserved for active navigation, primary actions, focus, and positive system state.
- Avoid purple gradients, blue-violet glow, translucent glass, and decorative mesh backgrounds.
- Status colors must communicate state with text as well as color.

### Typography

- Use the existing serif display treatment for page titles and document headings.
- Use a compact sans-serif for controls, metadata, labels, and navigation.
- Use uppercase micro-labels only for true metadata; do not turn every section into an eyebrow.
- Keep generated document copy readable at normal zoom and avoid overly tight line lengths.

### Layout

- Preserve a stable left navigation rail and compact topbar.
- Use rules and register rows to establish hierarchy instead of card stacks.
- Keep input and output adjacent on generator routes at desktop widths.
- On mobile, stack source context before preview and retain the primary action near the preview heading.

### Components

- One radius system: compact, restrained corners.
- One icon family: Lucide.
- Buttons should state the action and its consequence: `Create local draft`, `Copy record`, `Export .txt`.
- Empty states should explain the boundary and provide a next action.

## Anti-AI-looking guardrails

- Do not use a centered marketing hero as the app home.
- Do not use three equal feature cards as the only information architecture.
- Do not place a large chat box in front of structured source capture.
- Do not use repeated pill badges as decoration.
- Do not use generic sparkle, wand, robot, or magic language for routine document work.
- Do not claim live AI, persistence, or automation when the current app is local simulation.

## Motion

- Keep the existing short generation progress state.
- Prefer opacity and width changes on progress rules over bouncing loaders.
- Announce state changes in text for reduced-motion users.
- Do not animate every card or route transition.

## Design quality bar

The design is ready for implementation when a reviewer can identify the job, source facts, draft state, review obligation, and safe next action without relying on color, icons, or prior training.
