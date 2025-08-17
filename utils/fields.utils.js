export const PatientField = (patient) => {
  const nameObj = patient.name?.[0] || {};
  const firstname = nameObj.given?.[0] || "N/A";
  const middlename = nameObj.given?.[1] || "N/A";
  const lastname = nameObj.family || "N/A";

  const birthDate = patient.birthDate || "N/A";
  const gender = patient.gender || "N/A";

  const addressObj = patient.address?.[0] || {};
  const postalCode = addressObj.postalCode || "N/A";
  const state = addressObj.state || "N/A";

  const race = patient.extension?.find(
    ext => ext.url === 'https://bluebutton.cms.gov/resources/variables/race'
  )?.valueCoding?.display || "N/A";

  // Determine deceased status and date
  const isDeceased = patient.deceasedDateTime ? "Yes" : "No";
  const deceasedDate = patient.deceasedDateTime || "N/A";

  return {
    firstname,
    middlename,
    lastname,
    birthDate,
    gender,
    postalCode,
    state,
    race,
    deceased: isDeceased,
    deceasedDate,
    id: patient.id || "N/A",
  };
};