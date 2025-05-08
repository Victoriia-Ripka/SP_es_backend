import fs from 'fs';
import path from 'path';
import { LogicalMachine } from '../logicalMachine/LogicalMachine.js'

export class LogicalMachineService {
    constructor() {
        this.isTrigger = true;

        this.pvTypeRules = JSON.parse(fs.readFileSync(path.resolve('./knowledge_base/pv_type_rules.json'), 'utf8'));
        this.pvDesignRules = JSON.parse(fs.readFileSync(path.resolve('./knowledge_base/pv_design_rules.json'), 'utf8'));
        this.pvPECRules = JSON.parse(fs.readFileSync(path.resolve('./knowledge_base/pec_rules.json'), 'utf8'));
        this.communicationRules = JSON.parse(fs.readFileSync(path.resolve('./knowledge_base/communication_skills.json'), 'utf8'));
        this.lmOptions = {
            toSaveEvents: true,
            toExplainMore: false,
            passCountMax: 64,
        };
    }

    determinePVtype(electric_autonomy, electricity_grid_connection, money_limit) {
        this.lm = new LogicalMachine(this.lmOptions);
        this.lm.rulesImport(this.pvTypeRules, this.isTrigger);

        const facts = [
            { name: "is_electric_autonomy_important", value: electric_autonomy ? 'TRUE' : 'FALSE' },
            { name: "is_possible_electricity_grid_connection", value: electricity_grid_connection ? 'TRUE' : 'FALSE' },
            { name: "is_exist_money_limit", value: money_limit ? 'TRUE' : 'FALSE' }
        ];

        this.lm.factsImport(facts, this.isTrigger);
        const res = this.lm.factGet('pv_type');

        if (!res) {
            console.error(`Fact '${ruleName}' not found`);
            return { type: null };
        }

        return { type: res.value };
    }

    determinePEC(angle, orientation) {
        this.lm = new LogicalMachine(this.lmOptions);
        this.lm.rulesImport(this.pvPECRules, this.isTrigger);

        const facts = [
            { name: "angle", value: angle },
            { name: "orientation", value: orientation },
        ];

        this.lm.factsImport(facts, this.isTrigger);
        const res = this.lm.factGet('define_PEC');

        if (!res) {
            console.error(`Fact 'define_PEC' not found`);
            return { value: null, history: [] };
        }

        return res.value;
    }

    findNeedeText(ruleName, facts) {
        this.lm = new LogicalMachine(this.lmOptions);
        this.lm.rulesImport(this.communicationRules, this.isTrigger);
        this.lm.factsImport(facts, this.isTrigger);

        const res = this.lm.factGet(ruleName);

        if (!res) {
            console.error(`Fact '${ruleName}' not found`);
            return { value: null };
        }

        return { value: res.value };
    }

    applyPVDesignRuleToFacts(ruleName, facts) {
        this.lm = new LogicalMachine(this.lmOptions);
        this.lm.rulesImport(this.pvDesignRules, this.isTrigger);
        this.lm.factsImport(facts, this.isTrigger);

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