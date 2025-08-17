import { Router } from "express";
import {
  addPatients,
  searchPatients,
  fetchPatients,
} from "../controllers/patient.controllers.js";

const router = Router();

router.get("/:id", searchPatients);
//router.get("/patient/:id",readPatient);

router.post("/addPatients", addPatients);

router.get("/by-clinic/:clinicId", fetchPatients);

export default router;
