import { getPatient } from "../services/bluebutton.services.js";
import { PatientField } from "../utils/fields.utils.js";
import Consent from "../models/consent.model.js";
import {
  addPatientToDatabase,
  fetchPatientsFromDB,
} from "../services/mongodb.services.js";
import { getPatientById } from "../services/bluebutton.services.js";
import { exchangeRefreshToken } from "../services/auth.services.js";

export const searchPatients = async (req, res) => {
  console.log("search patient func");
  try {
    console.log("Params:", req.params);
    console.log("ID:", req.params.id);

    const mongoPatientId = req.params.id;
    // If no ID is provided, return all patients (existing behavior)
    if (!mongoPatientId) {
      const patients = await getPatient(req.session.bbAccessToken);
      const response = PatientField(patients);
      return res.json(response);
    }

    // If ID is provided, fetch specific patient

    const consent = await Consent.findOne({ p_id: mongoPatientId });
    console.log(consent);

    const data = await exchangeRefreshToken(consent.refreshToken);
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;

    consent.refreshToken = newRefreshToken;
    await consent.save();

    const patient = await getPatientById(newAccessToken, consent.patientId);
    const Patient_data = PatientField(patient);
    // console.log(patient)
    return res.json(Patient_data);
  } catch (err) {
    console.log(err);
    if (err.response && err.response.status === 404) {
      return res.status(404).json({ error: "Patient not found" });
    }
    res.status(500).json({ error: "Failed to fetch patient" });
  }
};

export const addPatients = async (req, res) => {
  try {
    console.log("-------------------------------------\n", req.body);
    const newPatient = await addPatientToDatabase(req.body);
    res.status(201).json(newPatient);
  } catch (error) {
    console.error("Error in addPatient controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const fetchPatients = async (req, res) => {
  try {
    const { clinicId } = req.params;
    if (!clinicId) {
      return res.status(400).json({ error: "Missing clinicId in params" });
    }

    const patients = await fetchPatientsFromDB(clinicId);

    res.status(200).json(patients);
  } catch (err) {
    console.error("Error fetching patients:", err);
    res.status(500).json({ error: "Failed to fetch patients" });
  }
};
