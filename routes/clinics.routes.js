import { Router } from "express";
import { clinicSignUp } from "../controllers/clinic.controllers.js";

const router = Router();

router.post("/signup", clinicSignUp);

export default router;
