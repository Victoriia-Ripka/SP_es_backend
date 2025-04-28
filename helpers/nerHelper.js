import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { processInputWithGPT } from './openAIHelper.js';

const nerExamples = yaml.load(fs.readFileSync(path.resolve('./config/ner_examples.yml'), 'utf8'));

function buildNERPrompt(userInput, examples) {
    const examplesText = examples.map(ex => `Text: ${ex.text}\nEntities: ${JSON.stringify(ex.entities)}`).join('\n\n');
    return `
        Виділи іменовані сутності з тексту.

        Приклади:
        ${examplesText}

        Текст для обробки:
        ${userInput}
        Формат відповіді: JSON масив з об'єктами { "text": "...", "label": "..." }
        Повертай лише дійсний масив сутностей JSON, більше нічого. Не включай жодного тексту, пояснень чи форматування.
    `;
};

async function extractEntitiesFromText(text) {
    const nerPrompt = buildNERPrompt(text, nerExamples);
    const nerContent = 'Ти допомагаєш витягати сутності з тексту. Якщо сутностей не виявлено - поверни пустий масив [] і більше нічого. Намагайся виявити всі можливі сутності згідно до файлу з прикладами';
    const nerEntities = JSON.parse(await processInputWithGPT(nerContent, nerPrompt));

    console.log('[INFO NER]', nerEntities);
    return nerEntities;
}

export { buildNERPrompt, extractEntitiesFromText };