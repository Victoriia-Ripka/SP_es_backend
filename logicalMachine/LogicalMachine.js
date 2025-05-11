import Fact from "./Fact.js";
import Rule from "./Rule.js";
import {
    ERROR_SPACE_IN_FACT_NAME,
    ERROR_PERIODIC_RULES,
    ERROR_FACT_NAME_ABSENT,
    ERROR_FACT_NAME_EMPTY,
    ERROR_FACT_VALUE_ABSENT
} from './Errors.js';

const regexpWhiteSpaces = /\s+/g;

export class LogicalMachine {
    // fields
    _rules;
    _facts;
    _events;
    _toSaveEvents;
    _toExplainMore;
    _passCountMax;
    _factsAreOrdered;

    /**
     * @param options {null|Object}
     */
    constructor(options = null) {
        let toSaveEvents = true;
        let toExplainMore = false;
        let passCountMax = 16;
        if (options) {
            if (options.toSaveEvents !== undefined) {
                toSaveEvents = options.toSaveEvents;
            }
            if (options.toExplainMore !== undefined) {
                toExplainMore = options.toExplainMore;
            }
            if (options.passCountMax !== undefined) {
                passCountMax = options.passCountMax;
            }
        }
        this._rules = [];
        this._facts = {};
        this._events = [];
        this._toSaveEvents = toSaveEvents;
        this._toExplainMore = toExplainMore;
        this._passCountMax = passCountMax;
        this._factsAreOrdered = true;
    }

    /**
     * додає нотатку про додавання події в _events LM
     * @param brief {string} - прапорець події
     * @param more {string|null} - текст помилки
     * @param subject {string|null}
     */
    eventAdd(brief, more, subject) {
        if (this._toSaveEvents) {
            let event = { brief }
            if (more) {
                event.more = more;
            }
            if (subject) {
                event.subject = subject;
            }
            this._events.push(event);
        }
    }

    /**
     *
     */
    eventsAll() {
        return this._events.map(event => event);
    }

    /**
     *
     */
    eventsClear() {
        this._events = [];
    }

    /**
     * перевірка чи факт є відповідним (чи має імʼя факту і значення)
     * @param name {string|null|undefined}
     * @param value {string|number|boolean|null|undefined}
     * @returns {boolean}
     * @private
     */
    _factIsValid(name, value) {
        // перевірка присутності імені факту
        if (name === null || name === undefined) {
            this.eventAdd('fact error', ERROR_FACT_NAME_ABSENT);
            return false;
        }

        // перевірка присутності значення факту
        name = name.toString();
        let nameTrimmed = name.trim()
        if (nameTrimmed.length === 0) {
            this.eventAdd('fact error', ERROR_FACT_NAME_EMPTY);
            return false;
        }

        // імʼя повинно бути одним словом
        if (regexpWhiteSpaces.test(name)) {
            this.eventAdd('fact error', ERROR_SPACE_IN_FACT_NAME + name);
            return false;
        }

        // значення факту повинно бути присутнім
        if (value === null || value === undefined) {
            this.eventAdd('fact error', ERROR_FACT_VALUE_ABSENT);
            return false;
        }
        return true
    }

    /**
     * додавання факту до LM
     * @param name {string|null|undefined}
     * @param value {string|number|boolean|null|undefined}
     * @param description {string|null|undefined}
     */
    factAdd({ name, value, description }) {
        if (!this._factIsValid(name, value)) {
            return
        }

        // створення опису факту
        let subject = description;
        if (!subject) {
            subject = `${name}: ${value}`;
        }

        // заміщення старого факту у LM
        let factNew = new Fact(name, value, subject);
        let factOld = this._facts[name];
        if (factOld) {
            factOld.history.push(`init: ${subject}`);
            factNew.history = factOld.history;
        }
        this._facts[name] = factNew;

        // додавання події про доданий факт
        this.eventAdd('fact add', null, subject);
        this._order();
    }

    /**
     * @param name
     * @returns {boolean}
     */
    factIsKnown(name) {
        return (this._facts[name] !== undefined)
    }

    /**
     * @param name {string}
     * @returns {{name, value: *, history: (*|string[]|[string]|History), changed}|null}
     */
    factGet(name) {
        if (!this._facts[name]) {
            return null;
        }
        let value = this._facts[name].value;
        let history = this._facts[name].history;
        let changed = this._facts[name].changed;
        return { name, value, history, changed };
    }

    /**
     * додавання масиву фактів до LM
     * @param facts {Object[]}
     */
    factsImport(facts) {
        let addedCount = 0;
        for (let fact of facts) {
            if (!this._factIsValid(fact.name, fact.value)) {
                continue;
            }
            this.factAdd(fact);
            addedCount++;
        }
        if (addedCount > 0) {
            this._order();
        }
    }

    /**
     * @returns {boolean}
     */
    factsAreOrdered() {
        return this._factsAreOrdered;
    }

    /**
     * видалення фактів з LM
     */
    factsClear() {
        this._facts = {};
        this.eventAdd('facts clear', 'all facts are cleaned');
    }

    /**
     * додавання правила до LM 
     * @param condition {string}
     * @param factName {string}
     * @param factValue {string}
     * @param priority {number}
     * @param description {string}
     * @param final {number}
     * @param precondition {string}
     * @param missing {number|string|null}
     */
    ruleAdd({ condition,
        factName, factValue,
        priority, description,
        final, precondition, missing
    }) {
        // валідація правила
        let ruleError = Rule.validate(condition, factName, factValue);
        if (ruleError) {
            this.eventAdd('rule error', ruleError, description);
            return;
        }

        let rule = new Rule(condition, factName, factValue, priority, description, final, precondition, missing);
        ruleError = rule.getError();
        if (ruleError) {
            let subject = rule.description;
            this.eventAdd('rule error', ruleError, subject); // parsing errors
            return
        }

        // додавання правила до списку _rules і сортування їх за пріоритетністю
        this._rules.push(rule);
        this._rules.sort((a, b) => {
            return a.priority - b.priority; 
        });

        this.eventAdd('rule add', null, rule.description);
        this._order();
    }

