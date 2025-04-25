import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import dotenv from "dotenv";
import { buildNERPrompt, buildTextcatPrompt, processInputWithGPT } from '../helpers/index.js';
import { loadKnowledgeBase } from './knowledgeBaseService.js';

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
    // console.log(pv_user_data)

    let nerEntities, intent;

    if (pv_user_data["intent"] === '') {
        ({ nerEntities, intent } = await extractIntentAndEntitiesFromText(userInput));
    } else {
        intent = pv_user_data["intent"];
        // TOFIX?
        nerEntities = '';
    }

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
            break;
    }

    return { answer, updated_user_data };
}

async function handlePowerIntent(userInput, pv_user_data) {
    const content = 'Якщо повідомлення користувача містить число (цифрами або словами) - поверни true. Інакше поверни false. Поверни тільки "true" або "false".'
    const processedIsANumber = await processInputWithGPT(content, userInput);

    let answer, updated_user_data;

    if (processedIsANumber === 'true') {
        let pvPower = verifyNumberOrString(userInput);
        if(typeof(pvPower) == 'string'){
            userInput = verifyNumberOrString(await transformStringToNumber(pvPower));
        }
        
        if (userInput > 0 && userInput < 15) {
            // TOFIX flexable answer
            answer = "Який тип СЕС тобі потрібен?";
            updated_user_data = await rewritePVUserData(pv_user_data, userInput, "power");
        } else {
            answer = "Я можу запропонувати СЕС тільки до 15кВт";
            updated_user_data = pv_user_data;
        }

    } else {
        answer = "third else";
        updated_user_data = pv_user_data;
        // console.log("third option: ", answer, updated_user_data)
    }

    return { answer, updated_user_data };
}

// TODO: function керує напрямок розмови

async function rewritePVUserData(pv_user_data, value, property) {
    pv_user_data[property] = value;
    return pv_user_data;
}

function verifyNumberOrString(value) {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
}

async function transformStringToNumber(value) {
    const content =  'Користувач написав число словами. Твоя задача повернути це число цифрами. Відповідь повинна містити тільки число';
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

async function extractIntentAndEntitiesFromText(userInput) {
    const nerPrompt = buildNERPrompt(userInput, nerExamples);
    const textcatPrompt = buildTextcatPrompt(userInput, textcatExamples);

    const nerContent = 'Ти допомагаєш витягати сутності з тексту.';
    const nerResponse = await processInputWithGPT(nerContent, nerPrompt);

    const textcatContent = 'Ти класифікуєш наміри користувача.';
    const textcatResponse = await processInputWithGPT(textcatContent, textcatPrompt);

    const nerEntities = JSON.parse(nerResponse.choices[0].message.content.trim());
    const intent = textcatResponse.choices[0].message.content.trim();

    console.log('[INFO NER]', nerEntities);
    console.log('[INFO Intent]', intent);

    return { nerEntities, intent };
}

function getKnowledge(field, detail) {
    try {
        return loadKnowledgeBase(field, detail);
    } catch (err) {
        throw new Error(`Не вдалося завантажити базу знань для: ${field}`);
    }
}

async function giveInformationFromKB(nerEntities, userInput, pv_user_data) {
    let field, detail;

    nerEntities.forEach(entity => {
        if (entity.label === "CЕС") {
            field = entity.label;
        } else if (entity.label === "характеристика") {
            detail = entity.text;
        }
    });

    // console.log("field: ", field, "detail: ", detail)

    const knowledge = getKnowledge(field, detail);
    // console.log(knowledge)

    const response = await client.responses.create({
        model: 'gpt-3.5-turbo',
        instructions: createInstruction(pv_user_data, knowledge),
        input: userInput,
    });
    return response.output_text;
}

export const assistant = {
    processUserInput,
    sendFirstMesssage
};

