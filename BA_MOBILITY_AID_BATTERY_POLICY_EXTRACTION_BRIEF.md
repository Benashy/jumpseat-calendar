# BA Mobility-Aid Battery Policy Extraction Brief

## Purpose

Extract the current, documented British Airways policy needed to build a concise OpsDeck decision-support check for wheelchairs and other mobility aids powered by batteries.

The tool is for a BA captain checking the information presented operationally, particularly a NOTOC. It is not intended to replace the manuals, Dangerous Goods specialists, Global Ops, the dispatcher or ground handling acceptance procedures.

The finished tool must help answer three practical questions:

1. What information must be confirmed for this mobility aid and battery configuration?
2. Does the information presented appear consistent with current BA policy?
3. If it cannot be confirmed, what exactly needs to be queried or referred?

The result must reduce workload. It must not reproduce a lengthy manual process or ask questions that cannot affect the conclusion.

## Evidence Rules

Use current BA-controlled material wherever available, including:

- OM A, particularly the current Dangerous Goods section covering wheelchairs and mobility aids.
- The current Corporate Dangerous Goods Manual.
- Current NOTOC, SHC and DG code guidance.
- Current ground operations, loading, stowage or handling manuals where they contain BA-specific requirements.
- Current fleet or aircraft-specific restrictions where these change the answer.
- Current operational notices, temporary revisions or bulletins that amend the manuals.

For every rule, provide:

- Document title.
- Exact section, subsection, table or paragraph.
- Revision number and effective date.
- The shortest necessary quotation supporting the rule.
- A plain-English operational interpretation.
- Any qualification, exception or aircraft-specific difference.

Keep the following categories separate:

- Confirmed current BA policy.
- A general regulatory rule that BA explicitly adopts or references.
- General ICAO, IATA, EASA or CAA material that is not confirmed as BA policy.
- Missing, conflicting, superseded or unresolved evidence.

Do not infer a BA rule from general dangerous-goods knowledge. Do not fill a gap with a likely answer. Record it as `UNKNOWN` and identify the missing source.

## Policy Information Required

### 1. Scope and applicability

Confirm:

- BA's definition of a wheelchair, electric mobility aid and other applicable mobility device.
- Whether the rules apply only when the item is used by a passenger or crew member with reduced mobility.
- Any exclusions, such as recreational vehicles, baggage containing a battery or devices that are not mobility aids.
- Whether operator approval is always required and how that approval is evidenced operationally.

### 2. Battery categories

List every battery category used by current BA policy, using BA's exact terminology and distinctions. At minimum, investigate:

- Lithium-ion batteries.
- Spillable wet batteries.
- Non-spillable wet batteries.
- Nickel-metal hydride batteries.
- Dry batteries or other categories.
- Batteries whose chemistry or marking cannot be confirmed.

For each category, state whether the relevant rules differ when the battery is:

- Securely installed in the mobility aid.
- Removed from the mobility aid.
- Carried as a spare.

### 3. Installed batteries

For each battery category, confirm all conditions that apply while installed, including:

- Whether the battery must remain securely attached.
- How accidental activation must be prevented.
- Whether electrical circuits must be isolated and how isolation may be achieved or confirmed.
- Any terminal protection requirement.
- Any orientation, loading, securing or stowage restriction.
- Any requirement arising from whether the mobility aid can remain upright throughout loading and carriage.
- Whether a watt-hour or other capacity limit applies while installed.
- Whether the mobility aid may be carried in the cabin, hold or either.
- What location information must be passed to the commander.

### 4. Removed batteries

For each battery category, confirm:

- When removal is required, optional or prohibited.
- Who may remove the battery and any packaging or handling conditions.
- Maximum permitted capacity, including exact watt-hour thresholds and boundary wording such as `not exceeding` or `less than`.
- Whether amp-hour and voltage may be converted to watt-hours and, if so, the approved calculation and rounding treatment.
- Short-circuit and terminal protection requirements.
- Required packaging or protection against damage.
- Whether carriage must be in the cabin, hold or another specified location.
- Any quantity limit.
- What location and battery information must appear on, or accompany, the NOTOC.

### 5. Spare batteries

For each battery category, confirm:

- Whether spare batteries are permitted.
- Maximum number of spares.
- Maximum capacity of each spare and any combined limit.
- Cabin or hold location.
- Individual protection, packaging and terminal requirements.
- Whether the spare must be associated with a specific mobility aid.
- Operator approval and commander-notification requirements.

### 6. Damaged, defective or recalled batteries

Confirm the BA action when a battery or mobility aid is:

- Damaged.
- Defective.
- Leaking.
- Subject to a safety recall.
- Showing signs of overheating, swelling or other abnormal condition.
- Missing a readable battery type or capacity marking.

