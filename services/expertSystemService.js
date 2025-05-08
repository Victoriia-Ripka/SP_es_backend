import { Helpers } from '../helpers/index.js';
import { UserIntentService } from './userIntentService.js'
import { KBService } from './knowledgeBaseService.js'
import { LogicalMachineService } from './logicalMachineService.js';
import { DBService } from './dataBaseService.js';
import { CalculatorService } from './calculatorService.js';
import { AssistantService } from './assistantService.js';

const lmService = new LogicalMachineService();
const kbSerice = new KBService();
const dbService = new DBService();

const started_pv_user_data = {
    intent: "", // актуальний намір користувача
    data_designing_pv: {
        pv_power: 0,
        pv_instalation_place: '',
        pv_area: {
            width: 0,
            length: 0
        },
        roof_tilt: -1,
        roof_orientation: -1,
        pv_type: '',
        pv_location: ''
    },
    data_determining_pv_type: {
        is_electric_autonomy_important: false,
        is_possible_electricity_grid_connection: false,
        is_exist_money_limit: false
    },

    cache: {
        history: [],
        pv_type: "",
        original_intent: '' // оригінальний намір експертної системи
    },
    messagesCount: 0
}

function sendFirstMesssage() {
    const { value } = lmService.findNeedeText("greeting", [{ name: 'firstMessage', value: 'TRUE' }]);
    return { answer: value, pv_user_data: started_pv_user_data };
}

function determinationPVtype(electric_autonomy, electricity_grid_connection, money_limit) {
    const { type } = lmService.determinePVtype(electric_autonomy, electricity_grid_connection, money_limit);
    return { type };
}

