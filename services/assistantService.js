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
    return { answer, updated_user_data: pv_user_data };
}

// TODO: перевизначення наміру після заповнення поля або після відхилення від головного наміру
async function processUserInput(userInput, pv_user_data) {
    console.log("[INFO] process user input START:", pv_user_data);

    const nerEntities = await extractEntitiesFromText(userInput);
    let { intent, originalIntent } = await determineUserIntent(userInput, pv_user_data, nerEntities);

    pv_user_data["intent"] = intent;

    // let param;
    // if (intent === "впевненість") {
    //     // {intent, param} = 
    //     //  parametr = intent(впевненість), intent = original_intent
    // }

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
            ({ answer, updated_user_data } = await handleAutonomyIntent(param, pv_user_data));
            break;

        case "визначити фінансові можливості":
            // ({ answer, updated_user_data } = await handleAreaIntent(userInput, pv_user_data));
            break;

        case "визначити можливість підключення на е-мережі":
            // ({ answer, updated_user_data } = await handleAreaIntent(userInput, pv_user_data));
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

    // UPDATED_USER_DATA
    if(intent !== originalIntent){
        console.log("відпрацьовує, якщо користувач змінив намір особисто");
        updated_user_data['intent'] = originalIntent;
        context = 'Задай питання щоб визначити значення у намірі користувача, що записаний в intent';
    } else {
        
        const isUserDataChanged = checkIfUserDataChanged(pv_user_data, updated_user_data);
        console.log("відпрацьовує, якщо намір залишився сталим. чи змінилися дані?", isUserDataChanged);
        if(isUserDataChanged){
            updated_user_data['intent'] = '';
            updated_user_data = changeOriginalIntent(updated_user_data, '');
            context = 'Задай 1 питання до користувача щодо 1 параметра СЕС,що залишилися незаповненими в обʼєкті.'
        } else {
            context = 'Задай питання щоб визначити значення у намірі користувача, що записаний в intent';
        }
    }

    const question = await createNextQuestion(updated_user_data, context);
    answer = answer + " " + question;
    updated_user_data = await changeUserIntentFromSystem(answer, updated_user_data); 

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
        const context = 'Опрацюй текст таким чином, щоб повернути тільки "дах" або "земля". Нічого більше не пиши';
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

async function handleAutonomyIntent(param, pv_user_data) {
    // const place = nerEntities.find(item => item.label === 'місце монтажу');

    // let answer, updated_user_data;

    // if (place) {


    //     answer = `Місце монтажу визначено як ${processedPlace}.`;
    //     updated_user_data = rewritePVUserData(pv_user_data, processedPlace, "pv_instalation_place");
    //     updated_user_data["intent"] = '';
    //     updated_user_data = changeOriginalIntent(updated_user_data, "");


    // } else {
    //     // TODO: додати логіку (так само як у handlePowerIntent)
    //     answer = "назва більш конкретно місце монтажу";
    //     updated_user_data = { ...pv_user_data };
    //     console.log("third option: ", answer, updated_user_data)
    // }
    const answer = ''
    const updated_user_data = ''

    return { answer, updated_user_data };
}

// function керує напрямок розмови далі
// TOFIX: якщо вже все заповнено?
// TOFIX: спиратися на original_intent 
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