    /**
     * додавання масиву правил до LM 
     * @param rules {object[]}
     */
    rulesImport(rules) {
        for (let rule of rules) {
            let ruleError = Rule.validate(rule.condition, rule.factName, rule.factValue);
            if (ruleError) {
                let subject = rule.description;
                if (!subject) {
                    subject = Rule.createDescription(rule.condition, rule.factName, rule.factValue);
                }
                this.eventAdd('rule error', ruleError, subject);
                continue;
            }

            rule.priority = rule.priority ? rule.priority : 1;
            this.ruleAdd(rule, false);
        }

        this._order();
    }

    /**
     * @returns {object[]}
     */
    rulesAll() {
        let all = [];
        for (let rule of this._rules) {
            let item = {
                condition: rule.condition,
                factName: rule.fact,
                factValue: rule.value,
                priority: rule.priority,
                description: rule.description,
                final: rule.final
            }
            for (let prop in item) {
                if (item[prop] === undefined) {
                    delete item[prop];
                }
            }
            all.push(item);
        }
        return all;
    }

    /**
     *
     */
    rulesClear() {
        this._rules = [];
        this.eventAdd('rules clear', 'all rules are cleaned');
    }

    /**
     * @param factName
     * @param factValue
     * @param eventName
     * @param ruleDescription
     * @private
     */
    _applyFact(factName, factValue, eventName, ruleDescription) {
        let factIsChanged = 0;
        let factNew = new Fact(factName, factValue, `${eventName}: ${ruleDescription}`);
        let factOld = this._facts[factName];
        if (!factOld || factOld.value !== factNew.value) { // has changes
            if (factOld) {
                factOld.history.push(`${eventName}: ${ruleDescription}`);
                factNew.history = factOld.history;
            }
            factNew.changed = true;
            this._facts[factName] = factNew;
            this.eventAdd(eventName, null, ruleDescription);
            factIsChanged = 1;
        }
        return factIsChanged;
    }

    /**
     * @param obj
     * @returns {any}
     * @private
     */
    _deepCopy(obj) {
        const str = JSON.stringify(obj);
        return JSON.parse(str);
    }

    /**
     * Виправлення значень відсутніх фактів за замовчуванням тимчасово
     * @param factsExisting
     * @param factsMissing
     * @param defaultValue
     * @returns {*}
     * @private
     */
    _fixFactsMissing(factsExisting, factsMissing, defaultValue) {
        let factsTmp = this._deepCopy(factsExisting);
        for (let factName of factsMissing) {
            const fact = new Fact(factName, defaultValue, '');
            factsTmp[factName] = fact;
        }
        return factsTmp;
    }

    /**
     * Упорядкування всіх правил та фактів
     */
    _order() {
        this._factsAreOrdered = false;
        let passCount = 1;
        let finalRuleHappened = false;
        while (passCount <= this._passCountMax) {
            // one pass - check all rules
            let factsChanged = 0;
            for (let rule of this._rules) {
                let factsMissing = [];

                // precondition
                if (rule.hasPrecondition()) {
                    // check precondition variables
                    if (!rule.checkWantedVariables(rule.prevariables, this._facts, factsMissing)) {
                        if (this._toExplainMore) {
                            this.eventAdd('rule skip', `missing facts in precondition: ${factsMissing.join(', ')};`, rule.description);
                        }
                        continue;
                    }

                    // check precondition
                    if (!rule.check(this._facts, rule.precalc, true)) {
                        if (this._toExplainMore) {
                            this.eventAdd('rule skip', `precondition not met`, rule.description);
                        }
                        continue;
                    }
                }

                // check condition variables
                let factsAll = this._facts;
                factsMissing = [];
                if (!rule.checkWantedVariables(rule.variables, this._facts, factsMissing)) {
                    if (rule.missing === undefined) {
                        if (this._toExplainMore) {
                            this.eventAdd('rule skip', `missing fact in condition: ${factsMissing.join(', ')};`, rule.description);
                        }
                        continue;
                    } else {
                        factsAll = this._fixFactsMissing(this._facts, factsMissing, rule.missing);
                    }
                }

                // check condition
                if (rule.check(factsAll, rule.calc, false)) {
                    factsChanged += this._applyFact(rule.fact, rule.value, 'rule ok', rule.description);
                    finalRuleHappened = (rule.final === 1 || rule.final === 3);
                } else {
                    if (rule.hasElse()) {
                        factsChanged += this._applyFact(rule.factElse, rule.valueElse, 'rule else', rule.description);
                        finalRuleHappened = (rule.final === 2 || rule.final === 3);
                    }
                }

                if (finalRuleHappened) {
                    this.eventAdd('rule final', `Final rule happened`);
                    break;
                }
            }

            this.eventAdd('rules passed', `Rules pass count is ${passCount}`);

            if (!factsChanged) {
                this._factsAreOrdered = true;
                break;
            }

            if (finalRuleHappened) {
                this._factsAreOrdered = true;
                break;
            }

            passCount++;
        }

        if (!this._factsAreOrdered && this._toSaveEvents) {
            this.eventAdd('rules error', ERROR_PERIODIC_RULES);
        }
    }
}
