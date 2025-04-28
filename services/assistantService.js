import { textcatExamples } from '../config/config.js'
import {
    extractIntentFromSystemText,
    processInputWithGPT,
    getOpenAIResponse,
    verifyNumberOrString,
    isUnknownAnswer,
    createInstruction,
    transformStringToNumber,
    extractEntitiesFromText,
    extractIntentFromText,
    extractNumber
} from '../helpers/index.js';
import { getKnowledge } from './knowledgeBaseService.js';


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

// TODO: обробка чисел
async function processUserInput(userInput, pv_user_data) {
    console.log("process user input START:", pv_user_data)

    const nerEntities = await extractEntitiesFromText(userInput);
    const { intent, originalIntent } = await determineUserIntent(userInput, pv_user_data, nerEntities);

    pv_user_data = changeOriginalIntent(pv_user_data, originalIntent)

    let answer, updated_user_data;

    switch (intent) {
        case "визначити потужність":
            ({ answer, updated_user_data } = await handlePowerIntent(userInput, pv_user_data, nerEntities));
            break;

        case "визначити площу СЕС":
            ({ answer, updated_user_data } = await handleAreaIntent(userInput, pv_user_data));
            break;

        case "визначити тип СЕС":
            // ({ answer, updated_user_data } = await handleAreaIntent(userInput, pv_user_data));
            break;

        case "визначити місце монтажу":
            ({ answer, updated_user_data } = await handlePlaceIntent(userInput, pv_user_data, nerEntities));
            break;

        case "інформація":
            answer = await giveInformationFromKB(nerEntities, userInput, pv_user_data);
            updated_user_data = pv_user_data;
            break;

        case 'привітання':
            answer = "Привіт.";
            updated_user_data = pv_user_data;
            break;

        // case 'прощання':
        //     answer = "Бувай";
        //     updated_user_data = pv_user_data;
        //     break;

        default:
            answer = "Вибач, я тебе не зрозумів.";
            updated_user_data = pv_user_data;
            break;
    }

    const question = await createNextQuestion(pv_user_data);
    answer = answer + " " + question;
    updated_user_data = await changeUserIntentFromSystem(answer, pv_user_data);

    console.log("process user input END:", updated_user_data);

    return { answer, updated_user_data };
}


// INTENT SECTION START
// Function to determine user intent
async function determineUserIntent(userInput, pv_user_data, nerEntities) {
    let intent = pv_user_data["intent"];
    let originalIntent = pv_user_data["intent"];

    const newIntentFromUserInput = (await changeUserIntention(userInput, pv_user_data, nerEntities));

    if (newIntentFromUserInput !== originalIntent) {
        intent = newIntentFromUserInput;
    }

    return { intent, originalIntent };
}

// function змінює інтенцію
async function changeUserIntention(userInput, pv_user_data, nerEntities) {
    if (isUnknownAnswer(nerEntities)) {
        // Якщо користувач не знає — залишаємо попередній намір
        console.log("User answered 'unknown', keeping previous intent:", pv_user_data["intent"]);
        return pv_user_data["intent"];
    }

    const newIntent = await extractIntentFromText(userInput);
    return newIntent;
}

// Функція для зміни наміру на основі відповіді системи
async function changeUserIntentFromSystem(answer, pv_user_data) {
    const possibleNewIntent = await extractIntentFromSystemText(answer);

    // Якщо визначився новий намір, оновлюємо pv_user_data
    if (possibleNewIntent && possibleNewIntent !== pv_user_data["intent"]) {
        return { ...pv_user_data, intent: possibleNewIntent };
    }

    pv_user_data = changeOriginalIntent(pv_user_data, pv_user_data["intent"]);
    return pv_user_data;
}

function getOriginalIntent(pv_user_data) {
    return pv_user_data.cache.original_intent || '';
}

function changeOriginalIntent(pv_user_data, newOriginalIntent) {
    pv_user_data.cache.original_intent = newOriginalIntent;
    return pv_user_data;
}
// INTENT SECTION END


