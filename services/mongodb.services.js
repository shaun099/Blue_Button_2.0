// services/patientService.js
import Patient from "../models/patients.model.js";
import Consent from "../models/consent.model.js";
import mongoose from "mongoose";

// services/patientService.js

export async function addPatientToDatabase(patientData) {
  const newPatient = new Patient(patientData);
  return await newPatient.save();
}

export async function fetchPatientsFromDB(clinicId) {
  // Step 1: Get all consent records for this clinic
  const consents = await Consent.find({ clinicId });

  // Step 2: Extract the list of patient IDs (stored as p_id in Consent)
  const consentedPatientIds = consents.map((c) => new mongoose.Types.ObjectId(c.p_id));

  // Step 3: Return only patients whose _id is in that list
  const patients = await Patient.find({
    _id: { $in: consentedPatientIds },
    clinicId,
  });

  return patients;
}
