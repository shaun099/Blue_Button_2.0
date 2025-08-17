// Define your transformation functions outside, and make them accept a single EOB resource
// Use optional chaining and nullish coalescing for safer data access.
import fhirpath from "fhirpath";
import fhirpath_r4_model from "fhirpath/fhir-context/r4/index.js";

function transformCarrier(eobResource) {
  // console.log("Transforming CARRIER EOB:", eobResource.id); // For debugging
  if (!eobResource) {
    console.warn("No EOB resource provided to transformCarrier");
    return null; // Or throw an error, or return a default structure
  }

  // contained array
  const con_array =
    eobResource.contained?.map((item) => ({
      id: item.id,
      status: item.status,
      code:
        item.code?.coding?.map((items) => ({
          display: items.display,
          code: items.code,
        })) || [],
      value: item.valueQuantity?.value, // Use optional chaining for valueQuantity
    })) || [];

  // identifier data
  const iden_array =
    eobResource.identifier?.map((item) => ({
      type:
        item.type?.coding?.map((items) => ({
          display: items.display,
          code: items.code,
        })) || [],
      value: item.value,
    })) || [];

  // status&use
  const status = eobResource.status;
  const use = eobResource.use;

  // patient&billable period & created
  const patient_ref = eobResource.patient?.reference;
  const billablePeriod = eobResource.billablePeriod;
  const created = eobResource.created;
  const insurer = eobResource.insurer?.identifier?.value; // Safer access

  // referral
  const referralCoding = eobResource.referral?.identifier?.type?.coding?.[0];
  const referralVal = eobResource.referral?.identifier?.value;
  const referral = referralCoding
    ? {
        display: referralCoding.display,
        code: referralCoding.code,
        value: referralVal,
      }
    : null; // Handle missing referral data

  const outcome = eobResource.outcome;

  // careteam
  const care_team =
    eobResource.careTeam?.map((item) => ({
      type:
        item.provider?.identifier?.type?.coding?.map((items) => ({
          display: items.display,
          code: items.code,
        })) || [],
      role:
        item.role?.coding?.map((items) => ({
          display: items.display,
          code: items.code,
        })) || [],
      value: item.provider?.identifier?.value,
    })) || [];

  // diagnosis data of patients
  const diagnosis_data =
    eobResource.diagnosis?.map((item) => ({
      id: item.sequence,
      diagnosisType:
        item.type?.[0]?.coding?.map((items) => ({
          display: items.display,
          code: items.code,
        })) || [],
      diagnosis:
        item.diagnosisCodeableConcept?.coding?.map((items) => ({
          display: items.display,
          code: items.code,
        })) || [],
    })) || [];

  const insurance = eobResource.insurance;

  const category =
    eobResource.item?.[0]?.category?.coding?.map((item) => ({
      display: item.display,
      code: item.code,
    })) || [];

  const servicePeriod = eobResource.item?.[0].servicePeriod;

  const location =
    eobResource.item?.[0]?.locationCodeableConcept?.coding?.map((item) => ({
      display: item.display,
      code: item.code,
    })) || [];

  const ad_cat =
    eobResource.item?.[0]?.adjudication?.[0]?.category?.coding?.[0]?.display;
  const ad_reason =
    eobResource.item?.[0]?.adjudication?.[0]?.reason?.coding?.[0]?.display;

  const adjudication = {
    category: ad_cat || "NA", // Default for missing data
    reason: ad_reason || "NA",
  };

  return {
    id: eobResource.id, // Include the EOB's ID
    con_array,
    iden_array,
    status,
    use,
    patient_ref,
    billablePeriod,
    created,
    care_team,
    servicePeriod,
    location,
    adjudication,
    category,
    insurance,
    diagnosis_data,
    outcome,
    referral,
    insurer,
  };
}

