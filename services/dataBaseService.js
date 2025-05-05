import Inverters from "../schemas/inverters.js"
import Panels from "../schemas/panels.js"
import Charges from "../schemas/charges.js"
import { StugnaService } from "./stugnaService.js"

async function findElementByName(name) {
    switch (name) {
        case "inverters":
            return await Inverters.find();

        case "panels":
            return await Panels.find();

        case "charges":
            return await Charges.find()

        default:
            return 0;
    }
}

export const DBService = {
    findElementByName
}

