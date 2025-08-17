// auth.controllers.js
import { exchangeCodeForToken } from "../services/auth.services.js";
import { getAuthUrl } from "../services/auth.services.js";
import crypto from "crypto";
import Consent from "../models/consent.model.js";
import { addPatientToDatabase } from "../services/mongodb.services.js";

// Step 1: Auth Initiation
export const initiateAuth = (req, res) => {
  try {
    const clinicId = req.auth?.orgId;

    if (!clinicId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Clinic ID not found in user token." });
    }

    const nonce = crypto.randomUUID();
    req.session.bb_oauth_nonce = nonce;
    const state = `clinicId=${clinicId}&nonce=${nonce}`;
    const authorizationUrl = getAuthUrl(state);
    const { internalPatientId } = req.body;
    req.session.patientId = internalPatientId;

    console.log("=========initiate========");
    console.log("nonce sended:", req.session.bb_oauth_nonce);

    return res.status(200).json({ authorizationUrl });
  } catch (error) {
    console.error("Error during auth initiation:", error);
    return res
      .status(500)
      .json({ message: "Failed to initiate authorization flow." });
  }
};

// Step 2: Callback Handler
export const handleCallback = async (req, res) => {
  const { code, state } = req.query;

  // Prevent multiple responses
  if (res.headersSent) {
    console.log("Response already sent. Skipping duplicate call.");
    return;
  }

  console.log("🔁 Callback handler triggered");

  try {
    const stateParams = new URLSearchParams(state);
    const clinicId = stateParams.get("clinicId");
    const receivedNonce = stateParams.get("nonce");
    const sessionNonce = req.session.bb_oauth_nonce;
    const p_id = req.session.patientId?.toString();

    if (!p_id) {
      console.log("patinet id not received!!");
    }

    console.log("=======callback========");
    console.log("received state:", receivedNonce);
    console.log("nonce sended:", req.session.bb_oauth_nonce);

    if (!receivedNonce || receivedNonce !== sessionNonce) {
      console.log("⚠️ State nonce mismatched");
      return res.status(401).json({
        redirect: "http://localhost:5713/patient-data",
        message: "Invalid nonce in OAuth state",
      });
    }

    const tokenData = await exchangeCodeForToken(code);

    if (!tokenData || tokenData.error) {
      console.log("❌ Token exchange failed:", tokenData);
      return res.status(400).json({
        redirect: "http://localhost:5713/patient-data?consent=error",
        message: "Token exchange failed",
      });
    }

    console.log("✅ Token exchange successful:", {
      patientId: tokenData.patientId,
      clinicId: clinicId,
      refreshToken: tokenData.refreshToken,
      accessToken: tokenData.accessToken?.slice(0, 10) + "...",
    });

    await Consent.findOneAndUpdate(
      {
        patientId: tokenData.patientId,
        clinicId: clinicId,
        p_id: p_id,
      },
      {
        refreshToken: tokenData.refreshToken,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    const newPatient = await addPatientToDatabase(req.body);
    console.log(newPatient, "added");

    req.session.save((err) => {
      if (err) {
        console.error("CALLBACK SESSION ERROR"); //debug
        return res.status(500).json({ message: "Session save failed" });
      }

      return res.redirect("http://localhost:5173/patients-list");
    });
  } catch (err) {
    console.log("🚨 handleCallback Error:", err);

    if (!res.headersSent) {
      return res.status(500).json({
        redirect: "http://localhost:5713/patient-data?consent=error",
        message: "Internal server error",
      });
    }
  }
};
