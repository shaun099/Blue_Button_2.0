/**
 * Filters a FHIR Bundle to return only carrier ExplanationOfBenefit resources.
 * @param {object} bundle - The FHIR bundle from Blue Button 2.0 API
 * @returns {object} - A bundle containing only carrier ExplanationOfBenefit resources
 */
export function filterCarrierEOB(bundle) {
  if (!bundle || !Array.isArray(bundle.entry)) {
    return { ...bundle, entry: [] };
  }
  const filteredEntries = bundle.entry.filter((e) => {
    const res = e.resource;
    if (!res || res.resourceType !== "ExplanationOfBenefit") return false;
    if (!res.type || !res.type.coding) return false;
    return res.type.coding.some(
      (coding) =>
        coding.system ===
          "https://bluebutton.cms.gov/resources/codesystem/eob-type" &&
        coding.code === "CARRIER"
    );
  });
  return {
    ...bundle,
    entry: filteredEntries,
    total: filteredEntries.length,
  };
}

/**
 * Enhanced transformation for Blue Button 2.0 Carrier EOBs:
 * - Produces fully "connected" data: each line item includes its related diagnoses and care team members as full objects.
 * - Returns a structured summary for UI or downstream processing.
 * @param {Object} rawFHIR - The raw FHIR ExplanationOfBenefit bundle
 * @returns {Object}
 */
