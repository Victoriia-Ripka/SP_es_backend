import { assistantService } from "../services/assistantService.js";

export async function getAnswer(req, res) {
    const { message, pv_user_data } = req.body;
    const { answer, updated_user_data } = await assistantService.processUserInput(message, pv_user_data);
    res.status(200).json({ answer, updated_user_data });
}

export function startCommunication(req, res) {
    const { answer, pv_user_data } = assistantService.sendFirstMesssage();
    res.status(200).json({ answer, pv_user_data });
}

export function setPVtype(req, res) {
    const { is_electric_autonomy_important, is_possible_electricity_grid_connection, is_exist_money_limit } = req.body;
    const { type, rule } = assistantService.determinationPVtype(is_electric_autonomy_important, is_possible_electricity_grid_connection, is_exist_money_limit);
    res.status(200).json({ type, rule });
}

export async function designPV(req, res) {
    const { pvData } = req.body;
    const { answerFromES, pv, principalElementsData } = await assistantService.createPVdesign(pvData);
    res.status(200).json({ answerFromES, pv, principalElementsData });
}