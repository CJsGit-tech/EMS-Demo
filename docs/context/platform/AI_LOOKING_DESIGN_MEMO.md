# Memo: What Makes a Website Look AI-Generated

**To:** EMS-Demo product and frontend team  
**From:** Codex design research  
**Date:** 2026-07-11  
**Subject:** Why polished SaaS interfaces can still look obviously AI-generated

## Executive finding

"AI-looking" is not a reliable claim about authorship. A human can design an AI-looking page, and AI can execute a distinctive design when it receives strong product, brand, and interaction direction.

The term is best understood as a criticism of **convergence without intent**. A page looks AI-generated when it combines statistically safe layouts, fashionable surface treatments, generic component libraries, vague copy, and simulated product evidence in a way that could be reused for almost any SaaS product by changing the logo and accent color.

The public discussion is more consistent on the underlying problem than on any single visual tell:

1. AI tends to reproduce dominant patterns when the brief leaves decisions open.
2. Website homogenization predates generative AI; templates, libraries, responsive conventions, and risk-averse design already pushed sites toward similarity.
3. AI accelerates that convergence because it can reproduce the visual average quickly and at scale.
4. Purple gradients, rounded cards, dark themes, and sans-serif fonts are not inherently bad. They become "AI-looking" when they accumulate without a product-specific reason.
5. The strongest tell is not a color or radius. It is the absence of a specific brief, domain model, brand point of view, and credible product evidence.

For `internal-operations-app`, the criticism is valid. The current UI is usable and technically coherent, but its visual language is still a recognizable dark-SaaS composition rather than an interface that could only belong to an EMS internal document operation.

## What different sources say

| Source type | Main explanation | Useful contribution | Limitation |
|---|---|---|---|
| Human-computer interaction research | Generative systems reproduce dominant conventions, and low-friction generation can narrow design diversity. | The 2026 web vibe-coding paper identifies "productive friction" as a way to force deliberate choices rather than accepting defaults. | The paper is a recent preprint and frames sociotechnical risk more than visual quality scoring. |
| Empirical web-history research | Web layouts were already becoming more similar before modern generative AI. Shared libraries and responsive conventions correlated with visual convergence. | A study of 10,000 sites found layout differences fell by more than 30% between 2010 and 2016. This prevents us from blaming AI for every repeated pattern. | The measured period predates current AI site builders. |
| Design trade press | AI is an accelerator or "averaging engine" operating on an already homogenized visual culture. | Explains the feedback loop: derivative output becomes more public training material, which can further narrow defaults. | Commentary, not controlled experimentation. |
| Practitioner pattern catalogs | Common tells include decorative gradients, dark glow, side-accent cards, nested cards, rounded icon tiles, repeated pills, generic typography, and redundant copy. | Gives a concrete vocabulary for reviewing an interface. | A detector reflects the maintainers' design judgment; individual rules are not universal laws. |
| Web-design communities | The same motifs appear repeatedly, but intent matters more than banning individual components. Rounded cards can be correct when they represent discrete objects or actions. | The community repeatedly distinguishes "using a card" from "making every div a card." It also calls out vague friendly copy and layouts with no visible brief behind them. | Reddit discussions are anecdotal and not representative research. |
| Commercial design studios and AI-builder vendors | Generic prompts and template reuse produce interchangeable SaaS structures. Differentiation requires specific positioning, hierarchy, evidence, and constraints. | Adds a practical test: remove brand identifiers and compare the page with competitors. If the structure and message are interchangeable, the design is not differentiated. | These sources have a commercial incentive to sell redesign or prompting services. |
| Usability guidance | Familiar patterns reduce learning cost and support consistency. | Prevents a false conclusion that every conventional control should be replaced with novelty. | Usability consistency does not provide brand or product differentiation by itself. |

## Evidence synthesis

### 1. The root cause is underspecified intent

