import { assistant } from "../services/assistantService.js";

export function getAnswer( req, res ) {
    const { message, data } = req.body;
    const { nerEntities, intent, answer, updated_user_data } = assistant.processUserInput(message, data);
    res.status(200).json({ nerEntities, intent, answer, updated_user_data });
}