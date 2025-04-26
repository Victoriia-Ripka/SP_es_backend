import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import dotenv from "dotenv";
import { buildNERPrompt, buildTextcatPrompt, processInputWithGPT } from '../helpers/index.js';
import { getKnowledge } from './knowledgeBaseService.js';

dotenv.config();

const nerExamples = yaml.load(fs.readFileSync(path.resolve('./config/ner_examples.yml'), 'utf8'));
const textcatExamples = JSON.parse(fs.readFileSync(path.resolve('./config/textcat_examples.json'), 'utf8'));

const client = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
});

function sendFirstMesssage(pv_user_data) {
    const answer = `Привіт. Я є експертною системою для проєктування СЕС. Яка потужність СЕС тобі потрібна?`;
    pv_user_data["intent"] = 'визначити потужність';
    return { answer, updated_user_data: pv_user_data };
}

async function processUserInput(userInput, pv_user_data) {
    console.log("process user input start:", pv_user_data)

    let intent;

    if (pv_user_data["intent"] === '') {
        // Якщо немає інтенції, визначаємо її
        intent = await extractIntentFromText(userInput);
    } else {
        // Якщо є інтенція, перевіряємо чи вона не змінилася
        // Визначаємо намір користувача з повідомлення
        const newIntent = await changeUserIntention(userInput, pv_user_data);

        if (newIntent !== pv_user_data["intent"]) {
            console.log(`Intent changed from ${pv_user_data["intent"]} to ${newIntent}`);
            const updatedUserData = { ...pv_user_data, intent: newIntent };
            // Викликаємо рекурсію обробки запиту користувача з оновленим наміром
            return await processUserInput(userInput, updatedUserData);
        }

        intent = pv_user_data["intent"];
    }

    const nerEntities = await extractEntitiesFromText(userInput);

    let answer, updated_user_data;

    switch (intent) {
        case "визначити потужність":
            ({ answer, updated_user_data } = await handlePowerIntent(userInput, pv_user_data));
            break;

        case "інформація":
            answer = await giveInformationFromKB(nerEntities, userInput, pv_user_data);
            updated_user_data = pv_user_data;
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

        console.log("third option: ", answer, updated_user_data)
    }

    return { answer, updated_user_data };
}

// function змінює інтенцію
async function changeUserIntention(text, pv_user_data) {
    // const currentIntent = pv_user_data["intent"]
    const newIntent = await extractIntentFromText(text);
    return newIntent; // !== currentIntent ? newIntent : currentIntent
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

async function rewritePVUserData(pv_user_data, value, property) {
    pv_user_data[property] = value;
    return pv_user_data;
}

function verifyNumberOrString(value) {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
}

async function transformStringToNumber(value) {
    const content = 'Користувач написав число словами. Твоя задача повернути це число цифрами. Відповідь повинна містити тільки число';
    const processedUserInputNumber = await processInputWithGPT(content, value);
    return isNaN(processedUserInputNumber) ? value : processedUserInputNumber;
}

function createInstruction(pv_user_data, knowledge) {
    const knowledgeJSON = JSON.stringify(knowledge, null, 2);

    const baseInstruction = 'Ти віртуальний асистент для проєктування сонячної електростанції (СЕС). Твоя мета — отримати від користувача наступну інформацію: ' +
        `вид електростанції, кількість споживання електроенергії, доступна площа для фотопанелей, місце монтажу фотопанелей. Почни з необхідного виду СЕС. Використовуй знання: ${knowledgeJSON}.`;

    if (pv_user_data?.['messages_count'] === 1) {
        return baseInstruction;
    } else {
        const knownData = JSON.stringify(pv_user_data, null, 2);
        return `${baseInstruction} Використовуй уже відомі дані про користувача та зосередься на зборі відсутньої інформації. Відомі дані:\n${knownData}. Для збору даних задай питання про одне з відсутніх полей.`;
    }
}

async function extractEntitiesFromText(userInput) {
    const nerPrompt = buildNERPrompt(userInput, nerExamples);
    const nerContent = 'Ти допомагаєш витягати сутності з тексту.';
    const nerEntities = JSON.parse(await processInputWithGPT(nerContent, nerPrompt));

    console.log('[INFO NER]', nerEntities);
    return nerEntities;
}

async function extractIntentFromText(userInput) {
    const textcatPrompt = buildTextcatPrompt(userInput, textcatExamples);
    const textcatContent = 'Ти класифікуєш наміри користувача.';
    const intent = await processInputWithGPT(textcatContent, textcatPrompt);

    console.log('[INFO Intent]', intent);
    return intent;
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

    let answer

    if (!field) {
        answer =  "Не знайдено основне поле для бази знань (наприклад, СЕС)."
        // throw new Error("Не знайдено основне поле для бази знань (наприклад, СЕС).");
    } else {
        const knowledge = getKnowledge(field, detail);

        const response = await client.responses.create({
            model: 'gpt-3.5-turbo',
            instructions: createInstruction(pv_user_data, knowledge),
            input: userInput,
        });

        answer = response.output_text

    }

    return answer;
}

export const assistant = {
    processUserInput,
    sendFirstMesssage
};

