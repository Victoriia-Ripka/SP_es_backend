import express from "express";
import ctrl from "../controllers/assistantController.js";

const router = express.Router();

router.get("/start", ctrl.startCommunication);
router.post("/ask", ctrl.getAnswer);
router.post("/setPVtype", ctrl.setPVtype);
router.post("/designPV", ctrl.designPV);

export default router;