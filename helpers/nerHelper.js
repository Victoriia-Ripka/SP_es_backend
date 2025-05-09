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
    const knowledgeFields = entities.filter(
        entity => typeof entity.label === 'string' && entity.label.includes("поле знань")
    );

    if (knowledgeFields.length === 0) return null;

    // Повернути перше не-СЕС поле знань
    for (let entity of knowledgeFields) {
        if (entity.text.toLowerCase() !== 'сес') return entity.text;
    }

    // Якщо були лише СЕС
    return knowledgeFields[0].text;
}

function identifyDetailFromEntities(entities, kb) {
    const details = []
    const possibleDetails = extractPossibleDetails(kb);

    for (let ent of entities) {
        if (possibleDetails.includes(ent.label)) details.push(ent.label);
    }

    return details;
}

// рекурсія для отримання всіх характеристик поля знань
function extractPossibleDetails(obj, collected = new Set()) {
    if (typeof obj !== 'object' || obj === null) return collected;

    for (const [key, value] of Object.entries(obj)) {
        if (!/^\d+$/.test(key)) {
            collected.add(key);
        }
        if (typeof value === 'object') {
            extractPossibleDetails(value, collected);
        }
    }

    return Array.from(collected);
}

function updateEntitiesWithCache(current, cache) {
    const cached = cache.flatMap(item => [item.field, item.detail]).filter(Boolean);
    return [...current.map(e => e.text), ...cached];
}

export const entityHelper = { extractEntitiesFromText, identifyMainField, identifyDetailFromEntities };