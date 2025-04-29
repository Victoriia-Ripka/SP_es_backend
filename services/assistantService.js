import {
    processInputWithGPT,
    getOpenAIResponse,
    createInstruction,
    extractEntitiesFromText,
    extractNumber,
    isCorrectMeasureUnits,
    checkIfUserDataChanged
} from '../helpers/index.js';
import { getKnowledge, getLastField } from './knowledgeBaseService.js';
import { determineUserIntent, changeUserIntentFromSystem, changeOriginalIntent } from './userIntentService.js'


function sendFirstMesssage(pv_user_data) {
    const answer = `Привіт. Я є експертною системою для проєктування СЕС. Яка потужність СЕС тобі потрібна?`;
    pv_user_data["intent"] = 'визначити потужність';
    pv_user_data["cache"] = {
        history: [
            {
                "field": "СЕС",
                "detail": "потужність"
            }
        ],
        original_intent: pv_user_data["intent"]
    }
    // const answer = `Привіт. Я є експертною системою для проєктування СЕС. Чи важлива для тебе фінансова складова проєктування системи?`;
    // pv_user_data["intent"] = 'визначити фінансові можливості';
    // pv_user_data["cache"] = {
    //     history: [ ],
    //     original_intent: pv_user_data["intent"]
    // }
    return { answer, updated_user_data: pv_user_data };
}

// TODO: перевизначення наміру після заповнення поля або після відхилення від головного наміру
async function processUserInput(userInput, pv_user_data) {
    console.log("[INFO] process user input START:", pv_user_data);

    const nerEntities = await extractEntitiesFromText(userInput);
    let { intent, originalIntent } = await determineUserIntent(userInput, pv_user_data, nerEntities);

    let param;
    if (intent.includes("впевненість")) {
        param = intent;
        pv_user_data["intent"] = originalIntent;

        console.log("якщо є певність то отримуємо or_intent: ", pv_user_data["intent"], originalIntent)
    }else {
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
        const isUserDataChanged = checkIfUserDataChanged(pv_user_data, updated_user_data);
        // console.log("відпрацьовує, якщо намір залишився сталим. чи змінилися дані?", isUserDataChanged);
        if (isUserDataChanged) {
            updated_user_data['intent'] = '';
            updated_user_data = changeOriginalIntent(updated_user_data, '');

            context = 'Задай 1 питання до користувача щодо 1 параметра СЕС,що залишилися незаповненими в обʼєкті.'
        } else {

            context = 'Задай питання щоб визначити значення у намірі користувача, що записаний в intent';
        }

        const question = await createNextQuestion(updated_user_data, context);
        answer = answer + " " + question;
        updated_user_data = await changeUserIntentFromSystem(answer, updated_user_data);
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
    const processedIsANumber = await processInputWithGPT(content, userInput);

    let answer, updated_user_data;

    if (processedIsANumber === 'true') {
        // перевірка на одиниці вимірювання
        const includesCorrectUnits = isCorrectMeasureUnits(nerEntities, ["Вт", "кВт", "вт", "квт"])
        if (!includesCorrectUnits) {
            answer = "Для визначення потужності потрібні дані у Вт або кВт"
            return { answer, updated_user_data: pv_user_data }
        }

        // TODO: вийняти число, що написано словами в pvPower
        const pvPower = extractNumber(userInput);

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
    const processedIsANumber = await processInputWithGPT(content, userInput);

    let answer, updated_user_data;

    if (processedIsANumber === 'true') {
        // перевірка на одиниці вимірювання
        const includesCorrectUnits = isCorrectMeasureUnits(nerEntities, ["м2", "м 2", "м кв", "ар", "ари"])
        if (!includesCorrectUnits) {
            answer = "Для визначення площі СЕС потрібні дані у відповідних одиницях вимірювання (наприклад: м кв)."
            return { answer, updated_user_data: pv_user_data }
        }

        const pvArea = extractNumber(userInput);

        if (pvArea > 0) {
            answer = `Площа під монтаж СЕС визначена як ${pvArea} м кв.`;
            updated_user_data = rewritePVUserData(pv_user_data, pvArea, "pv_square");
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
        const processedPlace = await processInputWithGPT(context, placeEnt.text);
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
async function handleConfidanceIntent(userInput, pv_user_data, param, field ) {
    let answer, updated_user_data;

    if(!param){
        const context = "Опрацюй текст тачим чином, щоб повернути 'позитивна впевненість', 'негативна впевненість' або 'нейтральна впевненість'. Поверни тільки рядок з двох слів."
        param = await processInputWithGPT(context, userInput);
        console.log("param from GPT: ", param);
    }
    
    if(param === 'позитивна впевненість'){
        answer = answerDataSet[field]["true"];
        updated_user_data = rewritePVUserData(pv_user_data, true, answerDataSet[field]["pv_data_field"]);
    } else if(param === 'негативна впевненість'){
        answer = answerDataSet[field]["false"];
        updated_user_data = rewritePVUserData(pv_user_data, false, answerDataSet[field]["pv_data_field"]);
    } else if(param === 'нейтральна впевненість'){
        // TODO: connect to KB (field: PV, aspect: finance)
        answer = answerDataSet[field]["neutral"];
        updated_user_data = {...pv_user_data};
    }

    return {answer, updated_user_data}
}

// function керує напрямок розмови далі
// TODO: задавати кращі питання для визначення параметрів
// TOFIX: якщо вже все заповнено?
//     pv_power: 0,
//     pv_square: 0,
//     pv_instalation_place: "",
//     is_electric_autonomy_important: "",
//     is_possible_electricity_grid_connection: "",
//     is_exist_money_limit: "",
async function createNextQuestion(pv_user_data, context) {
    const response = await processInputWithGPT(context, JSON.stringify(pv_user_data))
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
        field = getLastField(pv_user_data);

        if (!field) {
            answer = "Не знайдено основне поле для бази знань (наприклад, СЕС)."
            return answer;
        }
    }

    const knowledge = getKnowledge(field, detail);
    console.log("!!! knowledge: ", knowledge);
    const instructions = createInstruction(pv_user_data, knowledge);
    answer = await getOpenAIResponse(instructions, userInput);

    return answer;
}

export {
    processUserInput,
    sendFirstMesssage
};

