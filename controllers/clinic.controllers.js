import { clerkClient } from "@clerk/clerk-sdk-node";
import Clinic from "../models/clinic.model.js";

export const clinicSignUp = async (req, res) => {
  const { clinicName, firstName, lastName, email, password } = req.body;

  console.log(
    clinicName,
    ":",
    firstName,
    ":",
    lastName,
    ":",
    email,
    ":",
    password
  );

  if (!clinicName || !firstName || !lastName || !email || !password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  let userId, organizationId;

  try {
    // --- Action 1: Create the User in Clerk ---
    try {
      const newUser = await clerkClient.users.createUser({
        firstName,
        lastName,
        emailAddress: [email],
        password,
      });
      userId = newUser.id;
      console.log(`✅ Clerk user created successfully: ${userId}`);
    } catch (err) {
      console.error(
        "❌ Failed to create Clerk user:",
        err.errors || err.message
      );
      const msg = err.errors
        ? err.errors[0].longMessage
        : "User creation failed.";
      return res.status(500).json({ message: msg, step: "createUser" });
    }

    // --- Action 2: Create the Organization in Clerk ---
    try {
      const newOrganization =
        await clerkClient.organizations.createOrganization({
          name: clinicName,
          createdBy: userId,
        });
      organizationId = newOrganization.id;
      console.log(
        `✅ Clerk organization created successfully: ${organizationId}`
      );
    } catch (err) {
      console.error(
        "❌ Failed to create Clerk organization:",
        err.errors || err.message
      );
      const msg = err.errors
        ? err.errors[0].longMessage
        : "Organization creation failed.";
      return res.status(500).json({ message: msg, step: "createOrganization" });
    }

    // --- Action 3: Save Clinic Record to MongoDB ---
    try {
      await Clinic.create({
        clerkOrgId: organizationId,
        clinicName: clinicName,
      });
      console.log(`✅ Clinic record saved to local database.`);
    } catch (err) {
      console.error("❌ Failed to save clinic to database:", err.message);
      return res
        .status(500)
        .json({ message: "Database save failed.", step: "saveClinic" });
    }

    // --- Final Step: Respond to the Frontend ---
    res
      .status(201)
      .json({ message: "Clinic and admin user created successfully." });
  } catch (err) {
    console.error("❌ Unexpected error in clinicSignUp:", err.message);
    res.status(500).json({ message: "Unexpected server error." });
  }
};
