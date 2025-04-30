import { processUserInput, sendFirstMesssage, determinationPVtype } from "../services/assistantService.js";

export async function getAnswer(req, res) {
    const { message, pv_user_data } = req.body;
    const { answer, updated_user_data } = await processUserInput(message, pv_user_data);
    res.status(200).json({ answer, updated_user_data });
}

export function startCommunication(req, res) {
    const { answer, pv_user_data } = sendFirstMesssage();
    res.status(200).json({ answer, pv_user_data });
}

export function setPVtype(req, res) {
    const { pvData } = req.body;
    const {type, rule} = determinationPVtype(pvData);
    res.status(200).json({ type, rule });
}