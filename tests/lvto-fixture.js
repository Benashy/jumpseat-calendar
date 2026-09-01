function fixture() {
  return {
    schemaVersion: 1,
    id: "lvto-fixture",
    title: "Synthetic checklist",
    revision: "Test 1",
    status: "UNDER TEST",
    sourceHash: "a".repeat(64),
    sections: [
      {
        id: "planning",
        title: "Planning",
        items: [
          { id: "minimum", type: "reference", label: "Reference", value: "100" },
          { id: "entered", type: "field", label: "Manual value", inputMode: "numeric", maxLength: 4, layoutGroup: "values" },
          { id: "higher", type: "computed", label: "Higher value", unit: "m", calculation: "maximum", inputIds: ["minimum", "entered"], layoutGroup: "values" },
          { id: "action", type: "check", text: "First deliberate action" },
          {
            id: "return-decision",
            type: "decision",
            text: "Can the aircraft return?",
            options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }],
          },
          { id: "if-no", type: "heading", text: "If no", condition: { decisionId: "return-decision", equals: "no" } },
          { id: "alternate-action", type: "check", text: "Check alternate", condition: { decisionId: "return-decision", equals: "no" } },
          { id: "alternate", type: "field", label: "Alternate", condition: { decisionId: "return-decision", equals: "no" } },
          { id: "reference-note", type: "note", text: "Private source note", tone: "reference" },
        ],
      },
      { id: "references", title: "References", openByDefault: false, items: [{ id: "source", type: "note", text: "Source line" }] },
    ],
    sources: [{ document: "Synthetic source" }],
  };
}

module.exports = { fixture };
