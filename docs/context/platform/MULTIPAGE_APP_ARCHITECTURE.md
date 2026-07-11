# Internal Operations Multi-Page Architecture

## Design decision

The internal-operations-app is organized as a routed application rather than a single long workbench. The shell owns global navigation and browser-state context; each destination owns one user job and has a clear URL.

This follows the guidance that application navigation should provide stable access to content destinations, adapt its form at different viewport sizes, and keep responsive changes inside the destination rather than creating separate routes. It also follows the Figma design-system guidance to treat navigation as a reusable pattern with explicit states, shared components, and documented layout regions.

Sources consulted:

- [Android Developers: Build responsive navigation](https://developer.android.com/develop/ui/views/layout/build-responsive-navigation): persistent leading-edge navigation for larger layouts, compact navigation for smaller layouts, and no route changes solely because of window size.
- [Figma Learn: Explore the navigation bar and left sidebar](https://help.figma.com/hc/en-us/articles/360039831974-Explore-the-navigation-bar-and-left-sidebar): distinct navigation and content panels organized around essential workflows.
- [Figma Learn: Build your design system](https://help.figma.com/hc/en-us/articles/14548865734679-Lesson-3-Build-your-design-system): reusable components, patterns, variants, consistent naming, and documented navigation states.
- [Nielsen Norman Group: Be succinct](https://www.nngroup.com/articles/be-succinct-writing-for-the-web/): split content into coherent topic-focused pages instead of forcing one long linear surface.

## Route map

| Route | User job | View responsibility |
| --- | --- | --- |
| `/overview` | Orient and choose a next action | Workspace summary and task entry points |
| `/documents/new` | Choose a document type | Generator index and search |
| `/documents/tender` | Build a tender package | Tender source form and output preview |
| `/documents/financial-report` | Build a financial report | Finance source form and output preview |
| `/documents/pptx` | Build presentation content | Deck source form and output preview |
| `/documents/ops-memo` | Build an operations memo | Memo source form and output preview |
| `/documents` | Understand saved records | Persistence boundary and available record types |
| `/runs` | Understand execution history | Run-log boundary and planned activity pattern |
| `/context` | Understand system limits | Browser-only execution, storage, and review contract |

## MVC boundaries

- **Models:** `src/models/documentModels.js` owns feature-to-route mapping, draft construction, serialization, export naming, and navigation groups.
- **Controllers:** `src/controllers/useDocumentGenerator.js` owns input state, validation, generation timing, copy behavior, and action feedback.
- **Views:** `src/views/` owns the shell, reusable page header/navigation/workbench components, and route-specific pages.

## Responsive behavior

- Desktop uses a persistent left navigation rail with grouped task destinations.
- Compact layouts move the same destinations into a horizontally scrollable navigation strip.
- Routes do not change with viewport width; only the shell and destination layout adapt.
- Generator routes remain task-focused and do not inherit dashboard content from the overview page.