export function transformCarrierEOB(rawFHIR) {
  if (!rawFHIR?.entry?.length) {
    throw new Error("Invalid FHIR input: no entries found");
  }

  const claim = rawFHIR.entry[0]?.resource;
  if (!claim || claim.resourceType !== "ExplanationOfBenefit") {
    throw new Error("Invalid FHIR input: ExplanationOfBenefit missing or invalid");
  }

  // Helper to safely access nested values
  const getValue = (obj, path, defaultValue = null) => {
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : defaultValue), obj);
  };

  // Helper to extract value from extensions by URL
  const getExtensionValue = (extensions, url) => {
    return extensions?.find(e => e.url === url);
  };

  // Index diagnoses by sequence
  const diagnoses = (claim.diagnosis || []).map(d => ({
    sequence: d.sequence,
    code: getValue(d, 'diagnosisCodeableConcept.coding.0.code', 'Unknown'),
    description: getValue(d, 'diagnosisCodeableConcept.coding.0.display', 'Not provided')?.replace(/"/g, ''),
    type: getValue(d, 'type.0.coding.0.display', 'Unknown')
  }));
  const diagnosisMap = Object.fromEntries(diagnoses.map(d => [d.sequence, d]));

  // Process care team members
  const careTeam = (claim.careTeam || []).map(ct => {
    const ext = ct.extension || [];
    return {
      sequence: ct.sequence,
      providerId: getValue(ct, 'provider.identifier.value'),
      name: getValue(ct, 'provider.display', 'Not provided'),
      npi: getValue(ct, 'provider.identifier.value'),
      role: getValue(ct, 'role.coding.0.display', 'Unknown'),
      isResponsible: ct.responsible || false,
      specialty: (ct.qualification?.coding || []).find(c => c.system?.includes('prvdr_spclty'))?.display || null,
      participation: getExtensionValue(ext, 'https://bluebutton.cms.gov/resources/variables/prtcptng_ind_cd')?.valueCoding?.display
    };
  });
  const careTeamMap = Object.fromEntries(careTeam.map(ct => [ct.sequence, ct]));

  // Process line items
  const lineItems = (claim.item || []).map(item => {
    const ext = item.extension || [];
    const ndcCode = getExtensionValue(item.productOrService?.extension, 'http://hl7.org/fhir/sid/ndc')?.valueCoding?.code;

    // Get related diagnoses and care team for this line item
    const itemDiagnoses = (item.diagnosisSequence || []).map(seq => diagnosisMap[seq]).filter(Boolean);
    const itemCareTeam = (item.careTeamSequence || []).map(seq => careTeamMap[seq]).filter(Boolean);

    return {
      lineNumber: item.sequence,
      serviceDate: getValue(item, 'servicedPeriod.start') || getValue(item, 'servicedDate', 'Unknown'),
      procedureCode: getValue(item, 'productOrService.coding.0.code', null),
      procedureDescription: getValue(item, 'productOrService.coding.0.display', null),
      modifiers: (item.modifier || []).map(m => ({
        code: getValue(m, 'coding.0.code'),
        description: getValue(m, 'coding.0.display')
      })),
      diagnosisPointers: item.diagnosisSequence || [],
      placeOfService: {
        code: getValue(item, 'locationCodeableConcept.coding.0.code'),
        description: getValue(item, 'locationCodeableConcept.coding.0.display'),
        state: getExtensionValue(item.locationCodeableConcept?.extension, 'https://bluebutton.cms.gov/resources/variables/prvdr_state_cd')?.valueCoding?.code,
        zip: getExtensionValue(item.locationCodeableConcept?.extension, 'https://bluebutton.cms.gov/resources/variables/prvdr_zip')?.valueCoding?.code
      },
      quantity: getValue(item, 'quantity.value'),
      ndcCode,
      extensions: {
        betosCode: getExtensionValue(ext, 'https://bluebutton.cms.gov/resources/variables/betos_cd')?.valueCoding?.display,
        processingIndicator: getExtensionValue(ext, 'https://bluebutton.cms.gov/resources/variables/line_prcsg_ind_cd')?.valueCoding?.display,
        cliaLabNumber: getExtensionValue(ext, 'https://bluebutton.cms.gov/resources/variables/carr_line_clia_lab_num')?.valueIdentifier?.value
      },
      diagnoses: itemDiagnoses,
      careTeam: itemCareTeam
    };
  });

  // Sort line items by service date
  lineItems.sort((a, b) =>
    new Date(a.serviceDate || '2100-01-01') - new Date(b.serviceDate || '2100-01-01')
  );

  // Process test results
  const testResults = (claim.contained || [])
    .filter(r => r.resourceType === 'Observation')
    .map(obs => ({
      testId: obs.id,
      testName: getValue(obs, 'code.coding.0.display', 'Unknown Test'),
      code: getValue(obs, 'code.coding.0.code'),
      result: obs.valueQuantity?.value ?? getValue(obs, 'valueString'),
      unit: getValue(obs, 'valueQuantity.unit')
    }));

  const extensions = claim.extension || [];

  return {
    claimInfo: {
      id: claim.id,
      type: getValue(claim, 'type.coding.0.display', 'Professional Claim'),
      status: claim.status,
      outcome: claim.outcome,
      receivedDate: getValue(claim, 'supportingInfo[?(@.category.coding[0].code=="clmrecvddate")].timingDate'),
      servicePeriod: {
        start: claim.billablePeriod?.start,
        end: claim.billablePeriod?.end
      },
      extensions: {
        carrierNumber: getExtensionValue(extensions, 'https://bluebutton.cms.gov/resources/variables/carr_num')?.valueIdentifier?.value,
        claimControlNumber: getExtensionValue(extensions, 'https://bluebutton.cms.gov/resources/variables/carr_clm_cntl_num')?.valueIdentifier?.value,
        assignmentCode: getExtensionValue(extensions, 'https://bluebutton.cms.gov/resources/variables/asgmntcd')?.valueCoding?.display,
        claimEntryCode: getExtensionValue(extensions, 'https://bluebutton.cms.gov/resources/variables/carr_clm_entry_cd')?.valueCoding?.display
      }
    },
    patient: {
      id: getValue(claim, 'patient.reference'),
      medicareId: getValue(claim, 'patient.identifier.value')
    },
    providers: {
      allMembers: careTeam
    },
    insurance: {
      type: 'Medicare Part B',
      payer: {
        id: getValue(claim, 'insurer.identifier.value'),
        name: 'Medicare'
      },
      isAssigned: getExtensionValue(extensions, 'https://bluebutton.cms.gov/resources/variables/asgmntcd')?.valueCoding?.display === 'Assigned claim'
    },
    lineItems,
    diagnoses,
    testResults,
    meta: {
      lastUpdated: getValue(claim, 'meta.lastUpdated'),
      profile: getValue(claim, 'meta.profile.0')
    }
  };
}