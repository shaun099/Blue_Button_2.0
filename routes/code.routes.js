import { Router } from "express";

import {getCodeData} from "../controllers/code.controllers.js";


const router = Router();

router.get("/:code",getCodeData);

export default router;