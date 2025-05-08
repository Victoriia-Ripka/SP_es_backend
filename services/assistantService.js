import { Helpers } from '../helpers/index.js';
import { UserIntentService } from './userIntentService.js'
import { KBService } from './knowledgeBaseService.js'
import { LogicalMachineService } from './logicalMachineService.js';
import { DBService } from './dataBaseService.js';
import { CalculatorService } from './calculatorService.js';
import fs from 'fs';
import path from 'path';

const lmService = new LogicalMachineService();
const kbSerice = new KBService();
const dbService = new DBService();

const insolationFile = JSON.parse(fs.readFileSync(path.resolve('./knowledge_base/insolation.json'), 'utf8'));

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
    const answer = `Привіт. Я є експертною системою для проєктування СЕС. Заповни дані в таблиці збоку для визначення типу СЕС і запроєктування СЕС для тебе. Якщо у тебе будуть якісь питання - звертайся.`;
    return { answer, pv_user_data: started_pv_user_data };
}

function determinationPVtype(electric_autonomy, electricity_grid_connection, money_limit) {
    const { type, message: rule } = lmService.determinePVtype(electric_autonomy, electricity_grid_connection, money_limit);
    return { type, rule };
}

// TOFIX: why answers added to each others
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

    // 1.1
    const pvTypesData = kbSerice.getKnowledge("СЕС", "види");
    const pvElements = pvTypesData[pv_type]["елементи системи"];
    const pvExtraElements = pvTypesData[pv_type]["додаткові елементи системи"];

    // 1.2
    const regionInsolationData = insolationFile[pv_location];
    const yearRegionInsolation = regionInsolationData["рік"];
    const monthRegionInsolationRange = regionInsolationData["по місяцям"];

    // 2.1 check optimal PV instalation place
    const placeFacts = lmService.buildFacts({ pv_instalation_place, pv_power });
    const { value: optimalPVPlace, history: installationPlaceHistory } = lmService.applyRule("instalation_place", placeFacts);
    answerFromES.push(installationPlaceHistory);

    if (optimalPVPlace === 'земля' && pv_instalation_place === 'дах') {
        const errorAnswer = [installationPlaceHistory, ['Вкажіть довжину і ширину ділянки під фотопанелі на землі.']]
        return {
            answer: errorAnswer, pv: {
                pv_type, optimalPVPlace: null, optimalPVOrientation: null, optimalPVAngle: null, pvElements, threeOptions: []
            }
        }
    }

    // 2.2.1
    // Optimal orientation
    const orientationFacts = lmService.buildFacts({ place: pv_instalation_place, roof_orientation });
    const { value: optimalPVOrientation, history: orientationHistory } = lmService.applyRule("choosing_optimal_orientation", orientationFacts, "roof_orientation", roof_orientation);
    if (!optimalPVOrientation) {
        return {
            answer: orientationHistory,
            pv: {
                pv_type, optimalPVPlace, optimalPVOrientation: null, optimalPVAngle: null, pvElements, threeOptions: []
            }
        };
    }
    answerFromES.push(orientationHistory);

    // 2.2.2 Optimal tilt angle
    const angleFacts = lmService.buildFacts({ place: pv_instalation_place, roof_tilt });
    const { value: optimalPVAngle, history: angleHistory } = lmService.applyRule("set_optinal_angle", angleFacts, "roof_tilt", roof_tilt);
    answerFromES.push(angleHistory);

    // 2.2.3 PEC calculation
    const PEC = lmService.determinePEC(optimalPVAngle, Math.abs(180 - optimalPVOrientation));
    console.log("PEC: ", PEC);
    console.log(pvElements)

    // 3.0.1 translate element type (e.g. 'інвертор' → 'inverters')
    const { value: translatedInvertor, history: answerTranslateInvertorFact } = lmService.applyRule("translation", lmService.buildFacts({ name: pvElements[0] }));

    // 3.0.2 translate PV type (e.g. 'мережева' → 'on-grid')
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
        const optimalParams = {
            required_power_kW: pv_power,
            type: pv_type,
        };

        return {
            answer: [["У моїй БД не знайдено відповідного інвертора. Змініть параметри, якщо це можливо"], [{ optimalParams }]],
            pv: { pv_type, optimalPVPlace, optimalPVOrientation, optimalPVAngle, pvElements, threeOptions: [] }
        };
    }

    // 3.2 find suitable panels to pv_power
    const { value: translatedPanel, history } = lmService.applyRule("translation", lmService.buildFacts({ name: pvElements[1] }));
    const panels = await dbService.findElementByName(translatedPanel, { model: "LR5-54HTH-435M", available: true });

    const voltageMargin = 0.9;
    
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
            const optimalParams = {
                required_power_kW: pv_power.toFixed(2),
                area_width: width.toFixed(2),
                area_length: length.toFixed(2)
            };

            return {
                answer: [["Не знайдено відповідних фотопанелей до СЕС. Змініть параметри, якщо це можливо"], [optimalParams]],
                pv: { pv_type, optimalPVPlace, optimalPVOrientation, optimalPVAngle, pvElements, threeOptions: [] }
            };
        }

    } else {
        // розрахунок панелей на землі (пласкому даху)
        // szymanski page 142-144
        // // data for formula from szymanski
        const latitude = 48;
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
            const optimalParams = {
                required_power_kW: pv_power.toFixed(2),
                area_width: width.toFixed(2),
                area_length: length.toFixed(2)
            };

            return {
                answer: [["Не знайдено відповідних фотопанелей до СЕС. Змініть параметри, якщо це можливо"], [optimalParams]],
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
            const optimalParams = {
                required_power_kW: pv_power,
                type: pv_type,
            };
            return {
                answer: [["У моїй БД не знайдено фотопанелей, що підходили б до потрібних інверторів. Змініть параметри, якщо це можливо"], [optimalParams]],
                pv: { pv_type, optimalPVPlace, optimalPVOrientation, optimalPVAngle, pvElements, threeOptions: [] }
            }
        };

        return { inverter, compatiblePanels };
    }).filter(Boolean);

    // 4.0.1 translate element type
    const { value: translatedCharge, history: answerTranslateChargeFact } = lmService.applyRule("translation", lmService.buildFacts({ name: pvElements[2] }));

    let suitableElements = [...suitableInvertersWithPanels]

    // 4 find charge if it's needed to PV type 
    if (pvElements[2]) {
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

    // 5 create combination with all elements
    let combinations = CalculatorService.generateCombinations(suitableElements);

    if (pv_type === 'гібридна' || pv_type === 'автономна') {
        combinations = combinations.filter(element => element.charge);
    }

    // 5.1 Сортуємо за ціною
    const sortedCombinations = combinations.sort((a, b) => a.total_price - b.total_price);

    let threeOptions;
    if (sortedCombinations.length >= 3) {
        const middleIndex = Math.floor(sortedCombinations.length / 2);
        threeOptions = [sortedCombinations[0], sortedCombinations[middleIndex], sortedCombinations[sortedCombinations.length - 1]];
    } else {
        threeOptions = [...sortedCombinations]
    }

    const systemEfficiency = 0.8

    // 7 insolation forecast for a year 
    const threeOptionsWithForecast = threeOptions.map(option => {
        let insolation_forecast = []
        monthRegionInsolationRange.map(monthInsolation => {
            insolation_forecast.push(Number((Number(option.total_power_kW) * systemEfficiency * monthInsolation * PEC).toFixed(2)))
        })
        const year_production = Number((yearRegionInsolation * (Number(option.total_power_kW)) * systemEfficiency * PEC).toFixed(2))

        return {
            ... option,
            insolation_forecast,
            year_production
        }
    })

    // console.log(pvExtraElements)

    // 6.0.1, 6.02, 6.03 translate 
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
            ({ answer, updated_user_data } = await handlePowerIntent(userInput, pv_user_data, nerEntities));
            break;

        case "визначити площу СЕС":
            ({ answer, updated_user_data } = await handleAreaIntent(userInput, pv_user_data, nerEntities));
            break;

        case "визначити місце монтажу":
            ({ answer, updated_user_data } = await handlePlaceIntent(userInput, pv_user_data, nerEntities));
            break;

        case "визначити автономність":
            ({ answer, updated_user_data } = await handleConfidanceIntent(userInput, pv_user_data, param, "autonomy"));
            break;

        case "визначити фінансові можливості":
            ({ answer, updated_user_data } = await handleConfidanceIntent(userInput, pv_user_data, param, "finance"));
            break;

        case "визначити можливість підключення на е-мережі":
            ({ answer, updated_user_data } = await handleConfidanceIntent(userInput, pv_user_data, param, "power grid"));
            break;

        case "визначити місцевість":
            // ({ answer, updated_user_data } = await handleAutonomyIntent(param, pv_user_data));
            break;

        case "визначити нахил":
            // ({ answer, updated_user_data } = await handleAutonomyIntent(param, pv_user_data));
            break;

        case "визначити орієнтацію":
            // ({ answer, updated_user_data } = await handleAutonomyIntent(param, pv_user_data));
            break;

        case "інформація":
            answer = await giveInformationFromKB(nerEntities, userInput, pv_user_data);
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
        const question = await createNextQuestion(updated_user_data, context);
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

// SECTION HANDLE INTENTS START

// function handle визначити потужність СЕС
// TODO: можливість обробляти Вт у кВт
// TODO: third option with KB
async function handlePowerIntent(userInput, pv_user_data, nerEntities) {
    const content = 'Якщо повідомлення користувача містить число (цифрами або словами) - поверни true. Інакше поверни false. Поверни тільки "true" або "false".'
    const processedIsANumber = await Helpers.processInputWithGPT(content, userInput);

    let answer, updated_user_data;

    if (processedIsANumber === 'true') {
        // перевірка на одиниці вимірювання
        const includesCorrectUnits = Helpers.isCorrectMeasureUnits(nerEntities, ["Вт", "кВт", "вт", "квт"])
        if (!includesCorrectUnits) {
            answer = "Для визначення потужності потрібні дані у Вт або кВт"
            return { answer, updated_user_data: pv_user_data }
        }

        // TODO: вийняти число, що написано словами в pvPower
        const pvPower = Helpers.extractNumber(userInput);

        if (pvPower > 0 && pvPower <= 15) {
            answer = `Потужність СЕС визначена як ${pvPower} кВт.`;
            updated_user_data = rewritePVUserData(pv_user_data, pvPower, "pv_power");
        } else {
            answer = "Я можу запропонувати СЕС тільки до 15кВт.";
            updated_user_data = { ...pv_user_data };
        }

    } else {
        // TODO: додати логіку (так само як у handleAreaIntent)
        answer = "third else.";
        updated_user_data = { ...pv_user_data };
        console.log("third option: ", answer, updated_user_data);
    }

    return { answer, updated_user_data };
}

// function handle визначити площу СЕС
// TODO: додати можливість обробляти різні одиниці вимірювання
// TODO: third option with KB
async function handleAreaIntent(userInput, pv_user_data, nerEntities) {
    const content = 'Якщо повідомлення користувача містить число (цифрами або словами) - поверни true. Інакше поверни false. Поверни тільки "true" або "false".'
    const processedIsANumber = await Helpers.processInputWithGPT(content, userInput);

    let answer, updated_user_data;

    if (processedIsANumber === 'true') {
        // перевірка на одиниці вимірювання
        const includesCorrectUnits = Helpers.isCorrectMeasureUnits(nerEntities, ["м2", "м 2", "м кв", "ар", "ари"])
        if (!includesCorrectUnits) {
            answer = "Для визначення площі СЕС потрібні дані у відповідних одиницях вимірювання (наприклад: м кв)."
            return { answer, updated_user_data: pv_user_data }
        }

        const pvArea = Helpers.extractNumber(userInput);

        if (pvArea > 0) {
            answer = `Площа під монтаж СЕС визначена як ${pvArea} м кв.`;
            updated_user_data = rewritePVUserData(pv_user_data, pvArea, "pv_area");
        } else {
            answer = "Площа повинна бути додатня.";
            updated_user_data = { ...pv_user_data };
        }

    } else {
        // TODO: додати логіку (так само як у handlePowerIntent)
        answer = "third else";
        updated_user_data = { ...pv_user_data };
        console.log("third option: ", answer, updated_user_data);
    }

    return { answer, updated_user_data };
}

// TODO: third option with KB
async function handlePlaceIntent(userInput, pv_user_data, nerEntities) {
    const placeEnt = nerEntities.find(item => item.label === 'місце монтажу');

    let answer, updated_user_data;

    if (placeEnt) {
        const context = 'Опрацюй текст таким чином, щоб повернути тільки "дах" або "земля". Біля будинку означає на землі. Нічого більше не пиши.';
        const processedPlace = await Helpers.processInputWithGPT(context, placeEnt.text);
        answer = `Місце монтажу визначено як ${processedPlace}.`;
        updated_user_data = rewritePVUserData(pv_user_data, processedPlace, "pv_instalation_place");
    } else {
        // TODO: додати логіку (так само як у handlePowerIntent)
        answer = "назва більш конкретно місце монтажу";
        updated_user_data = { ...pv_user_data };
        console.log("third option: ", answer, updated_user_data);
    }

    return { answer, updated_user_data };
}

const answerDataSet = {
    finance: {
        "pv_data_field": "is_exist_money_limit",
        "true": "Фінансові можливості вказані як 'обмежені'.",
        "false": "Фінансові можливості вказані як 'необмежені'.",
        "neutral": "Чи у вас є обмежені фінансові можливості? "
    },
    "power grid": {
        "pv_data_field": "is_possible_electricity_grid_connection",
        "true": "Можливість підключення до е-мережі вказана як 'можлива'.",
        "false": "Можливість підключення до е-мережі вказана як 'неможлива'.",
        "neutral": "Чи є у Вас можливість підключення до електромережі? "
    },
    autonomy: {
        "pv_data_field": "is_electric_autonomy_important",
        "true": "Авномомність енергетичної системи вказана як 'важлива'.",
        "false": "Авномомність енергетичної системи вказана як 'неважлива'.",
        "neutral": "Чи вам важливо мати автономну електричну систему? "
    }
}

// TODO: connect to KB (field: PV, aspect: finance)
// TOFIX: prompt to GPT
async function handleConfidanceIntent(userInput, pv_user_data, param, field) {
    let answer, updated_user_data;

    if (!param) {
        const context = "Опрацюй текст тачим чином, щоб повернути 'позитивна впевненість', 'негативна впевненість' або 'нейтральна впевненість'. Поверни тільки рядок з двох слів."
        param = await Helpers.processInputWithGPT(context, userInput);
        console.log("param from GPT: ", param);
    }

    if (param === 'позитивна впевненість') {
        answer = answerDataSet[field]["true"];
        updated_user_data = rewritePVUserData(pv_user_data, true, answerDataSet[field]["pv_data_field"]);
    } else if (param === 'негативна впевненість') {
        answer = answerDataSet[field]["false"];
        updated_user_data = rewritePVUserData(pv_user_data, false, answerDataSet[field]["pv_data_field"]);
    } else if (param === 'нейтральна впевненість') {
        // TODO: connect to KB (field: PV, aspect: finance)
        answer = answerDataSet[field]["neutral"];
        updated_user_data = { ...pv_user_data };
    }

    return { answer, updated_user_data }
}

const questionExamples = {
    pv_power: "Яка потужність СЕС вам необхідна?",
    pv_instalation_place: "Де ви хочете розмістити фотопанелі?",
    pv_area: "Яка площа поверхні доступна для монтажу фотопанелей? ",
    is_electric_autonomy_important: "Чи енергетична незалежність від е-мережі для вас є важливою? (питання так/ні)",
    is_possible_electricity_grid_connection: "Чи у вас є можливість підключитися до е-мережі? (питання так/ні)",
    is_exist_money_limit: "Чи ви маєте бюджетний ліміт? (питання так/ні)",
}

// function керує напрямок розмови далі
// TODO: якщо вже все заповнено?
async function createNextQuestion(pv_user_data, context) {
    context += "Для створення питання опирайся на приклади: " + JSON.stringify(questionExamples)
    const response = await Helpers.processInputWithGPT(context, JSON.stringify(pv_user_data))
    return response
}
// SECTION END


function rewritePVUserData(pv_user_data, value, fieldName) {
    return {
        ...pv_user_data,
        [fieldName]: value
    };
}

async function giveInformationFromKB(nerEntities, userInput, pv_user_data) {
    let field = '';
    let detail = '';

    nerEntities.forEach(entity => {
        if (entity.label === "СЕС") {
            field = entity.label;
        } else if (entity.label === "характеристика") {
            detail = entity.text;
        }
    });

    let answer;

    if (!field) {
        field = KBService.getLastField(pv_user_data);

        if (!field) {
            answer = "Не знайдено основне поле для бази знань (наприклад, СЕС)."
            return answer;
        }
    }

    const knowledge = KBService.getKnowledge(field, detail);
    console.log("!!! knowledge: ", knowledge);
    const instructions = Helpers.createInstruction(pv_user_data, knowledge);
    answer = await Helpers.getOpenAIResponse(instructions, userInput);

    return answer;
}

export const assistantService = {
    processUserInput,
    sendFirstMesssage,
    determinationPVtype,
    createPVdesign
};