The 2026 paper [Interrogating Design Homogenization in Web Vibe Coding](https://arxiv.org/abs/2603.13036) argues that creators delegate structural and aesthetic gaps to models, which then fill those gaps using dominant conventions. It recommends adding productive friction: decisions, critique, references, constraints, and review stages that interrupt the default result.

[Shuffle's explanation](https://shuffle.dev/blog/2026/01/why-do-most-ai-generated-websites-look-the-same/) describes the same mechanism in commercial terms. A prompt such as "modern SaaS website" does not define hierarchy, rhythm, structure, boundaries, or component logic, so the generator supplies the safest layout it knows.

This applies directly to our earlier brief. "High-end tech dark SaaS" is a category label, not a product design thesis. It specifies atmosphere but not what an EMS operator needs to see, trust, compare, or produce.

### 2. AI amplified an older sameness problem

The [10,000-site web similarity study summarized by Fast Company](https://www.fastcompany.com/90501691/science-confirms-it-web-sites-really-do-all-look-the-same) found that layout differences dropped by more than 30% from 2010 to 2016. Code itself became less similar, while library overlap increased. Sites using common layout and UI libraries tended to look more alike.

This matters because "AI-looking" often means "template-looking under current conditions." AI did not invent the hero, feature grid, Bootstrap card, hamburger menu, or modern design system. It recombines patterns that were already overrepresented.

[Creative Bloq's analysis](https://www.creativebloq.com/ai/everything-looks-the-same-now-what) makes the same distinction: visual culture was already narrowing, and AI accelerates the movement toward a visual mean.

### 3. The public recognizes a cluster, not one forbidden style

The [Impeccable slop catalog](https://impeccable.style/slop/) names a recurring cluster:

- purple or cyan-on-dark palettes used as a default technology signal;
- gradients, blurred orbs, glass, glow, and motion without semantic purpose;
- thick side accents on rounded cards;
- cards nested inside cards;
- rounded icon tiles placed above or beside every heading;
- an eyebrow label above a large hero heading;
- repeated pill badges and repeated section kickers;
- a small set of fashionable fonts used for every brand;
- hairline borders combined with broad shadows;
- redundant helper copy that repeats the same status or promise.

The [web-design community discussion](https://www.reddit.com/r/webdesign/comments/1uhuovu/preventing_the_ai_slop_look/) adds needed nuance. Rounded corners are not the problem. The problem is wrapping every section in a rounded container with a border and shadow when no object boundary or interaction requires it. The same thread notes that the hero-plus-three-cards pattern predates AI; it looks generated when it appears because it is the default rather than because it supports the content.

### 4. The most damaging tell is weak specificity

[Payan Design](https://payan.design/blog/why-ai-website-look-same) argues that generic sites may appear credible but unremarkable. Its useful test is strategic rather than stylistic: does the page communicate a specific audience, point of view, hierarchy, and trust evidence?

[Overpass Studio](https://www.overpass.studio/blog/why-saas-websites-look-the-same) similarly describes the repeated SaaS formula: dark minimal surfaces, geometric marks, dashboard mockups, short generic claims, and familiar conversion sections. It also acknowledges the benefit of convention: familiar layouts reduce cognitive load. The proposed answer is not novelty everywhere; it is a standard usability backbone plus product-specific copy, evidence, assets, and interaction.

## Working definition

For this project, use the following definition:

> An AI-looking interface is a polished but interchangeable composition whose aesthetic and component choices are better explained by popular generation defaults than by the product's users, domain, data, workflow, or brand.

This definition avoids unreliable authorship detection and gives us a design-review standard we can act on.

## Characteristic taxonomy

### Composition

- Marketing hierarchy placed on a product screen: eyebrow, large promise headline, supporting sentence, then cards.
- Equal card grids used regardless of content importance.
- Every section visually isolated instead of forming a clear application frame.
- Symmetry and spacing that are consistently pleasant but never respond to workflow urgency.
- A dashboard or catalog composition used because it is a familiar genre, not because the domain needs it.

### Surface treatment

- Dark canvas plus glowing accent used as an automatic signal for "technology."
- Decorative grids, radial gradients, noise, blur, and glass that explain no state or depth.
- Hairline borders on nearly every container.
- Large radius applied to cards, inputs, banners, icons, badges, and buttons alike.
- Accent rails, gradient strokes, or bright selected cards added to make a generic component feel special.

### Typography and iconography

- One fashionable sans-serif family with little brand character.
- Tiny eyebrow labels, uppercase metadata, and compressed large headlines repeated across unrelated products.
- Lucide-style outline icons used as content rather than navigation aids.
- Each feature receives a rounded-square icon tile, regardless of whether the icon improves recognition.
- Sparkle, robot, shield, wand, and status-dot motifs used to signify AI or trust without evidence.

### Copy and claims

- Generic transformation language that could fit any SaaS product.
- Repetition across heading, description, helper copy, badge, and status callout.
- Helpful-sounding language that explains the UI more than the work.
- Unverified performance metrics and fabricated activity used as visual filler.
- Labels such as "AI-powered," "smart," or "ready" without explaining the actual system behavior.

### Product evidence

- Beautiful mock UI without realistic data density, failure states, history, provenance, or ownership.
- Fake status indicators and activity feeds that do not correspond to real state.
- Generic charts, metrics, or document previews rather than domain-specific artifacts.
- High visual fidelity around a shallow interaction model.
- No visible trace of who uses the product, what rules constrain the work, or what happens after the primary action.

### Interaction

- Hover lift and glow on every card.
- Motion added to make a static layout feel premium rather than to clarify causality.
- Cards that look navigational but merely change content far below the fold.
- Pills and badges used as decoration rather than compact state labels.
- Search, filters, or system status included because dashboards usually contain them, not because four items require them.

## What is not automatically AI-looking

Do not ban useful conventions merely to appear human-designed.

- A card is appropriate for a movable object, independent record, selectable option, or content unit with its own actions.
- Rounded corners can establish a coherent physical language.
- Dark mode can be appropriate for low-light or monitoring environments.
- A familiar icon can reduce label-reading effort.
- A standard grid improves alignment and responsive behavior.
- Familiar controls lower learning cost. Nielsen Norman Group's [Consistency and Standards guidance](https://media.nngroup.com/media/articles/attachments/Heuristic_4_A4_compressed.pdf) explicitly recommends following established platform and industry conventions.

The question is not "Has another site used this component?" The question is "Why is this component correct for this content, state, and user task?"

## Audit of `internal-operations-app`

### Current strengths

- The app has a real single-screen task flow rather than a purely promotional landing page.
- Template selection, required-field validation, focus handling, structured preview, copy, and export are functional.
- The prototype boundary is honest; the UI does not currently claim real persistence or model execution.
- Responsive and accessibility fundamentals are stronger than the average generated mockup.
- The green-neutral palette avoids the most common purple gradient default.

These strengths make the app usable. They do not yet make it distinctive.

### AI-looking signals in the current implementation

| Signal | Current evidence | Assessment |
|---|---|---|
| Category-first visual brief | The design was directed as "high-end tech dark SaaS," which describes a trend category rather than EMS document operations. | Root cause. |
| Decorative technology background | `styles.css` uses a dark canvas, radial green light, and a repeated green grid. | Strong generated-tech tell; no workflow meaning. |
| Eyebrow plus sparkle | `App.jsx` introduces "Document operations cockpit" with a sparkle icon above the main proposition. | Matches the default AI SaaS hero grammar. |
| Card grid reflex | Four generators are rendered as four equal rounded cards. | Understandable selection model, but visually interchangeable and overbuilt for four choices. |
| Rounded icon tiles | Each generator and workspace receives an outline icon inside a rounded square. | Common generated feature-card treatment; weak domain value. |
| Side-tab selection accent | The selected card adds a bright left rail while retaining a rounded border. | Explicitly recognized as a current AI-generated UI tell. |
| Pill accumulation | Output sections, workspace state, and draft state use multiple pills and badges. | State is understandable, but the repeated shape creates template sameness. |
| Repeated prototype disclosure | The top bar, hero note, workspace badge, callout, and draft chips restate the local-simulation boundary. | Honest but redundant; reads like generated defensive copy. |
| Generic status motif | A glowing green dot accompanies the simulator status. | Looks operational without representing a meaningful live system condition. |
| Unsupported outcome claims | `mockData.js` claims 5-18 minutes saved by each generator without measurement. | Product-evidence problem; remove or explicitly mark as hypothetical. |
| Generic icon vocabulary | Sparkle, shield, clipboard, wand, server, arrows, and checkmarks carry much of the visual identity. | Could belong to almost any AI operations product. |
| Excessive containerization | Catalog, cards, prototype note, workspace, output pills, preview, section cards, source record, and status chips all receive boundaries. | Clear but over-cardified; hierarchy is created mainly with boxes. |

### Verdict

The app does not look AI-generated because of one bad choice. It looks AI-generated because many individually acceptable choices converge:

`dark tech atmosphere + subtle grid + green glow + sparkle eyebrow + rounded icon cards + side accent + pill states + generic claims + repeated explanatory copy`

Changing green to another color or reducing one radius would not solve the problem. The visual system needs to be derived from the document workflow and EMS operating context rather than from the phrase "premium dark SaaS."

## Recommended design direction

### Product thesis

Design a **document operations workbench**, not an AI SaaS showcase.

The interface should express:

- source traceability;
- document structure;
- ownership and review responsibility;
- controlled generation;
- operational precision;
- export and handoff.

### Structural direction

1. Remove the hero composition. Start with the active document job and current context.
2. Replace the four feature cards with a compact document-type rail or segmented list.
3. Make the generated document the primary visual artifact, using a paper, ledger, or controlled-record metaphor.
4. Place source fields and provenance beside the document rather than below a catalog.
5. Use one application frame and dividers instead of nested rounded panels.
6. Show state as plain text with timestamps and ownership, not glowing dots or decorative pills.
7. Reserve cards only for independent records, templates, or generated document versions that actually need object boundaries.

### Visual direction

- Remove the decorative background grid, glow, sparkle, and rounded icon tiles.
- Use flat graphite or warm neutral surfaces with a single restrained EMS green for actionable or verified states.
- Use square or lightly rounded controls and stronger divider rhythm.
- Prefer typography and document hierarchy over icons as the main organizing system.
- Use real document cues: section numbers, revision marks, source references, status stamps, owner fields, dates, and export formats.
- Derive type choices from an actual corporate or document standard. Do not select a font because it signals "modern SaaS."

### Content direction

- Remove unsupported time-saved claims until measured.
- Replace generic descriptions with the input requirements, output sections, and decision supported by each document type.
- State the prototype boundary once, near the generation control or document status.
- Replace simulated status language with precise local behavior: generated in browser, not stored, manual review required.
- Use realistic Taiwanese EMS/internal-operations examples rather than generic startup or infrastructure placeholders.

## Acceptance tests for the next design

The next design should pass these tests before implementation is considered complete:

1. **Brand removal test:** Hide the logo and accent color. A reviewer should still identify the screen as an internal document operations tool, not a generic AI dashboard.
2. **Domain evidence test:** The first viewport should contain at least three elements that come from the real document workflow, such as source records, revision status, document sections, owner, or deadline.
3. **Container necessity test:** Every bordered or elevated container must represent an independent object, grouping, or interaction. Remove containers that only decorate text.
4. **No category shorthand test:** No sparkle, robot, glowing status dot, decorative grid, gradient text, or generic AI badge may be used to communicate product intelligence.
5. **Claim integrity test:** Every metric, activity item, system state, and performance claim must be real, measured, or explicitly labeled sample data.
6. **Specificity test:** Headings and helper copy should not be reusable unchanged on an unrelated project-management, finance, or AI-writing product.
7. **Workflow test:** Template selection, source entry, generation, review, and export should read as one continuous job rather than separate showcase sections.
8. **Convention balance test:** Standard controls remain familiar, while layout, content hierarchy, and artifacts are specific to the product.

## Source notes and limitations

- [Interrogating Design Homogenization in Web Vibe Coding](https://arxiv.org/abs/2603.13036) is the most directly relevant AI-specific research source, but it is a 2026 preprint.
- [Science confirms it: Websites really do all look the same](https://www.fastcompany.com/90501691/science-confirms-it-web-sites-really-do-all-look-the-same) summarizes empirical work using historical website data; it supports the pre-AI homogenization claim but not a current AI visual classifier.
- [Everything looks the same. Now what?](https://www.creativebloq.com/ai/everything-looks-the-same-now-what) is design-industry analysis and should be treated as informed commentary.
- [Impeccable Slop](https://impeccable.style/slop/) is a practitioner-authored pattern taxonomy and detector, not peer-reviewed research.
- [Preventing the AI slop look](https://www.reddit.com/r/webdesign/comments/1uhuovu/preventing_the_ai_slop_look/) captures current practitioner language and disagreement; it is anecdotal evidence.
- [Why Do Most AI-Generated Websites Look the Same?](https://shuffle.dev/blog/2026/01/why-do-most-ai-generated-websites-look-the-same/), [Payan Design](https://payan.design/blog/why-ai-website-look-same), and [Overpass Studio](https://www.overpass.studio/blog/why-saas-websites-look-the-same) are commercially interested sources. Their claims are useful where they converge with research and community evidence.
- No visual checklist can prove authorship. This memo uses "AI-looking" only as a design-quality and differentiation diagnosis.
