// models/Patient.js
import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    dateOfBirth: String,
    contactNumber: Number,
    clinicId: String,
    createdBy: String, // Clerk user ID
  },
  {
    timestamps: true,
  }
);

const Patient = mongoose.model("Patient", patientSchema);
export default Patient;
