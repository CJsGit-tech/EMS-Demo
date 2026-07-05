---
name: EMS Site Integration
description: Calm, map-first EMS site monitoring for operations managers.
colors:
  bg: "oklch(1 0 0)"
  shell: "oklch(0.975 0.006 145)"
  surface: "oklch(0.982 0.004 145)"
  surface-strong: "oklch(0.945 0.012 145)"
  line: "oklch(0.885 0.015 145)"
  line-strong: "oklch(0.78 0.028 145)"
  ink: "oklch(0.24 0.028 155)"
  muted: "oklch(0.46 0.018 155)"
  quiet: "oklch(0.58 0.015 155)"
  primary: "oklch(0.42 0.105 140)"
  primary-soft: "oklch(0.91 0.03 142)"
  healthy: "oklch(0.48 0.115 145)"
  watch: "oklch(0.69 0.12 78)"
  critical: "oklch(0.55 0.19 31)"
  offline: "oklch(0.55 0.015 145)"
  focus: "oklch(0.68 0.11 142)"
typography:
  display:
    fontFamily: "Inter, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "46px"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "0"
  headline:
    fontFamily: "Inter, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "0"
  title:
    fontFamily: "Inter, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "0"
  body:
    fontFamily: "Inter, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Inter, SF Pro Text, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  sm: "6px"
  md: "8px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  button-utility:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  input-search:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  status-normal:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.healthy}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "24px"
---

# Design System: EMS Site Integration

## 1. Overview

**Creative North Star: "Operational Cartography"**

EMS Site Integration is a calm product interface for operations managers who need to move from portfolio awareness to site-specific action. The interface starts with geography, then progressively narrows into site context, system status, exceptions, and EMS workflow modules.

The system is restrained, familiar, and task-first. It should feel like a reliable operations surface used during a desk review or shift handoff, not like a spectacle. The design explicitly rejects the PRODUCT.md anti-references: it must not look like an AI-generated SCADA control room packed with numbers, charts, and visual noise, and it must avoid generic blue SaaS-dashboard tropes, decorative futurism, and dense monitoring layouts that make every screen feel equally urgent.

**Key Characteristics:**
- Map-first portfolio entry, then site-level drill-in.
- Sparse visualizations with operational meaning.
- Restrained green accent used for navigation, primary action, current selection, and healthy state.
- Status language is always textual plus color, never color-only.
- Multi-screen app shell is consistent across Overview, Sites, Issues, Systems, Reports, and Site Detail.

## 2. Colors

The palette is a restrained operational green system: near-white working surfaces, green-tinted neutral layers, one primary action color, and clear semantic status colors.

### Primary
- **Operational Green** (`oklch(0.42 0.105 140)`): Used for the brand mark, primary actions, active navigation, selected rails, links, and meaningful interaction affordances. It should stay rare enough to signal action.
- **Soft Operational Green** (`oklch(0.91 0.03 142)`): Used for selected states, healthy chips, and subtle connected-module backgrounds.

### Secondary
- **Warning Amber** (`oklch(0.69 0.12 78)`): Used for warning site states and HVAC drift conditions.
- **Critical Red** (`oklch(0.55 0.19 31)`): Used for critical site states and urgent issue indicators.
- **Healthy Green** (`oklch(0.48 0.115 145)`): Used for normal status markers and normal chips.

### Neutral
- **Pure Work Surface** (`oklch(1 0 0)`): Main page and card background.
- **Shell Green Tint** (`oklch(0.975 0.006 145)`): App workspace wash and top-level background layering.
- **Soft Panel Surface** (`oklch(0.982 0.004 145)`): Subtle secondary surfaces such as side rail controls and profile pill.
- **Selected Surface** (`oklch(0.945 0.012 145)`): Hover, active, selected, and mobile navigation backgrounds.
- **Structural Line** (`oklch(0.885 0.015 145)`): Borders, dividers, table rules, and panel separation.
- **Primary Ink** (`oklch(0.24 0.028 155)`): Headings, important labels, numeric values, and site names.
- **Muted Text** (`oklch(0.46 0.018 155)`): Supporting body copy, metadata, row descriptions.
- **Quiet Text** (`oklch(0.58 0.015 155)`): Low-emphasis labels, section captions, secondary counts.

### Named Rules

**The One Accent Rule.** Operational Green is the only brand accent. Do not introduce blue SaaS accent colors, purple gradients, neon futures, or decorative color ramps.

**The Status Must Speak Rule.** Status colors must appear with text labels such as Normal, Warning, Critical, or Offline. Never rely on marker color alone.

## 3. Typography

**Display Font:** Inter with SF Pro Text, Segoe UI, sans-serif fallbacks  
**Body Font:** Inter with SF Pro Text, Segoe UI, sans-serif fallbacks  
**Label/Mono Font:** No distinct mono font is used.

**Character:** The typography is product-native, dense enough for operations work, and intentionally unshowy. It uses a single sans family so the interface disappears into the task.

### Hierarchy
- **Display** (800, 46px desktop / 34px mobile, 0.98 line-height): Screen titles such as Operational overview and site names.
- **Headline** (800, 22px, 1.15 line-height): Drawer titles and site workspace headings.
- **Title** (800, 16-20px, 1.25 line-height): Panel headers, section intros, and report card titles.
- **Body** (400, 14-16px, 1.45-1.5 line-height): Product descriptions, notes, report prose, empty state explanations.
- **Label** (700, 11-13px, 1.2 line-height): Navigation, buttons, status chips, table headings, rail labels.