// SECTION HANDLE INTENTS START
// function handle визначити потужність СЕС
// TODO: кВт і Вт
// перевірка ОДИНИЦЬ ВИМІРЮВАННЯ кВт
async function handlePowerIntent(userInput, pv_user_data, nerEntities) {
    const content = 'Якщо повідомлення користувача містить число (цифрами або словами) - поверни true. Інакше поверни false. Поверни тільки "true" або "false".'
    const processedIsANumber = await processInputWithGPT(content, userInput);

    let answer, updated_user_data;

    if (processedIsANumber === 'true') {
        const pvPower = extractNumber(userInput);

        if (pvPower > 0 && pvPower <= 15) {
            answer = `Потужність СЕС визначена як ${pvPower} кВт.`;
            updated_user_data = await rewritePVUserData(pv_user_data, pvPower, "pv_power");
            updated_user_data = changeOriginalIntent(updated_user_data, "")
        } else {
            answer = "Я можу запропонувати СЕС тільки до 15кВт.";
            updated_user_data = pv_user_data;
        }

    } else {
        // TODO: додати логіку (так само як у handleAreaIntent)
        answer = "third else.";
        updated_user_data = pv_user_data;
        console.log("third option: ", answer, updated_user_data)
    }

    return { answer, updated_user_data };
}

// function handle визначити площу СЕС
async function handleAreaIntent(userInput, pv_user_data) {
    const content = 'Якщо повідомлення користувача містить число (цифрами або словами) - поверни true. Інакше поверни false. Поверни тільки "true" або "false".'
    const processedIsANumber = await processInputWithGPT(content, userInput);

    let answer, updated_user_data;

    if (processedIsANumber === 'true') {
        const pvArea = extractNumber(userInput);

        if (pvArea > 0) {
            answer = `Площа під монтаж СЕС визначена як ${pvArea} м кв.`;
            updated_user_data = await rewritePVUserData(pv_user_data, pvArea, "pv_square");
            updated_user_data = changeOriginalIntent(updated_user_data, "")
        } else {
            answer = "Площа повинна бути додатня.";
            updated_user_data = pv_user_data;
        }

    } else {
        // TODO: додати логіку (так само як у handlePowerIntent)
        answer = "third else";
        updated_user_data = pv_user_data;
        console.log("third option: ", answer, updated_user_data)
    }

    return { answer, updated_user_data };
}

async function handlePlaceIntent(userInput, pv_user_data, nerEntities) {
    const place = nerEntities.find(item => item.label === 'місце монтажу');

    console.log("HANDLE PLACE", place);

    let answer, updated_user_data;

    if (place) {
        const context = 'Опрацюй текст таким чином, щоб повернути тільки "дах" або "земля". Нічого більше не пиши';
        const processedPlace = await processInputWithGPT(context, place.text);

        console.log("processedPlace after GPT: ", processedPlace);

        answer = `Місце монтажу визначено як ${processedPlace}.`;
        updated_user_data = await rewritePVUserData(pv_user_data, processedPlace, "pv_instalation_place");
        updated_user_data = changeOriginalIntent(updated_user_data, "")


    } else {
        // TODO: додати логіку (так само як у handlePowerIntent)
        answer = "назва більш конкретно місце монтажу";
        updated_user_data = pv_user_data;
        console.log("third option: ", answer, updated_user_data)
    }

    return { answer, updated_user_data };
}

// function керує напрямок розмови далі
// TOFIX: якщо вже все заповнено?
// TOFIX: спиратися на original_intent
async function createNextQuestion(pv_user_data) {
    const content = 'Задай 1 питання до користувача щодо СЕС якщо залишилися незаповнені поля на обʼєкті. Задай питання до наміру користувача original_intent. Якщо original_intent, тоді задай тільки 1 питання щодо 1 незаповненої властивості. '
    const response = await processInputWithGPT(content, JSON.stringify(pv_user_data))
    return response
}
// SECTION END




async function rewritePVUserData(pv_user_data, value, property) {
    pv_user_data[property] = value;
    return pv_user_data;
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

function getContextFromCache(pv_user_data) {
    return pv_user_data?.cache?.history?.at(-1) ?? null;
}

function getLastField(pv_user_data) {
    const context = getContextFromCache(pv_user_data);
    return context?.field ?? null;
}

export const assistant = {
    processUserInput,
    sendFirstMesssage
};

