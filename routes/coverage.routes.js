import { Router } from "express";
import {searchCoverage} from "../controllers/coverage.controllers.js";

const router = Router();

router.get("/",searchCoverage);

export default router;