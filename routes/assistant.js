import express from "express";
import { getAnswer } from "../controllers/assistantController.js";

const router = express.Router();

router.post("/ask", getAnswer);

export default router;