import { Router } from "express";
import {searchEob} from "../controllers/eob.controllers.js";
import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { getEobForPatient } from "../controllers/eob.controllers.js";

const router = Router();

router.get("/",searchEob);

router.get('/:patientId', ClerkExpressRequireAuth(), getEobForPatient);

export default router;
