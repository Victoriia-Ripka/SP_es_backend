import { assistant } from "../services/assistantService.js";

export async function getAnswer( req, res ) {
    const { message, pv_user_data } = req.body;
    const { answer, updated_user_data } = await assistant.processUserInput(message, pv_user_data);
    console.log("[INFO] ", answer, updated_user_data)
    res.status(200).json({ answer, updated_user_data });
}