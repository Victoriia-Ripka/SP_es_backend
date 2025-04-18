import express from "express";
import { assistant } from "../services/assistantService.js";

const router = express.Router();

router.post("/ask", async (req, res) => {
    const { message } = req.body;
    const { nerEntities, intent, answer } = await assistant.processUserInput(message);
    res.json({ nerEntities, intent, answer });
});

export default router;