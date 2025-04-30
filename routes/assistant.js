import express from "express";
import { getAnswer, startCommunication, setPVtype } from "../controllers/assistantController.js";

const router = express.Router();


router.get("/start", startCommunication);
router.post("/ask", getAnswer);
router.post("/setPVtype", setPVtype);
// router.post("/designPV", designPV);


export default router;