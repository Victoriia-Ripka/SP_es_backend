import Inverters from "../schemas/inverters.js"
import Panels from "../schemas/panels.js"
import Charges from "../schemas/charges.js"
import { StugnaService } from "./stugnaService.js"

async function findElementByName(name, filters = {}) {
    switch (name) {
        case "inverters":
            return await Inverters.find(filters);

        case "panels":
            return await Panels.find(filters);

        case "charges":
            return await Charges.find(filters);

        default:
            return [];
    }
}

export const DBService = {
    findElementByName
}

