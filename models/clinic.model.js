import mongoose from 'mongoose';

const clinicSchema = new mongoose.Schema({
  // The unique organization ID provided by Clerk after creation.
  // This is the crucial link between your database and Clerk's system.
  clerkOrgId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // The name of the clinic, provided during sign-up.
  clinicName: {
    type: String,
    required: true,
  },
  // You can add other fields here later, like subscription status, address, etc.
}, { timestamps: true });

const Clinic = mongoose.model('Clinic', clinicSchema);

export default Clinic;