function transformInPatient(eobResource) {
  // console.log("Transforming INPATIENT EOB:", eobResource.id); // For debugging
  if (!eobResource) {
    console.warn("No EOB resource provided to transformInPatient");
    return null;
  }

  const cont_data =
    eobResource.contained?.map((item) => ({
      status: item.active,
      id: item.id,
      resourcetype: item.resourceType,
      name: item.name,
      // If identifier can be an array, consider mapping over it as well
      identifier: item.identifier, // Assuming item.identifier is already an array of desired format
    })) || [];

  const iden_data =
    eobResource.identifier?.map((item) => ({
      display: item.type?.coding?.[0]?.display,
      code: item.type?.coding?.[0]?.code,
      value: item.value,
    })) || [];

  const status = eobResource.status;

  const subTypeCoding = eobResource.subType?.coding?.[0];
  const sub_code = subTypeCoding?.code;
  const sub_Display = subTypeCoding?.display || "NA";
  const sub = eobResource.subType?.text;

  const subType = {
    subcode: sub_code,
    subDisplay: sub_Display,
    subject: sub,
  };

  const use = eobResource.use;
  const patientid = eobResource.patient?.reference;

  const bill_start = eobResource.billablePeriod?.start;
  const bill_end = eobResource.billablePeriod?.end;
  const billablePeriod = {
    start: bill_start,
    end: bill_end,
  };

  const created = eobResource.created;

  const insurer = eobResource.insurer?.identifier?.value;

  const outcome = eobResource.outcome;

  // careTeam
  const careTeam =
    eobResource.careTeam?.map((item) => ({
      id: item.sequence,
      provider_display:
        item.provider?.identifier?.type?.coding?.[0]?.display || "NA",
      provider_code: item.provider?.identifier?.type?.coding?.[0]?.code || "NA",
      provider_val: item.provider?.identifier?.value,
      name: item.provider?.display || "NA",
      role_display: item.role?.coding?.[0]?.display || "NA",
      role_code: item.role?.coding?.[0]?.code || "NA",
      qualification: item.qualification?.coding?.[0]?.display || "NA",
      qualification_code: item.qualification?.coding?.[0]?.code || "NA",
    })) || [];

  // diagnosis
  const diagnosis =
    eobResource.diagnosis?.map((item) => ({
      id: item.sequence,
      patient_diagnosis: item.diagnosisCodeableConcept?.coding?.[0]?.display,
      patient_diagnosis_code: item.diagnosisCodeableConcept?.coding?.[0]?.code,
      type: item.type?.[0]?.coding?.[0]?.display,
      type_code: item.type?.[0]?.coding?.[0]?.code,
    })) || [];

  // procedure
  const procedure =
    eobResource.procedure?.map((item) => ({
      id: item.sequence,
      date: item.date,
      procedures: item.procedureCodeableConcept?.coding || [], // Ensure procedures is an array
    })) || [];

  const insurance = eobResource.insurance;

  return {
    id: eobResource.id, // Include the EOB's ID
    cont_data,
    iden_data,
    status,
    subType,
    use,
    patientid,
    billablePeriod,
    created,
    insurance,
    insurer,
    outcome,
    careTeam,
    diagnosis,
    procedure,
  };
}

function transformOutPatient(eobResource) {
  console.log(eobResource);
  // console.log("Transforming OUTPATIENT EOB:", eobResource.id); // For debugging
  if (!eobResource) {
    console.warn("No EOB resource provided to transformOutPatient");
    return null;
  }

  const id = eobResource.id;

  const lastUpdated = eobResource.meta?.lastUpdated;
  const con_data = eobResource.contained;

  const cont_array =
    con_data?.map((item) => ({
      resourceType: item.resourceType,
      id: item.id,
      identifier:
        item.identifier?.map((items) => ({
          type: items.type,
          val: items.value,
        })) || [],
      isActive: item.active,
      name: item.name,
    })) || [];

  const iden_data = eobResource.identifier;

  const iden_array =
    iden_data?.map((item) => ({
      type:
        item.type?.coding?.map((items) => ({
          display: items.display,
          code: items.code,
        })) || [],
      value: item.value,
    })) || [];

  const status = eobResource.status;

  const bill_start = eobResource.billablePeriod?.start;
  const bill_end = eobResource.billablePeriod?.end;

  const billablePeriod = {
    start: bill_start,
    end: bill_end,
  };

  const created = eobResource.created;

  const careTeam =
    eobResource.careTeam?.map((item) => ({
      id: item.sequence,
      doc_name: item.provider?.display || "NA",
      provider: item.provider?.identifier?.type?.coding?.[0]?.display || "NA",
      provider_code: item.provider?.identifier?.type?.coding?.[0]?.code || "NA",
      provider_val: item.provider?.identifier?.value,
      role: item.role?.coding?.[0]?.display || "NA",
      qualification: item.qualification?.coding?.[0]?.display || "NA",
    })) || [];

  const diagnosis =
    eobResource.diagnosis?.map((item) => ({
      id: item.sequence,
      diagnosis:
        item.diagnosisCodeableConcept?.coding?.map((items) => ({
          display: items.display,
          code: items.code,
        })) || [],
      type: item.type?.[0]?.coding?.[0]?.display || "NA",
    })) || [];

  const procedure =
    eobResource.procedure?.map((item) => ({
      id: item.id, // Check if 'id' is sequence or actual ID here
      procedure: item.procedureCodeableConcept?.coding || [],
      date: item.date,
    })) || [];

  const item =
    eobResource.item?.map((item) => ({
      careTeam: item.careTeamSequence,
      serviceDate: item.serviceDate,
      state: item.locationAddress?.state,
    })) || [];

  return {
    id,
    lastUpdated,
    cont_array,
    iden_array,
    status,
    billablePeriod,
    created,
    careTeam,
    diagnosis,
    procedure,
    item,
  };
}

