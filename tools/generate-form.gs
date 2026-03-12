/**
 * CXDHV — Anonymous CX Domain Health Survey Generator
 *
 * HOW TO USE:
 * 1. Go to https://script.google.com
 * 2. Create a new project
 * 3. Paste this entire file
 * 4. Click Run → createCXHealthSurvey
 * 5. Authorize when prompted
 * 6. Check your Google Drive for "CX Domain Health Survey"
 * 7. Open the form → Send → copy link → share with team
 *
 * The form collects anonymous 1–10 scores for every signal (multiply by 10 for dashboard 0–100 scale).
 * Responses auto-land in a linked Google Sheet.
 *
 * Team Health is excluded — those scores come from a separate source.
 */

function createCXHealthSurvey() {
  var form = FormApp.create("CX Domain Health Survey");
  form.setDescription(
    "Anonymous CX health assessment. Rate each dimension on a 1–10 scale.\n\n" +
    "Scoring guide:\n" +
    "  1–2  — Broken or non-existent\n" +
    "  3–5  — Critical gaps, needs immediate attention\n" +
    "  6–7  — Functional but needs improvement\n" +
    "  8–9  — Solid, minor refinements needed\n" +
    "  10   — Exceptional\n\n" +
    "This survey is ANONYMOUS. Do not enter your name anywhere."
  );
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setConfirmationMessage("Thank you. Your anonymous response has been recorded.");

  // ── Signal dimensions (same 5 for every function) ──────────────
  var signals = [
    { label: "Process Clarity",              help: "How clear are the steps, ownership, and expectations?" },
    { label: "Process Accuracy",             help: "When followed, does the process produce correct results?" },
    { label: "System Functionality",         help: "Do the tools and systems support this function well?" },
    { label: "Accountability & Visibility",  help: "Is ownership clear and is progress visible to stakeholders?" },
    { label: "Overall Effectiveness",        help: "How well is this function actually performing end-to-end?" },
  ];

  // ── Domain / Function definitions (from live DB, Team Health excluded) ──
  var domains = [
    {
      label: "External Operations (EXOPS)",
      desc: "Onboardings, Support Requests, Customer Training",
      functions: [
        { label: "Customer Onboardings",                    desc: "Every purchase includes a customer onboarding." },
        { label: "CX Support Requests",                     desc: "BD-initiated requests routed to FDEs." },
        { label: "Customer Training / Field Installations",  desc: "Trip reports and field logs per engagement." },
        { label: "Bailment",                                desc: "Equipment bailment tracking and management." },
      ],
    },
    {
      label: "Voice of Customer (VOC)",
      desc: "Most critical, least systemized. Field intelligence feeding product roadmap, QA, and BVA.",
      functions: [
        { label: "VOC Feedback Loop / Product Shaping", desc: "Capture and route customer feedback into BVA and product pipeline." },
        { label: "Bug Reporting & Remediation",          desc: "Field-identified bugs submitted to QA via Jira." },
        { label: "Customer Zero Testing",                desc: "Early product testing with select customer partners." },
      ],
    },
    {
      label: "Customer Support & Satisfaction (CSS)",
      desc: "Ticket management, technical resolution, and satisfaction measurement.",
      functions: [
        { label: "Ticket Management",   desc: "Routing, SLA tracking, and throughput of inbound tickets." },
        { label: "CSAT / NPS",          desc: "Survey generation habit and automated NPS. Critical gap." },
        { label: "RMA",                 desc: "Return merchandise authorization process." },
      ],
    },
    {
      label: "Internal Operations (OPS)",
      desc: "Internal company / team training, knowledge management, reporting.",
      functions: [
        { label: "Team & Company Training",              desc: "FDE-generated training materials for internal teams and new hires." },
        { label: "Knowledge Management & Sharing",       desc: "Maintenance of internal knowledge resources — accuracy, coverage, findability." },
        { label: "Reporting - Field Logs & Trip Reports", desc: "Regular reporting cadence." },
      ],
    },
  ];

  // ── Build domain sections ──────────────────────────────────────
  // 4 domains × (3–4 functions) × 5 signals = 65 questions
  domains.forEach(function (domain) {
    form.addPageBreakItem()
      .setTitle(domain.label)
      .setHelpText(domain.desc);

    domain.functions.forEach(function (fn) {
      form.addSectionHeaderItem()
        .setTitle(fn.label)
        .setHelpText(fn.desc);

      signals.forEach(function (sig) {
        var item = form.addScaleItem();
        item.setTitle(fn.label + " — " + sig.label);
        item.setHelpText(sig.help);
        item.setBounds(1, 10);
        item.setLabels("Broken", "Exceptional");
        item.setRequired(true);
      });
    });
  });

  // ── Optional open-ended ────────────────────────────────────────
  form.addPageBreakItem()
    .setTitle("Additional Feedback (Optional)")
    .setHelpText("Anything else you want leadership to know.");

  form.addParagraphTextItem()
    .setTitle("What is the single biggest blocker to CX team effectiveness right now?")
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle("What is working well that we should protect or double down on?")
    .setRequired(false);

  // ── Create linked spreadsheet ──────────────────────────────────
  var ss = SpreadsheetApp.create("CX Domain Health Survey — Responses");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // ── Log the URLs ───────────────────────────────────────────────
  Logger.log("Form created!");
  Logger.log("Edit URL:     " + form.getEditUrl());
  Logger.log("Share URL:    " + form.getPublishedUrl());
  Logger.log("Sheet URL:    " + ss.getUrl());
}
