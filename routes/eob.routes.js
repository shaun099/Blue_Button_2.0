import { Router } from "express";

//import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { getEobForPatient } from "../controllers/eob.controllers.js";

const router = Router();

router.get("/:patientId", getEobForPatient);

export default router;
