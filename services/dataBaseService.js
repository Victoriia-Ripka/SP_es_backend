import Inverters from "../schemas/inverters.js"
import Panels from "../schemas/panels.js"
import Charges from "../schemas/charges.js"
import DistributionBoards from '../schemas/distribution_boards.js'
import ChargeControllers from '../schemas/charge_controllers.js'
import Counters from "../schemas/counters.js"

export class DBService {
    constructor() { }

    async findElementByName(name, filters = {}) {
        switch (name) {
            case "inverters":
                return await Inverters.find(filters);

            case "panels":
                return await Panels.find(filters);

            case "charges":
                return await Charges.find(filters);

            case "charge_controllers":
                return await ChargeControllers.find(filters);

            case "counters":
                return await Counters.find(filters);

            case "distribution_boards":
                return await DistributionBoards.find(filters);

            default:
                return [];
        }
    }
}