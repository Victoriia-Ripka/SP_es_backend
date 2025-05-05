import Inverters from "../schemas/inverters.js"
import Panels from "../schemas/panels.js"
import Charges from "../schemas/charges.js"
import { StugnaService } from "./stugnaService.js"

async function findElementByName(name) {
    const facts = [{
        name: "name",
        value: name
    }]
    const translatedName = StugnaService.applyPVDesignRuleToFacts("translation_comp_name", facts)

    switch (translatedName) {
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

