import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import dotenv from "dotenv";
import { buildNERPrompt, buildTextcatPrompt } from '../helpers/index.js';
import { loadKnowledgeBase } from './knowledgeBaseService.js';

dotenv.config();

const nerExamples = yaml.load(fs.readFileSync(path.resolve('./config/ner_examples.yml'), 'utf8'));
const textcatExamples = JSON.parse(fs.readFileSync(path.resolve('./config/textcat_examples.json'), 'utf8'));

const client = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
});

function sendFirstMesssage(pv_user_data){

    const answer = `Привіт. Я є експертною системою для проєктування СЕС. Яка потужність СЕС тобі потрібна?`
    const updated_user_data = {...pv_user_data, intent: 'визначити потужність'}

    return { answer, updated_user_data };
    // const knowledge = getKnowledge("СЕС", detail);

    // const response = await client.responses.create({
    //     model: 'gpt-3.5-turbo',
    //     instructions: createInstruction("", knowledge),
    //     input: userInput,
    // });

    // return response.output_text;
}

async function processUserInput(userInput, pv_user_data) {
    const { nerEntities, intent } = await extractIntentAndEntitiesFromText(userInput);

    switch (intent) {
        case "інформація":
            const answer = await giveInformationFromKB(nerEntities, userInput, pv_user_data);
            // console.log(nerEntities, intent)
            // console.log(answer)
            return { answer, updated_user_data: pv_user_data };

        case 'привітання':
            return { answer: "Привіт", updated_user_data: pv_user_data };

        case 'прощання':
            return { answer: "Бувай", updated_user_data: pv_user_data };
    }


    // if (intent === "орендувати") {
    //     const cars = await Car.find({});
    //     return `Ось машини, які доступні:\n${cars.map(c => c.brand + " " + c.model).join("\n")}`;
    // }
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

    const [nerResponse, textcatResponse] = await Promise.all([
        client.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'Ти допомагаєш витягати сутності з тексту.' },
                { role: 'user', content: nerPrompt }
            ]
        }),
        client.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'Ти класифікуєш наміри користувача.' },
                { role: 'user', content: textcatPrompt }
            ]
        })
    ]);

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

