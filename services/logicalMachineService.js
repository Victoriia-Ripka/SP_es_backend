import fs from 'fs';
import path from 'path';
import { LogicalMachine } from '../LogicalMachine/LogicalMachine.js'

export class LogicalMachineService {
    constructor() {
        this.pvTypeRules = JSON.parse(fs.readFileSync(path.resolve('./knowledge_base/pv_type_rules.json'), 'utf8'));
        this.pvDesignRules = JSON.parse(fs.readFileSync(path.resolve('./knowledge_base/pv_design_rules.json'), 'utf8'));
        this.pvPECRules = JSON.parse(fs.readFileSync(path.resolve('./knowledge_base/pec_rules.json'), 'utf8'));

        const options = {
            toSaveEvents: true,
            toExplainMore: true
        };

        this.lm = new LogicalMachine(options);
    }


    // TOFIX: при надсиланні обʼєкта з різними даними з ЕС видається той самий результат ???
    // TODO: test
    determinePVtype(electric_autonomy, electricity_grid_connection, money_limit) {
        const facts = [
            { name: "is_electric_autonomy_important", value: electric_autonomy ? 'TRUE' : 'FALSE' },
            { name: "is_possible_electricity_grid_connection", value: electricity_grid_connection ? 'TRUE' : 'FALSE' },
            { name: "is_exist_money_limit", value: money_limit ? 'TRUE' : 'FALSE' }
        ];

        this.lm.rulesImport(this.pvTypeRules);
        this.lm.factsImport(facts);

        const res = this.lm.factGet('pv_type');

        if (!res) {
            console.error(`Fact '${ruleName}' not found`);
            return { value: null, history: [] };
        }

        return { type: res.value, message: res.history };
    }

    determinePEC(angle, orientation) {
        const facts = [
            { name: "angle", value: angle },
            { name: "orientation", value: orientation },
        ];

        this.lm.rulesImport(this.pvPECRules);
        this.lm.factsImport(facts);

        const res = this.lm.factGet('define_PEC');

        if (!res) {
            console.error(`Fact 'define_PEC' not found`);
            return { value: null, history: [] };
        }

        return res.value;
    }

    applyPVDesignRuleToFacts(ruleName, facts) {
        this.lm.rulesImport(this.pvDesignRules);
        this.lm.factsImport(facts);

        const res = this.lm.factGet(ruleName);

        if (!res) {
            console.error(`Fact '${ruleName}' not found`);
            return { value: null, history: [] };
        }

        return { value: res.value, history: res.history };
    }

    buildFacts(factsObject) {
        return Object.entries(factsObject).map(([name, value]) => ({ name, value }));
    }

    resolveValue(result, fallbackKey, fallbackValue) {
        return result.value === fallbackKey ? fallbackValue : result.value;
    }

    applyRule(ruleName, facts, fallbackKey, fallbackValue) {
        const result = this.applyPVDesignRuleToFacts(ruleName, facts);
        const resolvedValue = this.resolveValue(result, fallbackKey, fallbackValue);
        console.log("[INFO LM service]", ruleName, resolvedValue);
        return { value: resolvedValue, history: result.history };
    }

}