import {
  BadgeCheck,
  BriefcaseBusiness,
  FileSpreadsheet,
  FileText,
  LayoutTemplate,
  Presentation,
} from "lucide-react";

export const featureCatalog = [
  {
    id: "tender-generation",
    name: "Tender Generation",
    category: "Bid package",
    icon: BriefcaseBusiness,
    summary: "Draft commercial tender packs from scope fragments, supplier constraints, and delivery milestones.",
    turnaround: "12-18 min saved per draft",
    outputs: ["Cover letter", "Scope summary", "Commercial exclusions", "Submission checklist"],
    fields: [
      { id: "projectName", label: "Project name", type: "text", placeholder: "Northern Grid Retrofit Package" },
      { id: "client", label: "Client", type: "text", placeholder: "Hsin Power Holdings" },
      { id: "submissionDate", label: "Submission deadline", type: "date" },
      { id: "scopeNotes", label: "Scope notes", type: "textarea", placeholder: "Retrofit server room power distribution and document compliance assumptions." },
    ],
    previewTitle: "Tender draft preview",
    previewTemplate:
      "Prepared a tender package for {projectName} under {client}. The draft highlights scope assumptions, commercial exclusions, and a compliance checklist ahead of the {submissionDate} submission.",
  },
  {
    id: "financial-report-generation",
    name: "Financial Report Generation",
    category: "Management reporting",
    icon: FileSpreadsheet,
    summary: "Turn raw figures and operational context into a finance-ready management readout with exception notes.",
    turnaround: "8-12 min saved per report",
    outputs: ["Executive summary", "Variance notes", "Cash posture", "Follow-up actions"],
    fields: [
      { id: "reportingPeriod", label: "Reporting period", type: "text", placeholder: "2026 Q3" },
      { id: "businessUnit", label: "Business unit", type: "text", placeholder: "Operations Platform" },
      { id: "keyVariance", label: "Primary variance", type: "text", placeholder: "Vendor onboarding cost above plan" },
      { id: "supportingNotes", label: "Supporting notes", type: "textarea", placeholder: "Highlight one-off impacts, delayed invoices, and recovery plan." },
    ],
    previewTitle: "Financial summary preview",
    previewTemplate:
      "Generated a management report for {reportingPeriod} covering {businessUnit}. The narrative centers on {keyVariance}, supported by operator notes and recommended follow-up actions.",
  },
  {
    id: "pptx-content-generation",
    name: "PPTX Content Generation",
    category: "Slide content",
    icon: Presentation,
    summary: "Produce slide-ready outlines, speaker notes, and executive framing for internal or client meetings.",
    turnaround: "10-15 min saved per deck",
    outputs: ["Storyline", "Slide headlines", "Speaker notes", "Closing ask"],
    fields: [
      { id: "deckTopic", label: "Deck topic", type: "text", placeholder: "Server optimization quarterly review" },
      { id: "audience", label: "Audience", type: "text", placeholder: "Executive leadership team" },
      { id: "slideCount", label: "Target slide count", type: "number", placeholder: "8" },
      { id: "takeaway", label: "Required takeaway", type: "textarea", placeholder: "Show what improved, where risk remains, and what decision is needed." },
    ],
    previewTitle: "Deck narrative preview",
    previewTemplate:
      "Prepared an {slideCount}-slide storyline for {audience} on {deckTopic}. The structure emphasizes the required takeaway: {takeaway}.",
  },
  {
    id: "ops-memo-generation",
    name: "Ops Memo Generation",
    category: "Internal handoff",
    icon: FileText,
    summary: "Create concise operating memos for system changes, data cleanup tasks, and internal approvals.",
    turnaround: "5-8 min saved per memo",
    outputs: ["Context", "Impact", "Required action", "Owner handoff"],
    fields: [
      { id: "memoTopic", label: "Memo topic", type: "text", placeholder: "Data retention cleanup wave" },
      { id: "owner", label: "Owner", type: "text", placeholder: "Platform operations" },
      { id: "effectiveDate", label: "Effective date", type: "date" },
      { id: "changeSummary", label: "Change summary", type: "textarea", placeholder: "Archive stale records and standardize naming for backup snapshots." },
    ],
    previewTitle: "Memo preview",
    previewTemplate:
      "Drafted an operations memo on {memoTopic} for {owner}, effective {effectiveDate}. The memo explains the change, impact to internal workflows, and next-step responsibilities.",
  },
];

export const summaryCards = [
  {
    id: "automation-coverage",
    label: "Automation coverage",
    value: "4 live generators",
    note: "Tender, finance, PPTX, and ops memo flows",
    icon: LayoutTemplate,
  },
  {
    id: "review-readiness",
    label: "Review readiness",
    value: "92%",
    note: "Drafts include structured handoff fields by default",
    icon: BadgeCheck,
  },
  {
    id: "server-context",
    label: "Server context",
    value: "Connected as input",
    note: "Infrastructure notes can be injected into document prompts",
    icon: FileText,
  },
];

export const activityFeed = [
  {
    id: "run-1",
    title: "Financial report draft refreshed",
    detail: "Q3 variance summary regenerated with updated vendor accrual notes.",
    time: "6 min ago",
  },
  {
    id: "run-2",
    title: "Tender package exported",
    detail: "Northern Grid Retrofit Package sent for commercial review.",
    time: "18 min ago",
  },
  {
    id: "run-3",
    title: "Server cleanup memo prepared",
    detail: "Retention cleanup memo queued for operations approval.",
    time: "32 min ago",
  },
];