// function transformPde(eobResource) {
//   if (!eobResource) {
//     return null;
//   }
//   const id = eobResource.id;
//   console.log(eobResource);

//   const lastUpdated = eobResource.meta?.lastUpdated;

//   const status = eobResource.status;

//   const start = eobResource.billablePeriod?.start;
//   const end = eobResource.billablePeriod?.end;
//   const billablePeriod = start && end ? `${start} to ${end}` : null;
//   const created = eobResource.created;
//   const facility_name = eobResource.facility?.display;
//   const facility_iden = eobResource.facility?.identifier;
//   const facility = facility_name
//     ? `${facility_name} (${facility_iden?.value})`
//     : null;

//   const outcome = eobResource.outcome;
//   const careTeam = eobResource.careTeam?.map((team) => ({
//     id: team.sequence,
//     provider: team.provider?.display,
//     role: team.role?.coding?.[0]?.display,
//     qualification: team.qualification?.coding?.[0]?.display,
//     identifier: team.provider?.identifier?.value,
//   }));

//   const infoArray = eobResource.supportingInfo?.map((item) => ({
//     id: item.sequence,
//     category: item.category?.coding?.[0]?.display || "NA", // or `.code`, `.system`, etc.
//     code: item.code?.coding?.[0]?.display || "NA",
//   }));

//   const item = eobResource.item?.map((item) => ({
//     id: item.sequence,

//     productOrService: item.productOrService?.coding?.[0]?.display,
//     product_code: item.productOrService?.coding?.[0]?.code,
//     quantity: item.quantity?.value,
//     servicedDate: item.servicedDate,
//     careTeamSequence: item.careTeamSequence,
//   }));

//   return {
//     id,
//     lastUpdated,
//     status,
//     created,
//     billablePeriod,
//     facility,
//     outcome,
//     careTeam,
//     infoArray,
//     item,
//   };
// }

function evaluateField(resource, path) {
  return fhirpath.evaluate(resource, path, {}, fhirpath_r4_model);
}