async function createPVdesign(pvData) {
    let answerFromES = [];

    const {
        pv_power = '',
        pv_instalation_place = '',
        pv_area = {},
        roof_tilt = '',
        roof_orientation = '',
        pv_type = '',
        pv_location = ''
    } = pvData || {};

    const {
        width = 0,
        length = 0
    } = pv_area;

    // 1.1 get needed PV elements
    const pvTypesData = kbSerice.getKnowledge("СЕС", "види");
    const pvElements = pvTypesData[pv_type]["елементи системи"];
    // const pvExtraElements = pvTypesData[pv_type]["додаткові елементи системи"];

    // 1.2 get insollation data for the region
    const regionInsolationData = kbSerice.getKnowledge("інсоляція", pv_location);
    console.log(regionInsolationData)
    const yearRegionInsolation = regionInsolationData["рік"];
    const monthRegionInsolationRange = regionInsolationData["по місяцям"];

    // 2.1 check optimal PV instalation place
    const placeFacts = lmService.buildFacts({ pv_instalation_place, pv_power });
    const { value: optimalPVPlace, history: installationPlaceHistory } = lmService.applyRule("instalation_place", placeFacts);
    answerFromES.push(installationPlaceHistory);

    if (optimalPVPlace === 'земля' && pv_instalation_place === 'дах') {
        // return a message in case user pv_installation_place is unsuitable
        const { value } = lmService.findNeedeText("changed_pv_installation_place", [{ name: 'place', value: optimalPVPlace }]);

        const errorAnswer = [installationPlaceHistory, [value]];
        return {
            answer: errorAnswer, pv: {
                pv_type, optimalPVPlace: null, optimalPVOrientation: null, optimalPVAngle: null, pvElements, threeOptions: []
            }
        }
    }

    // 2.2.1
    // get optimal PV panels orientation
    if (roof_orientation % 5 !== 0 && roof_orientation >= 0) {
        // return a message in case panels orientation не кратна 5
        const { value } = lmService.findNeedeText("not_found", [{ name: 'not_found', value: 'orientation' }]);

        return {
            answer: [[value]],
            pv: {
                pv_type, optimalPVPlace, optimalPVOrientation: null, optimalPVAngle: null, pvElements, threeOptions: []
            }
        };
    }

    const orientationFacts = lmService.buildFacts({ place: pv_instalation_place, roof_orientation });
    const { value: optimalPVOrientation, history: orientationHistory } = lmService.applyRule("choosing_optimal_orientation", orientationFacts, "roof_orientation", roof_orientation);
    answerFromES.push(orientationHistory);

    // 2.2.2 get optimal tilt angle
    if (roof_tilt % 5 !== 0 && roof_tilt >= 0) {
        // return a message in case tilt angle не кратний 5
        const { value } = lmService.findNeedeText("not_found", [{ name: 'not_found', value: 'angle' }]);

        return {
            answer: [[value]],
            pv: {
                pv_type, optimalPVPlace, optimalPVOrientation: null, optimalPVAngle: null, pvElements, threeOptions: []
            }
        };
    }
    const angleFacts = lmService.buildFacts({ place: pv_instalation_place, roof_tilt });
    const { value: optimalPVAngle, history: angleHistory } = lmService.applyRule("set_optinal_angle", angleFacts, "roof_tilt", roof_tilt);
    answerFromES.push(angleHistory);

    // 2.2.3 calculate PEC 
    const PEC = lmService.determinePEC(optimalPVAngle, Math.abs(180 - optimalPVOrientation));

    // 3.0.1 translate element type ('інвертор' → 'inverters')
    const { value: translatedInvertor, history: answerTranslateInvertorFact } = lmService.applyRule("translation", lmService.buildFacts({ name: pvElements[0] }));

    // 3.0.2 translate PV type ('мережева' → 'on-grid')
    const { value: pvTypeEnglish, history: answerPvTypeEnglish } = lmService.applyRule("translation", lmService.buildFacts({ name: pv_type }));

    // 3.1 find suitable inverters
    const invertersParams = {
        type: pvTypeEnglish,
        nominal_power_dc_kW: {
            $gte: pv_power * 0.8,
            $lte: pv_power * 2,
        },
        available: true
    }
    const suitableInverters = await dbService.findElementByName(translatedInvertor, invertersParams);

    if (!suitableInverters || suitableInverters.length === 0) {
        // return a message in case we don't have suitable inverter 
        const { value } = lmService.findNeedeText("not_found", [{ name: 'not_found', value: translatedInvertor }]);

        const optimalParams = {
            required_power_kW: pv_power,
            type: pv_type,
        };

        return {
            answer: [[value], [{ optimalParams }]],
            pv: { pv_type, optimalPVPlace, optimalPVOrientation, optimalPVAngle, pvElements, threeOptions: [] }
        };
    }

    // 3.2 find suitable panels to pv_power
    const { value: translatedPanel, history } = lmService.applyRule("translation", lmService.buildFacts({ name: pvElements[1] }));
    const panels = await dbService.findElementByName(translatedPanel, { model: "LR5-54HTH-435M", available: true });

    const { value: distanceAmongPanels } = lmService.applyPVDesignRuleToFacts("get_needed_distance_among_panels", [{ name: "panels_place", value: optimalPVPlace }]);

    let suitablePanels;

    if (optimalPVPlace === "дах" && optimalPVAngle > 15) {
        // розрахунок панелей на даху 
        const areaWidth = width * 1000;   // convert measurs to mm
        const areaLength = length * 1000;
        const panelSpacing = distanceAmongPanels * 10 || 20;

        suitablePanels = panels.map(panel => {
            const fittingResult = CalculatorService.getFittingPanelCountOnRoof({
                panelWidth: panel.dimension.width,
                panelLength: panel.dimension.length,
                areaWidth,
                areaLength,
                distanceBetweenPanels: panelSpacing
            });
            const { count } = fittingResult;

            // лекція стор. 17
            const totalPVPowerKw = (count * panel.maximum_power_w) / 1000;

            if (totalPVPowerKw > pv_power) {
                const cleanPanel = panel.toObject();
                return {
                    ...cleanPanel,
                    ...fittingResult,
                    max_pv_power_for_area_kW: totalPVPowerKw
                };
            }

            return null;
        }).filter(Boolean);

        if (!suitablePanels || suitablePanels.length === 0) {
            // return a message in case we don't have suitable panels 
            const { value } = lmService.findNeedeText("not_found", [{ name: 'not_found', value: translatedPanel }]);

            const optimalParams = {
                required_power_kW: pv_power.toFixed(2),
                area_width: width.toFixed(2),
                area_length: length.toFixed(2)
            };

            return {
                answer: [[value], [optimalParams]],
                pv: { pv_type, optimalPVPlace, optimalPVOrientation, optimalPVAngle, pvElements, threeOptions: [] }
            };
        }

    } else {
        // розрахунок панелей на землі/пласкому даху
        // szymanski page 142-144
        // // data for formula from szymanski
        const { value: latitude } = lmService.applyPVDesignRuleToFacts("get_coeff", [{ name: "name", value: 'middle latitude' }]);
        const betaRad = optimalPVAngle * Math.PI / 180;
        const a = 90 - latitude - 23.45;
        const aRad = a * Math.PI / 180;

        suitablePanels = panels.map(panel => {
            const fittingResult = CalculatorService.getFittingPanelCountOnGround({
                panelWidth: panel.dimension.width,
                panelLength: panel.dimension.length,
                areaWidth: width * 1000,
                areaLength: length * 1000,
                distanceAmongPanels: distanceAmongPanels * 10,
                beta: betaRad,
                a: aRad
            });
            const { orientation, rows, cols, count, distance_between_rows } = fittingResult;

            // лекція стор. 17
            const totalPVPowerKw = (count * panel.maximum_power_w) / 1000;

            if (totalPVPowerKw > pv_power) {
                const cleanPanel = panel.toObject();
                return {
                    ...cleanPanel,
                    ...fittingResult,
                    max_pv_power_for_area_kW: totalPVPowerKw
                };
            }

            return null;
        }).filter(Boolean);

        if (!suitablePanels || suitablePanels.length === 0) {
            // return a message in case we don't have suitable panels 
            const { value } = lmService.findNeedeText("not_found", [{ name: 'not_found', value: translatedPanel }]);

            const optimalParams = {
                required_power_kW: pv_power.toFixed(2),
                area_width: width.toFixed(2),
                area_length: length.toFixed(2)
            };

            return {
                answer: [[value], [optimalParams]],
                pv: { pv_type, optimalPVPlace, optimalPVOrientation, optimalPVAngle, pvElements, threeOptions: [] }
            };
        }

    }

    // 3.3 find suitable panels to inverters
    const suitableInvertersWithPanels = suitableInverters.map(inverter => {

        const compatiblePanels = suitablePanels.map(panel => {
            const pannelConnectionType = CalculatorService.determinePanelConnectionType(panel, inverter);
            return {
                ...panel,
                ...pannelConnectionType
            };
        }).filter(Boolean);

        if (!compatiblePanels.length) {
            // return a message in case we don't have compatible panels for inverter
            const { value } = lmService.findNeedeText("not_found", [{ name: 'not_found', value: 'panels for inverter' }]);

            const optimalParams = {
                required_power_kW: pv_power,
                type: pv_type,
            };

            return {
                answer: [[value], [optimalParams]],
                pv: { pv_type, optimalPVPlace, optimalPVOrientation, optimalPVAngle, pvElements, threeOptions: [] }
            }
        };

        return { inverter, compatiblePanels };
    }).filter(Boolean);


    let suitableElements = [...suitableInvertersWithPanels];

    // 4 find charge if it's needed to PV type 
    if (pvElements[2]) {
        // 4.0.1 translate element type
        const { value: translatedCharge, history: answerTranslateChargeFact } = lmService.applyRule("translation", lmService.buildFacts({ name: pvElements[2] }));

        const charges = await dbService.findElementByName(translatedCharge, { available: true });

        suitableElements = suitableInvertersWithPanels.map(item => {
            const { inverter } = item;
            const suitableCharges = CalculatorService.getSuitableBatteryChargeCount({ inverter, charges });

            return {
                ...item,
                suitableCharges
            };
        });
    }

    // 6 create combination with all elements
    let combinations = CalculatorService.generateCombinations(suitableElements);

    if (pv_type === 'гібридна' || pv_type === 'автономна') {
        combinations = combinations.filter(element => element.charge);
    }

    // 6.1 Сортуємо за ціною
    const sortedCombinations = combinations.sort((a, b) => a.total_price - b.total_price);

    let threeOptions;
    if (sortedCombinations.length >= 3) {
        const middleIndex = Math.floor(sortedCombinations.length / 2);
        threeOptions = [sortedCombinations[0], sortedCombinations[middleIndex], sortedCombinations[sortedCombinations.length - 1]];
    } else {
        threeOptions = [...sortedCombinations];
    }

    // 4 insolation forecast for a year 
    const { value: systemEfficiency } = lmService.applyPVDesignRuleToFacts('get_coeff', [{ name: "name", value: 'middle PV system efficiency' }]);

    const threeOptionsWithForecast = threeOptions.map(option => {
        let insolation_forecast = [];
        monthRegionInsolationRange.map(monthInsolation => {
            insolation_forecast.push(Number((Number(option.total_power_kW) * systemEfficiency * monthInsolation * PEC).toFixed(2)));
        })
        const year_production = Number((yearRegionInsolation * (Number(option.total_power_kW)) * systemEfficiency * PEC).toFixed(2));

        return {
            ...option,
            insolation_forecast,
            year_production
        };
    });

    // console.log(pvExtraElements)

    // 7.0.1, 7.02, 7.03 translate 
    // const translatedExtraElements = [];

    // for (const elementName of pvExtraElements) {
    //     const facts = lmService.buildFacts({ name: elementName });

    //     const { value: translatedValue, history } = await lmService.applyRule("translation", facts);

    //     translatedExtraElements.push({
    //         original: elementName,
    //         translated: translatedValue,
    //         history
    //     });
    // }

    // console.log(translatedExtraElements);

    if (threeOptionsWithForecast.length === 0) {
        // add a message that we don't have suitable options for user
        const { value } = lmService.findNeedeText("no_options", [{ name: 'options', value: 'empty' }]);
        answerFromES.push([value]);
    }

    return { answer: answerFromES, pv: { pv_type, optimalPVPlace, optimalPVOrientation, optimalPVAngle, pvElements, options: threeOptionsWithForecast } };
}

