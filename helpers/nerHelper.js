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

function identifyMainField(entities) {
    // визначити, чи сутності містять сферу знань
    const knowledgeFields = entities.filter(
        entity => entity.label.includes("сфера знань")
    );

    if (knowledgeFields.length === 0) return null;

    // Повернути перше не-СЕС сферу знань
    for (let entity of knowledgeFields) {
        if (entity.text.toLowerCase() !== 'сес') return entity.text;
    }

    // Якщо була лише СЕС
    return knowledgeFields[0].text;
}

// визначає компоненти знань із сутностей, що можуть належати даній сфері знань
function identifyDetailFromEntities(entities, kb) {
    const details = [];
    const possibleDetails = extractPossibleDetails(kb).map(d => d.trim().toLowerCase());

    for (let ent of entities) {
        const label = ent.label.trim().toLowerCase();
        if (possibleDetails.includes(label)) {
            details.push(label);
        }
    }

    return details;
}

// рекурсивна функція для отримання всіх компонентів сфери знань
function extractPossibleDetails(obj, collected = new Set()) {
    if (typeof obj !== 'object' || obj === null) return collected;

    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
            if ('опис' in value) {
                collected.add(key);
            }
            // Рекурсивно спускаємось далі
            extractPossibleDetails(value, collected);
        }
    }

    return Array.from(collected);
}

export const entityHelper = { extractEntitiesFromText, identifyMainField, identifyDetailFromEntities };