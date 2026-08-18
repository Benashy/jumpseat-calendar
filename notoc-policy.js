(function attachNotocPolicy(globalScope) {
  "use strict";

  const CARRIED_FORWARD = "CARRIED_FORWARD_REQUIRES_CURRENT_MANUAL_CHECK";
  const MISSING_SOURCE = "MISSING_SOURCE";

  const sources = [
    {
      id: "BA-OMA-NOTOC-FORM",
      documentId: "BA-OMA",
      documentTitle: "BA Operations Manual Part A",
      sectionPath: ["9.1.2.k/l", "NOTOC Form"],
      supportedText: "The NOTOC identifies the flight, date, aircraft registration, goods, quantity and location. Suspected errors are raised with the TRM/Coordinator or equivalent for clarification from cargo specialists.",
      classification: "DOCUMENTED_BA",
      verificationStatus: CARRIED_FORWARD,
    },
    {
      id: "BA-OMA-NOTOC-SIGNATURE",
      documentId: "BA-OMA",
      documentTitle: "BA Operations Manual Part A",
      sectionPath: ["9.1.5.a", "Flight Crew Responsibilities"],
      supportedText: "By signing the NOTOC the aircraft Commander is only acknowledging receipt of written notification of all Dangerous Goods and their location aboard the aircraft.",
      exactQuote: "By signing the NOTOC the aircraft Commander is only acknowledging receipt of written notification of all Dangerous Goods and their location aboard the aircraft.",
      classification: "DOCUMENTED_BA",
      verificationStatus: CARRIED_FORWARD,
    },
    {
      id: "BA-OMA-OPERATOR-ACCEPTANCE",
      documentId: "BA-OMA",
      documentTitle: "BA Operations Manual Part A",
      sectionPath: ["9.1.5.c", "Aircraft Operator Responsibilities"],
      supportedText: "The operator performs Dangerous Goods acceptance functions, including documentation, packaging, marking, labelling and condition checks before acceptance and loading.",
      classification: "DOCUMENTED_BA",
      verificationStatus: CARRIED_FORWARD,
    },
    {
      id: "BA-OMA-DG-COMMANDER-POSITION",
      documentId: "BA-OMA",
      documentTitle: "BA Operations Manual Part A",
      sectionPath: ["Dangerous Goods carriage guidance", "Exact paragraph to be confirmed"],
      supportedText: "Ground staff Dangerous Goods carriage guidance is followed. The Commander cannot use discretion to onload contrary to that guidance and may offload where there is doubt concerning carriage.",
      classification: "DOCUMENTED_BA",
      verificationStatus: CARRIED_FORWARD,
    },
    {
      id: "BA-OMB-NOTOC-PROCESS",
      documentId: "BA-OMB",
      documentTitle: "BA Operations Manual Part B",
      sectionPath: ["2.9.4", "NOTOC Process"],
      supportedText: "The Captain's signature proves awareness of the restricted articles and their location. Both copies are signed, one retained at the station and one onboard.",
      classification: "DOCUMENTED_BA",
      verificationStatus: CARRIED_FORWARD,
    },
    {
      id: "BA-LBM-SPECIAL-LOAD",
      documentId: "AIRBUS-LBM",
      documentTitle: "Airbus Load & Balance Manual",
      sectionPath: ["Loading", "3.7.1", "Special Load: Notification to Captain", "Introduction"],
      supportedText: "The Captain may wish to inspect how the load has been secured before departure.",
      classification: "DOCUMENTED_BA",
      verificationStatus: CARRIED_FORWARD,
    },
    {
      id: "BA-OMA-EMA-LI-INSTALLED",
      documentId: "BA-OMA",
      documentTitle: "BA Operations Manual Part A",
      sectionPath: ["Section 9.B", "Lithium batteries installed in electric wheelchairs or EMAs"],
      supportedText: "The battery remains securely attached and is isolated against inadvertent activation. Operator approval and PIC location notification apply. The recovered rule does not specify a maximum Wh rating while securely installed.",
      classification: "DOCUMENTED_BA",
      verificationStatus: CARRIED_FORWARD,
    },
    {
      id: "BA-OMA-EMA-LI-REMOVED",
      documentId: "BA-OMA",
      documentTitle: "BA Operations Manual Part A",
      sectionPath: ["Section 9.B", "Lithium batteries removed from electric wheelchairs or EMAs"],
      supportedText: "A removed lithium EMA battery is limited to 300 Wh, carried in the cabin, protected against short circuit, subject to operator approval and notified to the PIC with its location.",
      classification: "DOCUMENTED_BA",
      verificationStatus: CARRIED_FORWARD,
    },
    {
      id: "BA-OMA-EMA-LI-SPARE",
      documentId: "BA-OMA",
      documentTitle: "BA Operations Manual Part A",
      sectionPath: ["Section 9.B", "Spare lithium battery for an electric wheelchair or EMA", "Exact subsection title to be confirmed"],
      supportedText: "A maximum of one spare lithium EMA battery is carried in the cabin, limited to 300 Wh, individually protected against short circuit and subject to operator approval and location notification.",
      classification: "DOCUMENTED_BA",
      verificationStatus: CARRIED_FORWARD,
    },
    {
      id: "BA-OMA-EMA-NONSPILLABLE",
      documentId: "BA-OMA",
      documentTitle: "BA Operations Manual Part A",
      sectionPath: ["Section 9.B", "Non-spillable wet battery mobility aid", "Exact subsection to be confirmed"],
      supportedText: "The recovered high-level rule permits the relevant EMA category and one spare non-spillable battery in the hold, with operator approval and PIC location notification. Detailed handling requirements are not available in this pack.",
      classification: "DOCUMENTED_BA",
      verificationStatus: CARRIED_FORWARD,
    },
    {
      id: "BA-OMA-EMA-SPILLABLE",
      documentId: "BA-OMA",
      documentTitle: "BA Operations Manual Part A",
      sectionPath: ["Section 9.B", "Spillable wet battery mobility aid", "Exact subsection to be confirmed"],
      supportedText: "The recovered high-level rule allows carriage subject to the applicable requirements and does not permit a spare spillable battery. Detailed handling requirements require the CDGM.",
      classification: "DOCUMENTED_BA",
      verificationStatus: CARRIED_FORWARD,
    },
    {
      id: "BA-CDGM-MISSING",
      documentId: "BA-CDGM",
      documentTitle: "BA Corporate Dangerous Goods Manual",
      sectionPath: ["Chapter 12 and specialist mobility-aid handling sections"],
      supportedText: "The full NOTOC regime and specialist handling detail are not available in the current source pack.",
      classification: "UNSUPPORTED",
      verificationStatus: MISSING_SOURCE,
    },
    {
      id: "BA-SHC-MAPPING-MISSING",
      documentId: "BA-CDGM",
      documentTitle: "BA SHC/DG code mapping",
      sectionPath: ["Authoritative mapping not available"],
      supportedText: "No complete, current BA code-to-NOTOC mapping is available in this policy pack. Unknown codes are referred rather than inferred.",
      classification: "UNSUPPORTED",
      verificationStatus: MISSING_SOURCE,
    },
    {
      id: "OPSDECK-NOTOC-APP-GUIDANCE",
      documentId: "OPSDECK",
      documentTitle: "OpsDeck NOTOC Assistant design control",
      sectionPath: ["Captain cross-check boundary"],
      supportedText: "This tool is a Captain's cross-check. It does not replace Dangerous Goods acceptance, the NOTOC, the loadsheet, BA manuals or specialist advice.",
      classification: "APP_GUIDANCE",
      verificationStatus: "VERIFIED_CURRENT_MANUAL",
    },
  ];

  const rule = (id, title, domain, classification, sourceIds, requiredInputs = []) => ({
    id,
    title,
    domain,
    classification,
    verificationStatus: classification === "APP_GUIDANCE" ? "VERIFIED_CURRENT_MANUAL" : CARRIED_FORWARD,
    sourceIds,
    requiredInputs,
    releaseStatus: classification === "APP_GUIDANCE" ? "ACTIVE" : "BLOCKED",
  });

  const rules = [
    rule("BA-OMA-NOTOC-SIGNATURE-ACKNOWLEDGEMENT", "NOTOC signature acknowledgement", "SIGNATURE", "DOCUMENTED_BA", ["BA-OMA-NOTOC-SIGNATURE", "BA-OMB-NOTOC-PROCESS"]),
    rule("BA-OMA-NOTOC-SUSPECTED-ERROR-REFER", "Suspected NOTOC error referral", "NOTOC_PROCESS", "DOCUMENTED_BA", ["BA-OMA-NOTOC-FORM"]),
    rule("BA-OMA-OPERATOR-ACCEPTANCE-RESPONSIBILITIES", "Operator acceptance responsibilities", "SIGNATURE", "DOCUMENTED_BA", ["BA-OMA-OPERATOR-ACCEPTANCE"]),
    rule("BA-LBM-SPECIAL-LOAD-SECURING-INSPECTION", "Special-load securing inspection", "NOTOC_PROCESS", "DOCUMENTED_BA", ["BA-LBM-SPECIAL-LOAD"]),
    rule("BA-OMA-EMA-LI-INSTALLED", "Installed lithium EMA battery", "EMA", "DOCUMENTED_BA", ["BA-OMA-EMA-LI-INSTALLED"], ["securelyAttached", "isolatedAgainstInadvertentActivation", "operatorApprovalConfirmed", "location"]),
    rule("BA-OMA-EMA-LI-REMOVED", "Removed lithium EMA battery", "EMA", "DOCUMENTED_BA", ["BA-OMA-EMA-LI-REMOVED"], ["wattHours", "terminalsProtected", "operatorApprovalConfirmed", "location"]),
    rule("BA-OMA-EMA-LI-SPARE", "Spare lithium EMA battery", "EMA", "DOCUMENTED_BA", ["BA-OMA-EMA-LI-SPARE"], ["spareCount", "wattHours", "terminalsProtected", "operatorApprovalConfirmed", "location"]),
    rule("BA-OMA-EMA-NONSPILLABLE", "Non-spillable wet battery EMA", "EMA", "DOCUMENTED_BA", ["BA-OMA-EMA-NONSPILLABLE", "BA-CDGM-MISSING"], ["installedStatus", "location"]),
    rule("BA-OMA-EMA-SPILLABLE", "Spillable wet battery EMA", "EMA", "DOCUMENTED_BA", ["BA-OMA-EMA-SPILLABLE", "BA-CDGM-MISSING"], ["installedStatus", "location"]),
    rule("BA-CDGM-NOTOC-CODE-MAPPING-MISSING", "Missing authoritative SHC/DG mapping", "SHC_CODE", "UNSUPPORTED", ["BA-SHC-MAPPING-MISSING"]),
    rule("OPSDECK-NOTOC-INDICATOR-CROSSCHECK", "NOTOC indicator cross-check", "NOTOC_PROCESS", "APP_GUIDANCE", ["OPSDECK-NOTOC-APP-GUIDANCE", "BA-OMA-NOTOC-FORM"]),
  ];

  const POLICY_PACK = {
    id: "opsdeck-ba-notoc-development",
    version: "2026.08-development.1",
    status: "DEVELOPMENT",
    sources,
    rules,
    handlingCodes: [],
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { POLICY_PACK };
  } else {
    globalScope.OpsDeckNotocPolicy = { POLICY_PACK };
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
