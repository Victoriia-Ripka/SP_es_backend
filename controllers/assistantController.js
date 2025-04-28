import { processUserInput, sendFirstMesssage } from "../services/assistantService.js";

export async function getAnswer( req, res ) {
    const { message, pv_user_data } = req.body;
    const { answer, updated_user_data } = await processUserInput(message, pv_user_data);
    res.status(200).json({ answer, updated_user_data });
}

export function startComunication(req, res) {
    const { pv_user_data } = req.body;
    const { answer, updated_user_data } = sendFirstMesssage(pv_user_data);
    res.status(200).json({ answer, updated_user_data });
}