function transformPde(eobResource) {
  if (!eobResource) {
    return null;
  }

  const id = evaluateField(eobResource, "ExplanationOfBenefit.id")?.[0];
  const lastUpdated = evaluateField(
    eobResource,
    "ExplanationOfBenefit.meta.lastUpdated"
  )?.[0];
  const status = evaluateField(eobResource, "ExplanationOfBenefit.status")?.[0];
  const created = evaluateField(
    eobResource,
    "ExplanationOfBenefit.created"
  )?.[0];
  const outcome = evaluateField(
    eobResource,
    "ExplanationOfBenefit.outcome"
  )?.[0];
  const start = evaluateField(
    eobResource,
    "ExplanationOfBenefit.billablePeriod.start"
  )?.[0];
  const end = evaluateField(
    eobResource,
    "ExplanationOfBenefit.billablePeriod.end"
  )?.[0];

  const facility_name = evaluateField(
    eobResource,
    "ExplanationOfBenefit.facility.display"
  )?.[0];
  const facility_iden_value = evaluateField(
    eobResource,
    "ExplanationOfBenefit.facility.identifier.value"
  )?.[0];
  const billablePeriod = start && end ? `${start} to ${end}` : null;

  const facility = facility_name
    ? `${facility_name} (${facility_iden_value || ""})`.trim()
    : null;

  const careTeamList =
    evaluateField(eobResource, "ExplanationOfBenefit.careTeam") || [];
  const supportingInfoList =
    evaluateField(eobResource, "ExplanationOfBenefit.supportingInfo") || [];
  const itemList =
    evaluateField(eobResource, "ExplanationOfBenefit.item") || [];

  const careTeam = careTeamList.map((team) => ({
    id: team.sequence,
    provider: team.provider?.display,
    role: team.role?.coding?.[0]?.display,
    qualification: team.qualification?.coding?.[0]?.display,
    identifier: team.provider?.identifier?.value,
  }));

  const infoArray = supportingInfoList.map((item) => ({
    id: item.sequence,
    category: item.category?.coding?.[0]?.display || "NA",
    code: item.code?.coding?.[0]?.display || "NA",
  }));

  const item = itemList.map((item) => ({
    id: item.sequence,
    productOrService: item.productOrService?.coding?.[0]?.display,
    product_code: item.productOrService?.coding?.[0]?.code,
    quantity: item.quantity?.value,
    servicedDate: item.servicedDate,
    careTeamSequence: item.careTeamSequence,
  }));

  return {
    id,
    lastUpdated,
    status,
    created,
    billablePeriod,
    facility,
    outcome,
    careTeam,
    infoArray,
    item,
  };
}

export function filteredEob(bundle) {
  if (!bundle || !Array.isArray(bundle.entry)) {
    console.warn("Invalid bundle format: 'entry' is not an array");
    return { ...bundle, entry: [] };
  }

  const categorizedAndTransformed = {
    CARRIER: [],
    INPATIENT: [],
    OUTPATIENT: [],
    PDE: [],
    OTHER: [], // For EOBs that don't match the specified types
  };

  bundle.entry.forEach((e) => {
    const res = e.resource;
    if (!res || res.resourceType !== "ExplanationOfBenefit") {
      // Skip if it's not an EOB
      return;
    }
    if (!res.type || !res.type.coding) {
      // If type coding is missing, put it in 'OTHER'
      console.log("EOB type coding missing, categorizing as OTHER:", res.id);
      categorizedAndTransformed.OTHER.push(res);
      return;
    }

    let eobType = "OTHER"; // Default to OTHER if no matching type found
    const hasMatchingType = res.type.coding.some((coding) => {
      if (
        coding.system ===
        "https://bluebutton.cms.gov/resources/codesystem/eob-type"
      ) {
        switch (coding.code) {
          case "CARRIER": {
            const transformed = transformCarrier(res);
            if (transformed)
              categorizedAndTransformed.CARRIER.push(transformed);
            eobType = "CARRIER";
            return true;
          }
          case "INPATIENT": {
            const transformed = transformInPatient(res);
            if (transformed)
              categorizedAndTransformed.INPATIENT.push(transformed);
            eobType = "INPATIENT";
            return true;
          }
          case "OUTPATIENT": {
            const transformed = transformOutPatient(res);
            if (transformed)
              categorizedAndTransformed.OUTPATIENT.push(transformed);
            eobType = "OUTPATIENT";
            return true;
          }
          case "PDE": {
            const transformed = transformPde(res);
            if (transformed) categorizedAndTransformed.PDE.push(transformed);
            eobType = "PDE";
            return true;
          }
          default:
            return false;
        }
      }
      return false;
    });

    // If no specific type was matched, add to OTHER
    if (!hasMatchingType && eobType === "OTHER") {
      categorizedAndTransformed.OTHER.push(res);
    }
  });

  // Filter out empty arrays for a cleaner output
  const finalOutput = {};
  for (const type in categorizedAndTransformed) {
    if (categorizedAndTransformed[type].length > 0) {
      finalOutput[type] = categorizedAndTransformed[type];
    }
  }

  return finalOutput;
}
