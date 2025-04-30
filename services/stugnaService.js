import { StugnaES, ruleApply } from "stugna-es";
import fs from 'fs';
import path from 'path';

const pvTypeRules = JSON.parse(fs.readFileSync(path.resolve('./knowledge_base/pv_type_rules.json'), 'utf8'));


// let options = {
//     toSaveEvents: true,
//     toExplainMore: true,
//     passCountMax: 16
// };

let es = new StugnaES();

function determinePVtype(pvData) {
    const facts = [
        {
            name: "is_electric_autonomy_important",
            value: pvData.is_electric_autonomy_important ? 'TRUE' : 'FALSE'
        },
        {
            name: "is_possible_electricity_grid_connection",
            value: pvData.is_possible_electricity_grid_connection ? 'TRUE' : 'FALSE'
        },
        {
            name: "is_exist_money_limit",
            value: pvData.is_exist_money_limit ? 'TRUE' : 'FALSE'
        }
    ];

    es.rulesImport(pvTypeRules);
    es.factsImport(facts);

    const pvType = es.factGet(`pv_type`);

    return pvType;
}

export const StugnaService = {
    determinePVtype
}