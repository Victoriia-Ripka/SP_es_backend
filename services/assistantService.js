import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import dotenv from "dotenv";
import { buildNERPrompt, buildTextcatPrompt } from '../helpers/index.js';

dotenv.config();

const nerExamples = yaml.load(fs.readFileSync(path.resolve('./config/ner_examples.yml'), 'utf8'));
const textcatExamples = JSON.parse(fs.readFileSync(path.resolve('./config/textcat_examples.json'), 'utf8'));

const client = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
});

async function processUserInput(userInput) {
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

    console.log('[NER]', nerEntities);
    console.log('[Intent]', intent);

    const response = await client.responses.create({
        model: 'gpt-3.5-turbo',
        instructions: 'Ти віртуальний асистент для проєктування СЕС',
        input: userInput,
    });

    const answer = response.output_text

    console.log(answer);

    // const completion = await client.createChatCompletion({
    //     model: "",
    //     messages: [{ role: "user", content: userInput }],
    // });

    return { nerEntities, intent, answer };

    // const intent = extractIntentFromText(completion.data.choices[0].message.content);

    // if (intent === "орендувати") {
    //     const cars = await Car.find({});
    //     return `Ось машини, які доступні:\n${cars.map(c => c.brand + " " + c.model).join("\n")}`;
    // }
}

function extractIntentFromText(text) {
    // умовний парсер або інша модель/логіка
    if (text.includes("орендувати")) return "орендувати";
    if (text.includes("прощання")) return "прощання";
    return "інше";
}

export const assistant = {
    processUserInput
};

