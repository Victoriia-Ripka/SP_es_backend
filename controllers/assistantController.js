import { ctrlWrapper } from "../helpers/CtrlWrapper.js";
import { ExpertSystemService } from "../services/expertSystemService.js";

async function getAnswer(req, res) {
    const { message, pv_user_data } = req.body;
    const { answer, updated_user_data } = await ExpertSystemService.processUserInput(message, pv_user_data);
    res.status(200).json({ answer, updated_user_data });
}

function startCommunication(req, res) {
    const { answer, pv_user_data } = ExpertSystemService.sendFirstMesssage();
    res.status(200).json({ answer, pv_user_data });
}

function setPVtype(req, res) {
    const { is_electric_autonomy_important, is_possible_electricity_grid_connection, is_exist_money_limit } = req.body;
    const { type, rule } = ExpertSystemService.determinationPVtype(is_electric_autonomy_important, is_possible_electricity_grid_connection, is_exist_money_limit);
    res.status(200).json({ type, rule });
}

async function designPV(req, res) {
    const { pvData } = req.body;
    const { answer, pv } = await ExpertSystemService.createPVdesign(pvData);
    res.status(200).json({ answer, pv });
}

export default {
    designPV: ctrlWrapper(designPV),
    setPVtype: ctrlWrapper(setPVtype),
    startCommunication: ctrlWrapper(startCommunication),
    getAnswer: ctrlWrapper(getAnswer)
}