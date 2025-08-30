import { filterCarrierEOB,transformCarrierEOB } from './carrier.utils.js';
import { filterInpatientEOB, transformInpatientEOB } from './inpatient.utils.js';
import { filterOutpatientEOB, transformOutpatientEOB } from './outpatient.utils.js';

/**
 * Splits a Blue Button 2.0 EOB bundle into carrier, inpatient, and outpatient sections,
 * transforms each section using the appropriate util, and returns a sorted JSON object.
 * @param {object} eobBundle - The full FHIR EOB bundle from Blue Button 2.0 API
 * @returns {object} { carrier: [...], inpatient: [...], outpatient: [...] }
 */
export function splitAndTransformEOB(eobBundle) {
  if (!eobBundle || !Array.isArray(eobBundle.entry)) {
    throw new Error('Invalid EOB bundle');
  }

  // Filter each section
  const carrierBundle = filterCarrierEOB(eobBundle);
  const inpatientBundle = filterInpatientEOB(eobBundle);
  const outpatientBundle = filterOutpatientEOB(eobBundle);

  // Transform each section (all claims, not just first entry)
  const carrier = (carrierBundle.entry || [])
    .map(e => {
      try {
        return transformCarrierEOB({ entry: [e] });
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.claimInfo?.servicePeriod?.start || '').localeCompare(b.claimInfo?.servicePeriod?.start || ''));

  const inpatient = (inpatientBundle.entry || [])
    .map(e => {
      try {
        return transformInpatientEOB({ entry: [e] });
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.claim?.billablePeriod?.start || '').localeCompare(b.claim?.billablePeriod?.start || ''));

  const outpatient = (outpatientBundle.entry || [])
    .map(e => {
      try {
        return transformOutpatientEOB({ entry: [e] });
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.claimInfo?.servicePeriod?.start || '').localeCompare(b.claimInfo?.servicePeriod?.start || ''));

  return {
    carrier,
    inpatient,
    outpatient
  };
}