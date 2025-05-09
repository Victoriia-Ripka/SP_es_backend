import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { OpenAIapi } from './openAIHelper.js';

const nerExamplesFile = yaml.load(fs.readFileSync(path.resolve('./config/ner_examples.yml'), 'utf8'));

function buildNERPrompt(examples) {
    const examplesText = examples.map(ex => `Text: ${ex.text}\nEntities: ${JSON.stringify(ex.entities)}`).join('\n\n');
    return `
        Ти допомагаєш витягати сутності з тексту. Намагайся виявити всі можливі сутності згідно до прикладів.
        Приклади:
        ${examplesText}

        Формат відповіді: JSON масив з об'єктами { "text": "...", "label": "..." }. 
        Якщо сутностей не виявлено - поверни пустий масив [] і більше нічого. 
        Повертай лише дійсний масив сутностей JSON, більше нічого. Не включай жодного тексту, пояснень чи форматування.
    `;
};

async function extractEntitiesFromText(text) {
    const context = buildNERPrompt(nerExamplesFile);
    const nerEntities = JSON.parse(await OpenAIapi.processInputWithGPT(context, text));

    console.log('[INFO NER]', nerEntities);
    return nerEntities;
}

export { buildNERPrompt, extractEntitiesFromText };