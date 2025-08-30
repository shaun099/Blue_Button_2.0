/**
 * Filters a FHIR Bundle to return only carrier ExplanationOfBenefit resources.
 * @param {object} bundle - The FHIR bundle from Blue Button 2.0 API
 * @returns {object} - A bundle containing only carrier ExplanationOfBenefit resources
 */
export function filterOutpatientEOB(bundle) {
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
        coding.code === "OUTPATIENT"
    );
  });
  return {
    ...bundle,
    entry: filteredEntries,
    total: filteredEntries.length,
  };
}

/**
 * Transforms a Blue Button 2.0 Outpatient EOB FHIR bundle into structured, UI- and dev-friendly JSON
 * Includes detailed adjudications, denial reasons, CMS extensions, provider metadata
 */
export function transformOutpatientEOB(rawFHIR) {
  if (!rawFHIR || typeof rawFHIR !== 'object') throw new Error("Invalid FHIR data provided");

  const claim = rawFHIR?.entry?.[0]?.resource;
  if (!claim || claim.resourceType !== "ExplanationOfBenefit") {
    throw new Error("Invalid or missing ExplanationOfBenefit in FHIR bundle.");
  }

  // ─── Helpers ───────────────────────────────────────────

  const getValue = (obj, path, fallback = null) =>
    path.split('.').reduce((acc, key) => acc && acc[key] !== undefined ? acc[key] : fallback, obj);

  const getExtension = (exts, url) => Array.isArray(exts) ? exts.find(e => e.url === url) : null;

  const getExtensionValue = (exts, url) => {
    const ext = getExtension(exts, url);
    return ext?.valueCoding?.display ?? ext?.valueCoding?.code ??
           ext?.valueIdentifier?.value ?? ext?.valueDate ?? ext?.valueQuantity?.value ?? null;
  };

  const findAmount = (adjs = [], keyword) => {
    const adj = adjs.find(a =>
      a.category?.coding?.some(c =>
        c.code?.toLowerCase().includes(keyword.toLowerCase()) ||
        c.display?.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    return adj?.amount?.value ?? 0;
  };

  const flattenAdjudication = (adjs = []) => {
    const results = [];

    adjs.forEach(adj => {
      const amount = adj.amount?.value;
      const currency = adj.amount?.currency || 'USD';

      (adj.category?.coding || []).forEach(c => {
        results.push({
          type: 'financial',
          code: c.code,
          system: c.system,
          label: c.display || c.code,
          amount,
          currency
        });
      });

      (adj.reason?.coding || []).forEach(r => {
        results.push({
          type: 'denialreason',
          code: r.code,
          system: r.system,
          label: 'Denial Reason'
        });
      });
    });

    return results;
  };

  // ─── Providers ─────────────────────────────────────────

  const getProviderByRef = (ref) => {
    const id = ref?.replace('#', '');
    return (claim.contained || []).find(
      o => o.id === id && ["Organization", "Practitioner", "PractitionerRole"].includes(o.resourceType)
    );
  };

  const extractProviderInfo = (provider) => {
    if (!provider) return null;
    return {
      name: provider.name || provider.display || 'Unknown',
      npi: provider.identifier?.find(id =>
        id.system?.includes('us-npi') || id.type?.coding?.some(c => c.code === 'npi')
      )?.value,
      taxId: provider.identifier?.find(id =>
        id.type?.coding?.some(c => c.code === 'PRN')
      )?.value,
      type: provider.resourceType,
      active: provider.active
    };
  };

  // ─── Diagnoses, Procedures, Care Team ──────────────────

  const diagnoses = (claim.diagnosis || []).map(d => ({
    sequence: d.sequence,
    code: getValue(d, 'diagnosisCodeableConcept.coding.0.code', 'Unknown'),
    description: getValue(d, 'diagnosisCodeableConcept.coding.0.display', 'Not provided'),
    type: getValue(d, 'type.0.coding.0.display', 'Unknown')
  }));
  const diagnosisMap = Object.fromEntries(diagnoses.map(d => [d.sequence, d]));

  const careTeam = (claim.careTeam || []).map(ct => ({
    sequence: ct.sequence,
    name: getValue(ct, 'provider.display', 'Unknown'),
    npi: getValue(ct, 'provider.identifier.value'),
    role: getValue(ct, 'role.coding.0.display'),
    specialty: getValue(ct, 'qualification.coding.0.display')
  }));
  const careTeamMap = Object.fromEntries(careTeam.map(p => [p.sequence, p]));

  const procedures = (claim.procedure || []).map(p => ({
    sequence: p.sequence,
    code: getValue(p, 'procedureCodeableConcept.coding.0.code'),
    description: getValue(p, 'procedureCodeableConcept.coding.0.display'),
    date: p.date
  }));

  // ─── Line Items ─────────────────────────────────────────

  const lineItems = (claim.item || []).map(item => {
    const adjs = item.adjudication || [];
    const breakdown = flattenAdjudication(adjs);

    return {
      lineNumber: item.sequence,
      serviceDate: item.servicedDate || item.servicedPeriod?.start,
      serviceCode: getValue(item, 'productOrService.coding.0.code'),
      serviceDescription: getValue(item, 'productOrService.coding.0.display'),
      ndcCode: getExtensionValue(item.extension, 'http://hl7.org/fhir/sid/ndc'),
      quantity: getValue(item, 'quantity.value'),
      revenueCenter: getValue(item, 'revenue.coding.0.code'),
      unitCount: getExtensionValue(item.extension, 'https://bluebutton.cms.gov/resources/variables/rev_cntr_unit_cnt'),
      revenueCenterStatus: getExtensionValue(item.extension, 'https://bluebutton.cms.gov/resources/variables/rev_cntr_stus_ind_cd'),

      diagnoses: (item.diagnosisSequence || []).map(seq => diagnosisMap[seq]).filter(Boolean),
      providers: (item.careTeamSequence || []).map(seq => careTeamMap[seq]).filter(Boolean),

      financials: {
        summary: {
          submitted: findAmount(adjs, 'submitted'),
          allowed: findAmount(adjs, 'eligible'),
          paidToProvider: findAmount(adjs, 'paidtoprovider'),
          coinsurance: findAmount(adjs, 'coinsurance'),
          deductible: findAmount(adjs, 'deductible')
        },
        breakdown
      },

      denialReasons: breakdown
        .filter(e => e.type === 'denialreason')
        .map(e => ({ code: e.code, label: e.label, system: e.system }))
    };
  });

  // ─── Financial Summary ─────────────────────────────────

  const totals = {};
  (claim.total || []).forEach(t => {
    const cat = t.category?.coding?.[0];
    const key = (cat?.code || 'unknown').toLowerCase();
    if (t.amount?.value !== undefined) {
      totals[key] = {
        amount: t.amount.value,
        label: cat?.display || key,
        currency: t.amount.currency || 'USD'
      };
    }
  });

  const payment = {
    amount: claim.payment?.amount?.value || 0,
    date: claim.created,
    method: claim.payment?.type?.coding?.[0]?.display || 'Unknown'
  };

  const benefitBalance = (claim.benefitBalance || []).map(b => ({
    category: getValue(b, 'category.coding.0.display', 'Unknown'),
    financials: (b.financial || []).map(f => ({
      type: getValue(f, 'type.coding.0.display', 'Unknown'),
      amount: f.usedMoney?.value,
      currency: f.usedMoney?.currency || 'USD'
    }))
  }));

  // ─── Final Output ──────────────────────────────────────

  return {
    claimInfo: {
      id: claim.id,
      type: getValue(claim, 'type.coding.0.display', 'Outpatient Claim'),
      status: claim.status,
      outcome: claim.outcome,
      servicePeriod: {
        start: claim.billablePeriod?.start,
        end: claim.billablePeriod?.end
      },
      receivedDate: getValue(claim, 'supportingInfo.0.timingDate'),
      controlNumber: getExtensionValue(claim.extension, 'https://bluebutton.cms.gov/resources/variables/fi_doc_clm_cntl_num')
    },
    patient: {
      reference: getValue(claim, 'patient.reference')
    },
    providers: {
      billingProvider: extractProviderInfo(getProviderByRef(getValue(claim, 'provider.reference'))),
      careTeam
    },
    insurance: {
      payer: getValue(claim, 'insurer.identifier.value', 'CMS'),
      coverage: getValue(claim, 'insurance.0.coverage.reference')
    },
    diagnoses,
    procedures,
    lineItems,
    financials: {
      totals,
      payment,
      benefitBalance
    },
    meta: {
      lastUpdated: getValue(claim, 'meta.lastUpdated'),
      profile: getValue(claim, 'meta.profile.0'),
      fhirVersion: 'R4'
    }
  };
}