State whether carriage is prohibited, requires specialist referral or is subject to another documented process.

### 7. NOTOC and coding requirements

For each supported configuration, confirm:

- Whether a NOTOC entry is required, conditional or not expected.
- The exact SHC or DG code or codes used by BA.
- The description expected on the NOTOC.
- Which details must be shown, including battery type, installed or removed status, watt-hours, quantity and location.
- Whether the commander's acknowledgement or another action is required.
- The correct action when the code, description or location is absent, inconsistent or unclear.

Do not treat a code as verified merely because it appears plausible or is used by another operator.

### 8. Operational and aircraft-specific differences

Identify any rule that varies by:

- Aircraft type or fleet.
- Hold or compartment.
- Whether the aid can be loaded and secured upright.
- Passenger presence or transfer arrangements.
- UK, overseas or third-party ground handling.
- Any other BA-specific condition.

If there are no relevant differences, state that the reviewed sources did not identify any.

## Required Decision Matrix

Produce one row for every supported combination of:

- Battery type.
- Installed, removed or spare status.
- Any capacity band that changes the result.
- Any location or handling condition that changes the result.

Use these columns:

| Field | Required content |
| --- | --- |
| Branch ID | Stable short identifier |
| Battery type | BA terminology |
| Configuration | Installed, removed or spare |
| Decisive inputs | Only facts capable of changing the result |
| Permitted conditions | Exact BA conditions |
| NOTOC expectation | Required, conditional, not expected or unknown |
| Required NOTOC content | Code, description, capacity, quantity and location |
| Clear result | Conditions for no obvious inconsistency |
| Query result | Conditions requiring a discrepancy query |
| Refer result | Conditions where the available evidence cannot determine the answer |
| Source | Document, section, revision and date |
| Confidence | Confirmed BA, general rule only, conflicting or unknown |

## Minimum-Question Workflow

After extracting the policy, design the shortest question sequence that can reach the correct documented outcome.

Requirements:

- Ask one question at a time.
- Show only questions relevant to the selected branch.
- Do not ask for a fact unless it can change the conclusion or required action.
- Allow `Unknown or unclear` where the fact may genuinely be absent.
- An unknown decisive fact must produce a specific request for that information, not a guessed answer.
- Use neutral answer buttons that do not imply a preferred selection.
- End with a short result: `No obvious inconsistency`, `Action or information required`, `Possible discrepancy, query`, or `Unable to determine, refer`.
- State exactly why the result was reached and what should be checked next.

Assess the current candidate inputs and say which should be retained, removed, renamed or made branch-specific:

- Is it a wheelchair or electric mobility aid used by a person with reduced mobility?
- Battery type.
- Installed, removed or spare.
- Securely attached.
- Isolated against inadvertent activation.
- Watt-hour rating.
- Number of spare batteries.
- Terminals protected against short circuit.
- Operator approval confirmed.
- Cabin, hold, other, not shown or unclear location.

## Structured Output

Return both a human-readable report and valid JSON in this form:

```json
{
  "policy_version": "document revisions and effective dates",
  "reviewed_sources": [
    {
      "document": "",
      "revision": "",
      "effective_date": "",
      "sections": []
    }
  ],
  "missing_sources": [],
  "conflicts": [],
  "battery_categories": [],
  "decision_branches": [
    {
      "id": "",
      "battery_type": "",
      "configuration": "INSTALLED|REMOVED|SPARE",
      "conditions": [],
      "required_inputs": [],
      "limits": {
        "maximum_watt_hours": null,
        "maximum_spares": null,
        "boundary_wording": ""
      },
      "permitted_locations": [],
      "notoc": {
        "expectation": "REQUIRED|CONDITIONAL|NOT_EXPECTED|UNKNOWN",
        "codes": [],
        "required_content": []
      },
      "outcomes": {
        "clear_when": [],
        "query_when": [],
        "refer_when": []
      },
      "sources": [
        {
          "document": "",
          "section": "",
          "revision": "",
          "effective_date": "",
          "supporting_text": ""
        }
      ],
      "status": "CONFIRMED_BA|GENERAL_ONLY|CONFLICTING|UNKNOWN"
    }
  ],
  "recommended_workflow": {
    "questions": [],
    "branches": [],
    "removed_questions": []
  }
}
```

## Final Gross-Error Check

Before returning the result, explicitly confirm:

- No capacity threshold has been rounded in a permissive direction.
- Installed-battery and removed-battery limits have not been confused.
- Spare-battery rules have not been applied to an installed or removed battery.
- Cabin and hold requirements have not been reversed.
- Spillable and non-spillable rules have not been combined.
- General regulatory material has not been presented as confirmed BA policy.
- Every green or clear outcome is supported by a current BA source.
- Every unresolved branch remains visibly unknown or refer, rather than inferred.
