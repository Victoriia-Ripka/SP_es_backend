import { StugnaES } from "stugna-es";
import fs from 'fs';
import path from 'path';

const pvTypeRules = JSON.parse(fs.readFileSync(path.resolve('./knowledge_base/pv_type_rules.json'), 'utf8'));
const pvDesignRules = JSON.parse(fs.readFileSync(path.resolve('./knowledge_base/pv_design_rules.json'), 'utf8'));


let options = {
    toSaveEvents: false,
    toExplainMore: true
};

let es = new StugnaES(options);

// TOFIX: при надсиланні обʼєкта з різними даними з ЕС видається той самий результат ???
function determinePVtype(electric_autonomy, electricity_grid_connection, money_limit) {
    const facts = [
        {
            name: "is_electric_autonomy_important",
            value: electric_autonomy ? 'TRUE' : 'FALSE'
        },
        {
            name: "is_possible_electricity_grid_connection",
            value: electricity_grid_connection ? 'TRUE' : 'FALSE'
        },
        {
            name: "is_exist_money_limit",
            value: money_limit ? 'TRUE' : 'FALSE'
        }
    ];

    es.rulesImport(pvTypeRules);
    es.factsImport(facts);

    const pvType = es.factGet(`pv_type`);

    return pvType;
}

function checkPVplace(pv_instalation_place, pv_power) {
    const facts = [
        {
            name: "pv_instalation_place",
            value: pv_instalation_place
        },
        {
            name: "pv_power",
            value: pv_power
        }
    ]

    es.rulesImport(pvDesignRules);
    es.factsImport(facts);

    const instalation_place = es.factGet(`instalation_place`);
    const { history: answer, value: place } = instalation_place;
    return { answer, place };
}

export const StugnaService = {
    determinePVtype,
    checkPVplace
}