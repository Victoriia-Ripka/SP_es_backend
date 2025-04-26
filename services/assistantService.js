import { textcatExamples } from '../config/config.js'
import {
    buildTextcatPrompt, 
    processInputWithGPT, 
    getOpenAIResponse, 
    verifyNumberOrString, 
    isUnknownAnswer, 
    createInstruction,
    transformStringToNumber,
    extractEntitiesFromText,
    extractIntentFromText
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
        'original_intent': pv_user_data["intent"]
    }
    return { answer, updated_user_data: pv_user_data };
}

async function processUserInput(userInput, pv_user_data) {
    console.log("process user input start:", pv_user_data)

    const nerEntities = await extractEntitiesFromText(userInput);
    const intent = await determineUserIntent(userInput, pv_user_data, nerEntities);

    let answer, updated_user_data;

    switch (intent) {
        case "визначити потужність":
            ({ answer, updated_user_data } = await handlePowerIntent(userInput, pv_user_data));
            break;

        case "інформація":
            ({ answer, updated_user_data } = await giveInformationFromKB(nerEntities, userInput, pv_user_data));
            break;

        case 'привітання':
            answer = "Привіт";
            updated_user_data = pv_user_data;
            break;

        case 'прощання':
            answer = "Бувай";
            updated_user_data = pv_user_data;
            break;

        // TODO
        default:
            answer = "Вибач, я тебе не зрозумів.";
            updated_user_data = pv_user_data;
            break;
    }

    return { answer, updated_user_data };
}


// INTENT SECTION START
// Function to determine user intent
async function determineUserIntent(userInput, pv_user_data, nerEntities) {
    if (pv_user_data["intent"] === '') {
        // Якщо немає інтенції, визначаємо її
        return await extractIntentFromText(userInput);
    } else {
        // Якщо є інтенція, перевіряємо чи вона не змінилася
        const newIntent = (await changeUserIntention(userInput, pv_user_data, nerEntities)).toLowerCase();

        if (newIntent !== pv_user_data["intent"]) {
            console.log(`Intent changed from ${pv_user_data["intent"]} to ${newIntent}`);

            pv_user_data["cache"]['temporary_intent'] = newIntent;
            const updatedUserData = { ...pv_user_data, intent: newIntent };

            // Викликаємо рекурсію обробки запиту користувача з оновленим наміром
            return await processUserInput(userInput, updatedUserData);
        }

        return pv_user_data["intent"];
    }
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
async function changeUserIntentFromQuestion(systemOutput, pv_user_data) {
    const textcatPrompt = buildTextcatPrompt(systemOutput, textcatExamples);
    const textcatContent = 'Ти аналізуєш текст відповіді експертної системи і класифікуєш можливий намір, що випливає з питання. Поверни тільки назву наміру. Приклад: Можу запитати, яка потужність СЕС вам потрібна? => Можу запитати, яка потужність СЕС вам потрібна? => визначити потужність';

    const possibleNewIntent = await processInputWithGPT(textcatContent, textcatPrompt);

    console.log('[INFO Intent from systemOutput]', possibleNewIntent);

    // Якщо визначився новий намір, оновлюємо pv_user_data
    if (possibleNewIntent && possibleNewIntent !== pv_user_data.intent) {
        return { ...pv_user_data, intent: possibleNewIntent };
    }

    return pv_user_data;
}

function getOriginalIntent(pv_user_data) {
    const original = pv_user_data.cache.find(item => item.type === 'original_intent');
    return original ? original.value : null;
}

function removeTemporaryIntent(pv_user_data) {
    pv_user_data.cache = pv_user_data.cache.filter(item => item.type !== 'temporary_intent');
}
// INTENT SECTION END


// SECTION START
// function handle визначити потужність СЕС
async function handlePowerIntent(userInput, pv_user_data) {
    const content = 'Якщо повідомлення користувача містить число (цифрами або словами) - поверни true. Інакше поверни false. Поверни тільки "true" або "false".'
    const processedIsANumber = await processInputWithGPT(content, userInput);

    let answer, updated_user_data;

    if (processedIsANumber === 'true') {
        let pvPower = verifyNumberOrString(userInput);
        if (typeof (pvPower) == 'string') {
            userInput = verifyNumberOrString(await transformStringToNumber(pvPower));
        }

        if (userInput > 0 && userInput < 15) {
            answer = await createNextQuestion(pv_user_data)
            updated_user_data = await rewritePVUserData(pv_user_data, userInput, "power");
        } else {
            answer = "Я можу запропонувати СЕС тільки до 15кВт";
            updated_user_data = pv_user_data;
        }

    } else {
        answer = "third else";
        updated_user_data = pv_user_data;
        console.log("third option: ", answer, updated_user_data)
    }

    return { answer, updated_user_data };
}

// function керує напрямок розмови далі
// TOFIX: якщо вже все заповнено?
// TOFIX: перевизначити intent
async function createNextQuestion(pv_user_data) {
    const content = 'Задай 1 питання до користувача щодо СЕС якщо залишилися незаповнені поля на обʼєкті. Задай тільки 1 питання щодо 1 незаповненої властивості.'
    const response = await processInputWithGPT(content, JSON.stringify(pv_user_data))
    // console.log(response)
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

    let answer, updated_user_data

    if (!field) {

        field = getLastField(pv_user_data)

        if (!field) {
            answer = "Не знайдено основне поле для бази знань (наприклад, СЕС)."
            updated_user_data = pv_user_data
        } else {
            const knowledge = getKnowledge(field, detail);

            console.log("!!! knowledge: ", knowledge)

            const instructions = createInstruction(pv_user_data, knowledge);
            answer = await getOpenAIResponse(instructions, userInput);

            // TODO: change intent
            updated_user_data = pv_user_data
            // updated_user_data = await changeUserIntentFromQuestion(answer, pv_user_data)
        }
    }
    return { answer, updated_user_data };
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

