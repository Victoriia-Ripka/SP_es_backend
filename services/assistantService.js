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

async function processUserInput(userInput, pv_user_data) {
    const { nerEntities, intent } = await extractIntentAndEntitiesFromText(userInput);

    const knowledge = nerEntities.length > 0 ? getKnowledge(nerEntities[0]) :  getKnowledge('');

    const response = await client.responses.create({
        model: 'gpt-3.5-turbo',
        instructions: createInstruction(pv_user_data, knowledge),
        input: userInput,
    });

    const answer = response.output_text;

    const updated_user_data = pv_user_data;
    // if (intent === "орендувати") {
    //     const cars = await Car.find({});
    //     return `Ось машини, які доступні:\n${cars.map(c => c.brand + " " + c.model).join("\n")}`;
    // }

    return { nerEntities, intent, answer, updated_user_data };
}

function createInstruction(pv_user_data, knowledge) {
    const knowledgeJSON = JSON.stringify(knowledge, null, 2);

    const baseInstruction = 'Ти віртуальний асистент для проєктування сонячної електростанції (СЕС). Твоя мета — отримати від користувача наступну інформацію: ' +
        `вид електростанції, кількість споживання електроенергії, доступна площа для фотопанелей, місце монтажу фотопанелей. Почни з необхідного виду СЕС. Використовуй знання: ${knowledgeJSON}`;

    if (pv_user_data['messages_count'] === 1) {
        return baseInstruction;
    } else {
        const knownData = JSON.stringify(pv_user_data, null, 2);
        return `${baseInstruction} Використовуй уже відомі дані про користувача та зосередься на зборі відсутньої інформації. Відомі дані:\n${knownData}`;
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

    const nerEntities = JSON.parse(nerResponse.choices[0].message.content);
    const intent = textcatResponse.choices[0].message.content.trim();

    console.log('[INFO NER]', nerEntities);
    console.log('[INFO Intent]', intent);

    return { nerEntities, intent };
}

function getKnowledge(entities) {
    try {
        const data = loadKnowledgeBase(entities);
        res.json(data);
    } catch (err) {
        throw new Error(`Не вдалося завантажити базу знань для: ${entity}`);
    }
}

export const assistant = {
    processUserInput
};

