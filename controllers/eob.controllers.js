import { getEob } from "../services/bluebutton.services.js";
import { filteredEob } from "../utils/eob.utils.js";
import axios from "axios";
import { exchangeRefreshToken } from "../services/auth.services.js";
import Consent from "../models/consent.model.js";
import { decrypt } from "../utils/crypto.js";

export const searchEob = async (req, res) => {
  console.log("get Eob called");
  if (!req.session.bbAccessToken) {
    console.log("No access token found in session:", req.session);
    //return res.redirect("http://localhost:5500/api/auth/login/");

    return res
      .status(401)
      .json({ redirect: true, url: "http://localhost:5500/api/auth/login" });
  }
  try {
    const { type } = req.query; // type=carrier,snf
    const types = type ? type.split(",") : null;

    const PatientEob = await getEob(req.session.bbAccessToken, types);
    return res.json(filteredEob(PatientEob));
  } catch (err) {
    console.log(err);
  }
};

export const getEobForPatient = async (req, res) => {
  try {
    // 1. Get the Clinic ID from the authenticated doctor's token.
    const clinicId = req.auth.orgId;

    // 2. Get the specific patient's ID from the URL parameter.
    const { patientId } = req.params;

    if (!clinicId || !patientId) {
      return res
        .status(400)
        .json({ message: "Clinic ID and Patient ID are required." });
    }

    // 3. **CHECK FOR CONSENT**: Query your database for a consent record that
    //    links this specific patient to this specific clinic.
    const consent = await Consent.findOne({ patientId, clinicId });

    // 4. If no record is found, it means consent does not exist.
    //    Return a 404 Not Found error. The frontend will use this specific status
    //    code to know it should display the "Connect to Medicare" button.
    if (!consent) {
      return res
        .status(404)
        .json({
          message: "Consent not found for this patient at this clinic.",
        });
    }

    // 5. If consent exists, get a fresh access token.
    //    - Decrypt the stored refresh token.
    //    - Call your service to exchange it for a new, temporary access token.
    const decryptedRefreshToken = decrypt(consent.refreshToken);
    const newAccessToken = await exchangeRefreshToken(decryptedRefreshToken);

    // 6. Use the new access token to fetch the EOB data from the Blue Button API.
    const eobApiResponse = await axios.get(
      // Note: This URL fetches all EOB types for the patient.
      `https://sandbox.bluebutton.cms.gov/v2/ExplanationOfBenefit?patient=${patientId}`,
      {
        headers: {
          Authorization: `Bearer ${newAccessToken}`,
        },
      }
    );

    // 7. Transform the raw, complex FHIR data into a clean, simple format
    //    that your frontend can easily display.
    const cleanedData = filteredEob(eobApiResponse.data);

    // 8. Send the cleaned data back to the frontend.
    res.status(200).json(cleanedData);
  } catch (error) {
    console.error(
      "Error fetching EOB data:",
      error.response ? error.response.data : error.message
    );
    res
      .status(500)
      .json({
        message:
          "An internal server error occurred while fetching patient data.",
      });
  }
};
