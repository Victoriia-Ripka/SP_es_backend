import express from "express";
import { getAnswer, startComunication } from "../controllers/assistantController.js";

const router = express.Router();

router.post("/ask", getAnswer);
router.post("/start", startComunication);

export default router;