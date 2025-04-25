import { assistant } from "../services/assistantService.js";

export async function getAnswer( req, res ) {
    const { message, pv_user_data } = req.body;
    console.log("!!! pv_user_data: ", pv_user_data)
    const { answer, updated_user_data } = await assistant.processUserInput(message, pv_user_data);
    console.log("[INFO before res] ", answer, updated_user_data);
    res.status(200).json({ answer, updated_user_data });
}

export function startComunication(req, res) {
    const { pv_user_data } = req.body;
    const { answer, updated_user_data } = assistant.sendFirstMesssage(pv_user_data);
    console.log("[INFO] ", answer);
    res.status(200).json({ answer, updated_user_data });
}