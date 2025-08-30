/**
 * Filters a FHIR Bundle to return only carrier ExplanationOfBenefit resources.
 * @param {object} bundle - The FHIR bundle from Blue Button 2.0 API
 * @returns {object} - A bundle containing only carrier ExplanationOfBenefit resources
 */
export function filterInpatientEOB(bundle) {
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
        coding.code === "INPATIENT"
    );
  });
  return {
    ...bundle,
    entry: filteredEntries,
    total: filteredEntries.length,
  };
}


/**
 * Transforms a Blue Button 2.0 Inpatient EOB (ExplanationOfBenefit) FHIR bundle
 * into a structured, logical format optimized for UI display and developer use.
 * 
 * Improvements:
 * - Robust error handling and FHIR null-safety
 * - Consistent, UI-ready data structure
 * - All key Blue Button extensions captured
 * - Flexible provider/org handling (not just contained.0)
 * - More complete financial fields and edge-case coverage
 */

export function transformInpatientEOB(rawFHIR) {
  // --- Validate input ---
  if (!rawFHIR?.entry?.[0]?.resource)
    throw new Error("Invalid FHIR bundle: Missing required entries");

  const claim = rawFHIR.entry[0].resource;
  if (claim.resourceType !== 'ExplanationOfBenefit')
    throw new Error(`Expected ExplanationOfBenefit resource, got ${claim.resourceType}`);

  // --- Helpers ---
  const getValue = (obj, path, fallback = null) => {
    if (!obj) return fallback;
    return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : fallback, obj);
  };

  const getExtension = (exts, url) =>
    Array.isArray(exts) ? exts.find(e => e.url === url) : null;

  // Value extractor covers all common FHIR extension types
  const getExtensionValue = (exts, url) => {
    const ext = getExtension(exts, url);
    return ext?.valueCoding?.display ?? ext?.valueCoding?.code ??
      ext?.valueIdentifier?.value ?? ext?.valueDate ?? ext?.valueQuantity?.value ??
      ext?.valueMoney?.value ?? ext?.valueString ?? ext?.valueBoolean ?? null;
  };

  // Flatten adjudications for UI or analytics
  const flattenAdjudications = (adjudications = []) => (
    adjudications.flatMap(adj => {
      const results = [];
      const amount = adj.amount?.value ?? null;
      const currency = adj.amount?.currency || 'USD';

      (adj.category?.coding || []).forEach(coding => {
        results.push({
          type: 'financial',
          category: coding.code,
          system: coding.system,
          label: coding.display || coding.code,
          amount,
          currency,
          raw: adj
        });
      });
      (adj.reason?.coding || []).forEach(coding => {
        results.push({
          type: 'denial',
          code: coding.code,
          system: coding.system,
          label: coding.display || 'Denial Reason',
          amount,
          currency,
          raw: adj
        });
      });
      return results.length ? results : [{
        type: 'unknown',
        label: 'Unknown adjudication',
        amount,
        currency,
        raw: adj
      }];
    })
  );

  // --- Diagnoses ---
  const diagnoses = (claim.diagnosis || []).map(d => ({
    sequence: d.sequence,
    code: getValue(d, 'diagnosisCodeableConcept.coding.0.code'),
    system: getValue(d, 'diagnosisCodeableConcept.coding.0.system'),
    description: getValue(d, 'diagnosisCodeableConcept.coding.0.display'),
    type: getValue(d, 'type.0.coding.0.display', 'Unknown'),
    typeCode: getValue(d, 'type.0.coding.0.code'),
    presentOnAdmission: getExtensionValue(d.extension, 'https://bluebutton.cms.gov/resources/variables/clm_poa_ind_sw2'),
    raw: d
  }));
  const diagnosisMap = Object.fromEntries(diagnoses.map(d => [d.sequence, d]));

  // --- Care Team ---
  const careTeam = (claim.careTeam || []).map(ct => ({
    sequence: ct.sequence,
    name: getValue(ct, 'provider.display', 'Unknown'),
    npi: getValue(ct, 'provider.identifier.value'),
    role: getValue(ct, 'role.coding.0.display'),
    roleCode: getValue(ct, 'role.coding.0.code'),
    specialty: getValue(ct, 'qualification.coding.0.display'),
    specialtyCode: getValue(ct, 'qualification.coding.0.code'),
    raw: ct
  }));
  const careTeamMap = Object.fromEntries(careTeam.map(ct => [ct.sequence, ct]));

  // --- Procedures ---
  const procedures = (claim.procedure || []).map(p => ({
    sequence: p.sequence,
    code: getValue(p, 'procedureCodeableConcept.coding.0.code'),
    system: getValue(p, 'procedureCodeableConcept.coding.0.system'),
    description: getValue(p, 'procedureCodeableConcept.coding.0.display'),
    date: p.date ? new Date(p.date).toISOString().split('T')[0] : null,
    raw: p
  }));

  // --- Supporting Info ---
  const supportingInfo = (claim.supportingInfo || []).map(info => {
    const category = getValue(info, 'category.coding.0.display') || getValue(info, 'category.coding.0.code');
    return {
      sequence: info.sequence,
      category,
      code: getValue(info, 'code.coding.0.display') || getValue(info, 'code.coding.0.code'),
      value: info.timingDate ??
        info.valueQuantity?.value ??
        info.valueString ??
        getValue(info, 'code.text'),
      unit: info.valueQuantity?.unit,
      raw: info
    };
  });

  // --- Line Items ---
  const lineItems = (claim.item || []).map(item => {
    const adjudications = item.adjudication || [];
    const financialBreakdown = flattenAdjudications(adjudications);

    // Full mapping of all common financial fields (from Blue Button adjudication categories)
    const findAdj = (keyword) =>
      adjudications.find(a => a.category?.coding?.some(c => (c.code || '').toLowerCase().includes(keyword))) ?? {};

    const submittedAmount = findAdj('submitted').amount?.value ?? 0;
    const allowedAmount = findAdj('eligible').amount?.value ?? 0;
    const paidToProvider = findAdj('paidtoprovider').amount?.value ?? 0;
    const paidToPatient = findAdj('paidtopatient').amount?.value ?? 0;
    const nonCoveredAmount = findAdj('noncovered').amount?.value ?? 0;
    const deductible = findAdj('deductible').amount?.value ?? 0;
    const coinsurance = findAdj('coinsurance').amount?.value ?? 0;

    return {
      lineNumber: item.sequence,
      serviceCode: getValue(item, 'productOrService.coding.0.code'),
      serviceDescription: getValue(item, 'productOrService.coding.0.display'),
      revenueCode: getValue(item, 'revenue.coding.0.code'),
      revenueDescription: getValue(item, 'revenue.coding.0.display'),
      location: getValue(item, 'locationAddress.state'),
      quantity: getValue(item, 'quantity.value'),
      unit: getValue(item, 'quantity.unit'),
      modifiers: (item.modifier || []).map(m => ({
        code: getValue(m, 'coding.0.code'),
        system: getValue(m, 'coding.0.system')
      })),
      diagnoses: (item.diagnosisSequence || []).map(seq => diagnosisMap[seq]).filter(Boolean),
      providers: (item.careTeamSequence || []).map(seq => careTeamMap[seq]).filter(Boolean),
      financials: {
        summary: {
          submittedAmount,
          allowedAmount,
          paidToProvider,
          paidToPatient,
          nonCoveredAmount,
          deductible,
          coinsurance,
          coveredAmount: submittedAmount - nonCoveredAmount
        },
        breakdown: financialBreakdown,
        rawAdjudications: adjudications
      },
      raw: item
    };
  });

  // --- Benefit Balances ---
  const benefitBalance = (claim.benefitBalance || []).map(balance => {
    const category = getValue(balance, 'category.coding.0.display') || getValue(balance, 'category.coding.0.code');
    const financials = (balance.financial || []).map(f => ({
      type: getValue(f, 'type.coding.0.display') || getValue(f, 'type.coding.0.code'),
      typeSystem: getValue(f, 'type.coding.0.system'),
      amount: f.usedMoney?.value ?? f.usedUnsignedInt ?? null,
      currency: f.usedMoney?.currency || 'USD',
      raw: f
    }));
    return {
      category,
      financials,
      raw: balance
    };
  });

  // --- Totals ---
  const totals = (claim.total || []).reduce((acc, total) => {
    const key = (getValue(total, 'category.coding.0.code', 'other') || 'other').toLowerCase();
    const label = getValue(total, 'category.coding.0.display', key);
    acc[key] = {
      label,
      amount: total.amount?.value,
      currency: total.amount?.currency || 'USD',
      raw: total
    };
    return acc;
  }, {});

  // --- Provider/Org Extraction (robust) ---
  // Prefer contained Organization with taxId/NPI, else fallback to first Organization
  const organizations = (claim.contained || []).filter(c => c.resourceType === 'Organization');
  const providerOrg = organizations.find(o =>
    o.identifier?.some(id => id.type?.coding?.some(c => c.code === 'PRN' || c.code === 'npi'))
  ) || organizations[0] || {};

  // --- Extensions (all major Blue Button inpatient codes) ---
  const extensions = {
    claimClass: {
      value: getExtensionValue(claim.extension, 'https://bluebutton.cms.gov/resources/variables/nch_near_line_rec_ident_cd'),
      description: 'Part A institutional claim record type'
    },
    actionCode: {
      value: getExtensionValue(claim.extension, 'https://bluebutton.cms.gov/resources/variables/fi_clm_actn_cd'),
      description: 'Claim action code'
    },
    nonPaymentReason: {
      value: getExtensionValue(claim.extension, 'https://bluebutton.cms.gov/resources/variables/clm_mdcr_non_pmt_rsn_cd'),
      description: 'Reason for Medicare non-payment'
    },
    imeAmount: {
      value: getExtensionValue(claim.extension, 'https://bluebutton.cms.gov/resources/variables/ime_op_clm_val_amt'),
      description: 'Indirect Medical Education amount'
    },
    dshAmount: {
      value: getExtensionValue(claim.extension, 'https://bluebutton.cms.gov/resources/variables/dsh_op_clm_val_amt'),
      description: 'Disproportionate Share Hospital amount'
    }
  };

  // --- Final Output ---
  return {
    metadata: {
      resourceType: claim.resourceType,
      lastUpdated: getValue(claim, 'meta.lastUpdated'),
      profiles: claim.meta?.profile || [],
      fhirVersion: 'R4'
    },
    claim: {
      id: claim.id,
      status: claim.status,
      type: getValue(claim, 'type.coding.0.display'),
      typeCode: getValue(claim, 'type.coding.0.code'),
      subtype: getValue(claim, 'subType.coding.0.display'),
      subtypeCode: getValue(claim, 'subType.coding.0.code'),
      use: claim.use,
      outcome: claim.outcome,
      created: claim.created,
      billablePeriod: {
        start: claim.billablePeriod?.start,
        end: claim.billablePeriod?.end,
        billingCode: getExtensionValue(claim.billablePeriod?.extension, 'https://bluebutton.cms.gov/resources/variables/claim_query_cd')
      },
      controlNumber: getExtensionValue(claim.extension, 'https://bluebutton.cms.gov/resources/variables/fi_doc_clm_cntl_num'),
      processingDate: getExtensionValue(claim.extension, 'https://bluebutton.cms.gov/resources/variables/fi_clm_proc_dt'),
      extensions,
      raw: claim
    },
    patient: {
      reference: getValue(claim, 'patient.reference'),
      memberId: getValue(claim, 'identifier.0.value')
    },
    provider: {
      organization: {
        name: providerOrg.name || null,
        npi: providerOrg.identifier?.find(id => id.type?.coding?.some(c => c.code === 'npi'))?.value || null,
        taxId: providerOrg.identifier?.find(id => id.type?.coding?.some(c => c.code === 'PRN'))?.value || null,
        raw: providerOrg
      },
      facilityType: getExtensionValue(claim.facility?.extension, 'https://bluebutton.cms.gov/resources/variables/clm_fac_type_cd')
    },
    insurance: {
      payer: getValue(claim, 'insurer.identifier.value') || 'CMS',
      coverage: getValue(claim, 'insurance.0.coverage.reference'),
      primaryPayerCode: supportingInfo.find(i => i.category === 'NCH Primary Payer Code (if not Medicare)')?.value
    },
    clinical: {
      diagnoses,
      procedures,
      dischargeStatus: supportingInfo.find(i => i.category === 'Discharge Status')?.code,
      drgCode: supportingInfo.find(i => i.category === 'Claim Diagnosis Related Group Code (or MS-DRG Code)')?.code,
      bloodPints: supportingInfo.find(i => i.category === 'NCH Blood Pints Furnished Quantity')?.value
    },
    financial: {
      totals,
      payment: {
        amount: claim.payment?.amount?.value,
        currency: claim.payment?.amount?.currency || 'USD',
        date: claim.payment?.date || claim.created
      },
      benefitBalances: benefitBalance,
      lineItems
    },
    careTeam,
    supportingInformation: supportingInfo
  };
}