### Named Rules

**The Product Native Rule.** Do not add expressive display fonts, editorial serifs, or decorative type. This is an operational SaaS tool; typography should feel native, legible, and consistent.

**The No Shouting Rule.** Display headings are large but not fluid beyond product scale. Avoid clamp-heavy marketing typography.

## 4. Elevation

The system uses a hybrid of thin borders, tonal layering, and one restrained shadow token. Surfaces are mostly flat at rest; depth exists to separate panels and map overlays without creating a stack of decorative cards.

### Shadow Vocabulary
- **Panel Shadow** (`0 2px 8px color-mix(in oklab, var(--ink) 8%, transparent)`): Used on major panels, map stage, lists, and screen containers.
- **Overlay Shadow** (`0 8px 24px color-mix(in oklab, var(--ink) 12%, transparent)`): Used only for the map site drawer.
- **Marker Focus Shadow** (`drop-shadow(0 2px 4px color-mix(in oklab, var(--ink) 22%, transparent))`): Used only when a map marker is active.

### Named Rules

**The Flat Until Useful Rule.** Borders and tonal layers are preferred. Shadows are allowed only when a panel or overlay must separate from map or workspace context.

## 5. Components

### Buttons
- **Shape:** Rectangular product controls with 8px radius; full pill only for compact identity/profile elements.
- **Primary:** Operational Green background, white text, 36px minimum height, 12px horizontal padding.
- **Utility:** White background, Structural Line border, Primary Ink text, same 36px height and 8px radius.
- **Hover / Focus:** Utility controls shift border/text toward Primary Ink; focus uses a 2px visible ring from the focus token. Never remove focus without replacement.
- **Demo / Disabled Behavior:** If an action is not connected, it must announce why through the live status region rather than silently doing nothing.

### Chips
- **Style:** 24px high status labels with 6px radius and 8px horizontal padding.
- **State:** Normal, Warning, and Critical use semantic foreground/background pairs. Chips must include text.

### Cards / Containers
- **Corner Style:** 8px radius for panels and containers.
- **Background:** Pure Work Surface for primary panels; Soft Panel Surface for side-summary zones.
- **Shadow Strategy:** Use Panel Shadow for screen-level panels; avoid nested card stacks.
- **Border:** Structural Line 1px borders define most surfaces.
- **Internal Padding:** 16-20px for panels, 12-14px for list rows and compact state containers.

### Inputs / Fields
- **Style:** Search fields are 36px high with 8px radius, 1px Structural Line border, transparent background, and visible label through screen-reader text.
- **Focus:** Use the global 2px focus ring.
- **Clear State:** Search fields show a clear button when populated.
- **Empty State:** No-result states must provide an explanation and a clear-filters action.

### Navigation
- **Top Navigation:** Button-based navigation with active underline in Operational Green.
- **Side Rail:** Portfolio regions and site groups use compact row buttons, selected surface fills, and count alignment.
- **Mobile Navigation:** Hidden behind the compact menu button; opens as a bordered panel in the side rail area with full-width row buttons.
- **Hash Routing:** Screens are addressable through `#overview`, `#sites`, `#issues`, `#systems`, `#reports`, and `#site/<site-id>`.

### Map
- **Role:** The map is the primary discovery surface, not decoration.
- **Base:** Real world atlas from `react-simple-maps` and `world-atlas`.
- **Markers:** Semantic status markers with white halo, colored core, and active focus ring.
- **Drawer:** Hidden by default. Opens only after an explicit map marker click or keyboard activation.
- **Empty State:** If filters produce no map markers, show a centered clear-filters recovery panel.

### Site Workspace
- **Structure:** Site detail uses a two-column workspace: summary card on the left, tabbed content on the right.
- **Tabs:** Overview, Systems, Activity, and Documents. Tabs are product-native buttons with active underline.
- **Responsive:** Collapses to one column below tablet width.

## 6. Do's and Don'ts

### Do:
- **Do** start from site context, then narrow into action.
- **Do** keep visualizations sparse, useful, and decision-oriented.
- **Do** use Operational Green for primary actions, active navigation, selected states, and meaningful health/status context.
- **Do** include text labels for every status color.
- **Do** preserve the 8px panel/control radius and 1px border vocabulary.
- **Do** use the real world map as the core discovery surface.
- **Do** make mobile behavior structural: collapse navigation, stack toolbar actions, and keep tap targets usable.
- **Do** use empty states that teach recovery, especially for filtered map/list/table states.

### Don't:
- **Don't** make this look like an AI-generated SCADA control room packed with numbers, charts, and visual noise.
- **Don't** use generic blue SaaS-dashboard tropes.
- **Don't** add decorative futurism, neon effects, purple gradients, or glassmorphism.
- **Don't** create dense monitoring layouts that make every screen feel equally urgent.
- **Don't** add data visualizations unless they directly support an operational decision.
- **Don't** show the map site drawer by default; it appears only after explicit site selection from the map.
- **Don't** use color-only status communication.
- **Don't** introduce side-stripe borders, gradient text, decorative grid backgrounds, or oversized 32px+ card radii.
