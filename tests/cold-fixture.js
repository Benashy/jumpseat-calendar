function fixture() {
  return {
    schemaVersion: 1, id: "cold-weather", title: "Synthetic cold-weather checklist", revision: "Test revision",
    introduction: [{ id: "practice", type: "note", text: "Synthetic practice note" }],
    sections: [{ id: "preparation", title: "Preparation", canHide: true, blocks: [
      { id: "first", type: "action", text: "First synthetic action", referenceLabel: "Refer to synthetic manual",
        references: ["Synthetic document, chapter TEST, printed page 1/2.", "Synthetic revision status."] },
      { id: "second", type: "action", text: "Second synthetic action", referenceLabel: "Refer to another synthetic manual",
        references: ["Synthetic document, chapter TEST, printed page 2/2."] },
    ] }],
    sources: [{ document: "Synthetic source", section: "Test", revision: "Test", pages: "1-2" }],
  };
}
module.exports = { fixture };
