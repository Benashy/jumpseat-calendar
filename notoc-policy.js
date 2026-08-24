(function attachNotocPolicy(globalScope) {
  "use strict";

  const CARRIED_FORWARD = "CARRIED_FORWARD_REQUIRES_CURRENT_MANUAL_CHECK";
  const MISSING_SOURCE = "MISSING_SOURCE";

  const baseSources = [
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
    {
      id: "UK-CAA-PASSENGER-MOBILITY-AID-PROVISION",
      documentId: "UK-CAA-PASSENGER-BAGGAGE-GUIDANCE",
      documentTitle: "UK CAA passenger baggage guidance",
      sectionPath: ["Battery-powered mobility aids"],
      supportedText: "The passenger mobility-aid provision applies to a battery-powered wheelchair or mobility aid used by a passenger whose mobility is restricted and who is travelling with the item.",
      classification: "REGULATORY_GUIDANCE",
      verificationStatus: "VERIFIED_CURRENT_PUBLIC_BA",
      url: "https://www.caa.co.uk/air-passengers/about-your-trip/baggage/safety-advice-on-what-to-pack/",
    },
    {
      id: "IATA-2026-MOBILITY-AID-BATTERY-LIMITS",
      documentId: "IATA-DGR-67-MOBILITY-AID-GUIDANCE",
      documentTitle: "IATA Battery-Powered Wheelchair and Mobility Aid Guidance 2026",
      sectionPath: ["Lithium battery-powered mobility aids", "Removed and spare batteries"],
      supportedText: "Removed lithium batteries are limited to 300 Wh combined. Spare lithium batteries are separately limited to 300 Wh combined per mobility aid. Removed and spare lithium batteries are carried in the cabin.",
      classification: "OFFICIAL_INDUSTRY_GUIDANCE",
      verificationStatus: "VERIFIED_CURRENT_OFFICIAL_GUIDANCE",
      url: "https://www.iata.org/contentassets/6fea26dd84d24b26a7a1fd5788561d6e/mobility-aid-guidance-document.pdf",
    },
    {
      id: "BA-PUBLIC-MOBILITY-AID-OWN-USE",
      documentId: "BA-DISABILITY-ASSISTANCE",
      documentTitle: "British Airways disability assistance guidance",
      sectionPath: ["Wheelchairs and mobility aids"],
      supportedText: "British Airways describes carrying wheelchairs and mobility aids for the passenger's own use as hold baggage, subject to the applicable arrangements.",
      classification: "PUBLIC_BA",
      verificationStatus: "VERIFIED_CURRENT_PUBLIC_BA",
      url: "https://www.britishairways.com/content/en/us/information/disability-assistance/how-to-request-assistance",
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

  const baseRules = [
    rule("BA-OMA-NOTOC-SIGNATURE-ACKNOWLEDGEMENT", "NOTOC signature acknowledgement", "SIGNATURE", "DOCUMENTED_BA", ["BA-OMA-NOTOC-SIGNATURE", "BA-OMB-NOTOC-PROCESS"]),
    rule("BA-OMA-NOTOC-SUSPECTED-ERROR-REFER", "Suspected NOTOC error referral", "NOTOC_PROCESS", "DOCUMENTED_BA", ["BA-OMA-NOTOC-FORM"]),
    rule("BA-OMA-OPERATOR-ACCEPTANCE-RESPONSIBILITIES", "Operator acceptance responsibilities", "SIGNATURE", "DOCUMENTED_BA", ["BA-OMA-OPERATOR-ACCEPTANCE"]),
    rule("BA-LBM-SPECIAL-LOAD-SECURING-INSPECTION", "Special-load securing inspection", "NOTOC_PROCESS", "DOCUMENTED_BA", ["BA-LBM-SPECIAL-LOAD"]),
    rule("BA-CDGM-NOTOC-CODE-MAPPING-MISSING", "Missing authoritative SHC/DG mapping", "SHC_CODE", "UNSUPPORTED", ["BA-SHC-MAPPING-MISSING"]),
    rule("OPSDECK-NOTOC-INDICATOR-CROSSCHECK", "NOTOC indicator cross-check", "NOTOC_PROCESS", "APP_GUIDANCE", ["OPSDECK-NOTOC-APP-GUIDANCE", "BA-OMA-NOTOC-FORM"]),
    {
      id: "OPSDECK-MOBILITY-AID-PASSENGER-PROVISION",
      title: "Passenger mobility-aid provision",
      domain: "EMA",
      classification: "PUBLIC_BA",
      verificationStatus: "VERIFIED_CURRENT_PUBLIC_BA",
      sourceIds: ["UK-CAA-PASSENGER-MOBILITY-AID-PROVISION", "BA-PUBLIC-MOBILITY-AID-OWN-USE"],
      requiredInputs: ["mobilityAidConfirmed"],
      releaseStatus: "ACTIVE",
    },
    {
      id: "OPSDECK-IATA-MOBILITY-AID-CUMULATIVE-LIMIT",
      title: "Current IATA cumulative lithium mobility-aid limits",
      domain: "EMA",
      classification: "OFFICIAL_INDUSTRY_GUIDANCE",
      verificationStatus: "VERIFIED_CURRENT_OFFICIAL_GUIDANCE",
      sourceIds: [
        "IATA-2026-MOBILITY-AID-BATTERY-LIMITS",
        "UK-CAA-PASSENGER-MOBILITY-AID-PROVISION",
        "BA-PUBLIC-MOBILITY-AID-OWN-USE",
      ],
      requiredInputs: ["lithiumLimitBand", "spareLithiumBand"],
      releaseStatus: "ACTIVE",
    },
  ];

  const POLICY_PACK = {
    id: "opsdeck-ba-notoc-development",
    version: "2026.08-development.1",
    status: "DEVELOPMENT",
    sources: [...baseSources],
    rules: [...baseRules],
    handlingCodes: [],
    mappingMetadata: null,
    mobilityAidPolicy: null,
    mobilityMetadata: null,
  };

  const CONFIRMED_MOBILITY_BRANCH_IDS = new Set(["LI-I", "DRY-I", "NSW-I", "WET-I-UP", "WET-R-NOUPRIGHT"]);
  const CONFIRMED_DISCREPANCY_BRANCH_IDS = new Set(["WET-S"]);
  let currentPolicyVersion = POLICY_PACK.version;
  let handlingSources = [];
  let handlingRules = [];
  let handlingCodes = [];
  let mobilitySources = [];
  let mobilityRules = [];

  function rebuildPolicyPack() {
    POLICY_PACK.version = currentPolicyVersion;
    POLICY_PACK.status = handlingCodes.length || POLICY_PACK.mobilityAidPolicy ? "CONTROLLED_MAPPING" : "DEVELOPMENT";
    POLICY_PACK.sources = [...baseSources, ...handlingSources, ...mobilitySources];
    POLICY_PACK.rules = [...baseRules, ...handlingRules, ...mobilityRules];
    POLICY_PACK.handlingCodes = handlingCodes;
  }

  function safeId(value) {
    return String(value || "UNKNOWN").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function setHandlingCodeMapping(entries, metadata = {}) {
    if (!Array.isArray(entries)) throw new Error("The BA code mapping must be an array.");

    const dynamicSources = [];
    const dynamicRules = [];
    const nextHandlingCodes = entries.map((entry, index) => {
      const code = String(entry.code || "").trim().toUpperCase();
      const suffix = `${String(index + 1).padStart(3, "0")}-${safeId(code)}`;
      const sourceId = `BA-NOTOC-MAPPING-SOURCE-${suffix}`;
      const ruleId = `BA-NOTOC-MAPPING-RULE-${suffix}`;
      const verified = entry.verificationStatus === "VERIFIED_CURRENT_MANUAL";
      const unresolved = entry.verificationStatus === "UNVERIFIED_NOT_FOUND";
      const classification = unresolved ? "UNSUPPORTED" : "DOCUMENTED_BA";
      const releaseStatus = verified ? "ACTIVE" : "BLOCKED";

      dynamicSources.push({
        id: sourceId,
        documentId: "BA-NOTOC-CODE-LIBRARY",
        documentTitle: entry.source.document,
        sectionPath: [entry.source.section, entry.source.revision].filter(Boolean),
        supportedText: entry.conditions,
        classification,
        verificationStatus: entry.verificationStatus,
      });
      dynamicRules.push({
        id: ruleId,
        title: `${code} SHC/DG mapping`,
        domain: "SHC_CODE",
        classification,
        verificationStatus: entry.verificationStatus,
        sourceIds: [sourceId],
        requiredInputs: [],
        releaseStatus,
      });

      return {
        code,
        aliases: entry.aliases,
        description: entry.description,
        appearsOn: entry.appearsOn,
        expectation: entry.expectation,
        conditionSummary: entry.conditions,
        crewAction: entry.crewAction,
        sourceIds: [sourceId],
        ruleId,
        verificationStatus: entry.verificationStatus,
        releaseStatus,
      };
    });

    currentPolicyVersion = String(metadata.policyVersion || "private-mapping");
    handlingSources = dynamicSources;
    handlingRules = dynamicRules;
    handlingCodes = nextHandlingCodes;
    POLICY_PACK.mappingMetadata = {
      source: metadata.source || "cloud",
      updatedAt: metadata.updatedAt || null,
      codeCount: nextHandlingCodes.length,
      unresolvedCodes: nextHandlingCodes
        .filter((entry) => entry.verificationStatus === "UNVERIFIED_NOT_FOUND")
        .map((entry) => entry.code),
    };
    rebuildPolicyPack();

    return POLICY_PACK.mappingMetadata;
  }

  function mobilitySourceRecord(branch, source, index) {
    const sourceId = `BA-MOBILITY-${safeId(branch.id)}-SOURCE-${String(index + 1).padStart(2, "0")}`;
    const internal = source.evidence_class === "INTERNAL_BA";
    return {
      id: sourceId,
      documentId: safeId(source.document),
      documentTitle: source.document,
      sectionPath: [source.section, source.revision, source.effective_date].filter(Boolean),
      supportedText: [
        ...(branch.conditions || []),
        ...(branch.packaging || []),
        source.qualification,
      ].filter(Boolean).join(" "),
      classification: internal ? "DOCUMENTED_BA" : "PUBLIC_BA",
      verificationStatus: internal ? "VERIFIED_SUPPLIED_MANUAL" : "VERIFIED_CURRENT_PUBLIC_BA",
    };
  }

  function setMobilityAidPolicy(policy, metadata = {}) {
    if (!policy || !Array.isArray(policy.decision_branches)) {
      throw new Error("The BA mobility-aid policy is invalid.");
    }

    const nextSources = [];
    const nextRules = [];
    const branches = policy.decision_branches.map((branch) => {
      const sourceRecords = (branch.sources || []).map((source, index) => mobilitySourceRecord(branch, source, index));
      const sourceIds = sourceRecords.map((source) => source.id);
      const ruleId = `BA-MOBILITY-${safeId(branch.id)}`;
      const active = CONFIRMED_MOBILITY_BRANCH_IDS.has(branch.id) || CONFIRMED_DISCREPANCY_BRANCH_IDS.has(branch.id);
      nextSources.push(...sourceRecords);
      nextRules.push({
        id: ruleId,
        title: `${branch.id} mobility-aid battery branch`,
        domain: "EMA",
        classification: "DOCUMENTED_BA",
        verificationStatus: active ? "REVIEWED_BA_EVIDENCE" : "REVIEWED_WITH_LIMITATION",
        sourceIds,
        requiredInputs: [],
        releaseStatus: active ? "ACTIVE" : "BLOCKED",
      });
      return { ...branch, ruleId, sourceIds };
    });

    currentPolicyVersion = String(metadata.policyVersion || policy.policy_version || currentPolicyVersion);
    mobilitySources = nextSources;
    mobilityRules = nextRules;
    POLICY_PACK.mobilityAidPolicy = { ...policy, decision_branches: branches };
    POLICY_PACK.mobilityMetadata = {
      updatedAt: metadata.updatedAt || null,
      branchCount: branches.length,
      source: metadata.source || "cloud",
    };
    rebuildPolicyPack();
    return POLICY_PACK.mobilityMetadata;
  }

  function resetHandlingCodeMapping() {
    handlingSources = [];
    handlingRules = [];
    handlingCodes = [];
    POLICY_PACK.mappingMetadata = null;
    if (!POLICY_PACK.mobilityAidPolicy) currentPolicyVersion = "2026.08-development.1";
    rebuildPolicyPack();
  }

  function resetMobilityAidPolicy() {
    mobilitySources = [];
    mobilityRules = [];
    POLICY_PACK.mobilityAidPolicy = null;
    POLICY_PACK.mobilityMetadata = null;
    if (!handlingCodes.length) currentPolicyVersion = "2026.08-development.1";
    rebuildPolicyPack();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      POLICY_PACK,
      resetHandlingCodeMapping,
      resetMobilityAidPolicy,
      setHandlingCodeMapping,
      setMobilityAidPolicy,
    };
  } else {
    globalScope.OpsDeckNotocPolicy = {
      POLICY_PACK,
      resetHandlingCodeMapping,
      resetMobilityAidPolicy,
      setHandlingCodeMapping,
      setMobilityAidPolicy,
    };
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
