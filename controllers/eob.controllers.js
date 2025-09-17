import { getEob } from "../services/bluebutton.services.js";
import { filteredEob } from "../utils/eob.utils.js";

import { exchangeRefreshToken } from "../services/auth.services.js";
import Consent from "../models/consent.model.js";

export const searchEob = async (req, res) => {
  console.log("get Eob called");
  try {
    const mongoPatientId = req.params.patientId;
    console.log("Mongo Patient ID:", mongoPatientId);

    if (!mongoPatientId) {
      console.log("Mongo Patient ID Error");
    }

    const consent = await Consent.findOne({ p_id: mongoPatientId });
    console.log(consent);
    const data = await exchangeRefreshToken(consent.refreshToken);
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;

    consent.refreshToken = newRefreshToken;
    await consent.save();

    const patient = await getEob(newAccessToken, consent.patientId);
    const Eob_data = filteredEob(patient);
    return res.json(Eob_data);
  } catch (err) {
    console.log(err);
    if (err.response && err.response.status === 404) {
      return res.status(404).json({ error: "Patient not found" });
    }
    res.status(500).json({ error: "Failed to fetch patient" });
  }
};

export const getEobForPatient = async (req, res) => {
  try {
    const mongoPatientId = req.params.patientId;
    console.log("Mongo Patient ID:", mongoPatientId);

    if (!mongoPatientId) {
      console.log("Mongo Patient ID Error");
    }

    const consent = await Consent.findOne({ p_id: mongoPatientId });
    console.log(consent);
    const data = await exchangeRefreshToken(consent.refreshToken);
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token;

    consent.refreshToken = newRefreshToken;
    await consent.save();

    const patient = await getEob(newAccessToken, consent.patientId);
    const Eob_data = filteredEob(patient);

    return res.json(Eob_data  );

    // return res.json(Eob_data);
  } catch (err) {
    console.log(err);
    if (err.response && err.response.status === 404) {
      return res.status(404).json({ error: "Patient not found" });
    }
    res.status(500).json({ error: "Failed to fetch patient" });
  }
};
