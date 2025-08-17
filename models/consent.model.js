import mongoose from "mongoose";

const consentSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: [true, "Patient ID from Blue Button is required."],
      index: true,
    },
    clinicId: {
      type: String,
      required: [
        true,
        "Clinic ID from your authentication provider is required.",
      ],
      index: true,
    },
    refreshToken: {
      type: String,
      required: [true, "An encrypted refresh token is required."],
    },
    p_id: {
      type: String,
      required: [true, "An encrypted refresh token is required."],
    },
  },
  {
    timestamps: true,
  }
);

consentSchema.index({ patientId: 1, clinicId: 1 }, { unique: true });

const Consent = mongoose.model("Consent", consentSchema);

export default Consent;