// TODO: перевизначення наміру після заповнення поля або після відхилення від головного наміру
async function processUserInput(userInput, pv_user_data) {
    console.log("[INFO] process user input START:", pv_user_data);

    const nerEntities = await Helpers.extractEntitiesFromText(userInput);
    let { intent, originalIntent } = await UserIntentService.determineUserIntent(userInput, pv_user_data, nerEntities);

    let param;
    if (intent.includes("впевненість")) {
        param = intent;
        pv_user_data["intent"] = originalIntent;

        console.log("якщо є певність то отримуємо or_intent: ", pv_user_data["intent"], originalIntent)
    } else {
        pv_user_data["intent"] = intent;
    }

    let answer, updated_user_data;

    switch (pv_user_data["intent"]) {
        case "визначити потужність":
            ({ answer, updated_user_data } = await AssistantService.handlePowerIntent(userInput, pv_user_data, nerEntities));
            break;

        case "визначити площу СЕС":
            ({ answer, updated_user_data } = await AssistantService.handleAreaIntent(userInput, pv_user_data, nerEntities));
            break;

        case "визначити місце монтажу":
            ({ answer, updated_user_data } = await AssistantService.handlePlaceIntent(userInput, pv_user_data, nerEntities));
            break;

        case "визначити автономність":
            ({ answer, updated_user_data } = await AssistantService.handleConfidanceIntent(userInput, pv_user_data, param, "autonomy"));
            break;

        case "визначити фінансові можливості":
            ({ answer, updated_user_data } = await AssistantService.handleConfidanceIntent(userInput, pv_user_data, param, "finance"));
            break;

        case "визначити можливість підключення на е-мережі":
            ({ answer, updated_user_data } = await AssistantService.handleConfidanceIntent(userInput, pv_user_data, param, "power grid"));
            break;

        case "визначити місцевість":
            // ({ answer, updated_user_data } = await AssistantService.handleAutonomyIntent(param, pv_user_data));
            break;

        case "визначити нахил":
            // ({ answer, updated_user_data } = await AssistantService.handleAutonomyIntent(param, pv_user_data));
            break;

        case "визначити орієнтацію":
            // ({ answer, updated_user_data } = await AssistantService.handleAutonomyIntent(param, pv_user_data));
            break;

        case "інформація":
            answer = await AssistantService.giveInformationFromKB(nerEntities, userInput, pv_user_data);
            updated_user_data = { ...pv_user_data };
            break;

        case 'привітання':
            answer = "Привіт.";
            updated_user_data = { ...pv_user_data };
            break;

        // case 'прощання':
        //     answer = "Бувай";
        //     updated_user_data = { ...pv_user_data };
        //     break;

        default:
            answer = "Вибач, я тебе не зрозумів.";
            updated_user_data = { ...pv_user_data };
            break;
    }

    let context;

    // UPDATE USER INTENT AND ORIGINAL INTENT
    if (pv_user_data["intent"] !== originalIntent) {
        // відновлюємо оригінальний намір від системи і задаємо питання про нього
        console.log("відпрацьовує, якщо користувач змінив намір особисто");
        // console.log(intent, originalIntent)
        updated_user_data['intent'] = originalIntent;
        context = 'Задай питання щоб визначити значення у намірі користувача, що записаний в intent';
        const question = await AssistantService.createNextQuestion(updated_user_data, context);
        answer = answer + " " + question;

    } else {
        // намір не змінювався, тому від питання системи змінюємо намір і оригінальний намір
        const isUserDataChanged = Helpers.checkIfUserDataChanged(pv_user_data, updated_user_data);
        // console.log("відпрацьовує, якщо намір залишився сталим. чи змінилися дані?", isUserDataChanged);
        if (isUserDataChanged) {
            updated_user_data['intent'] = '';
            updated_user_data = UserIntentService.changeOriginalIntent(updated_user_data, '');

            context = 'Задай 1 питання до користувача щодо 1 параметра СЕС,що залишилися незаповненими в обʼєкті pv_user_data.'
        } else {

            context = 'Задай питання щоб визначити значення у намірі користувача, що записаний в intent';
        }

        const question = await createNextQuestion(updated_user_data, context);
        answer = answer + " " + question;
        updated_user_data = await UserIntentService.changeUserIntentFromSystem(answer, updated_user_data);
    }

    console.log("[INFO] process user input END:", updated_user_data);

    return { answer, updated_user_data };
}

export const ExpertSystemService = {
    sendFirstMesssage,
    determinationPVtype,
    createPVdesign,
    processUserInput
}

