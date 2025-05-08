import { buildNERPrompt, extractEntitiesFromText } from './nerHelper.js';
import { extractIntentFromSystemText, extractIntentFromText } from './textcatHelper.js';
import { processInputWithGPT, getOpenAIResponse } from './openAIHelper.js'
import { ctrlWrapper } from './CtrlWrapper.js';

function verifyNumberOrString(value) {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
}

function extractNumber(text) {
    const cleanedText = text.replace(',', '.');
    const match = cleanedText.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (match) {
        return Number(match[0]);
    }
    return null;
}

// function чи текст містить невизначеність
function isUnknownAnswer(nerEntities) {
    return nerEntities.some(entity => entity.label === 'невідомо');
}

// function чи текст містить число
function isNumberAnswer(nerEntities) {
    return nerEntities.some(entity => entity.label === 'число');
}

// Функція для перевірки одиниць вимрювання
function isCorrectMeasureUnits(nerEntities, correctMeasureUnits) {
    if (!Array.isArray(nerEntities) || nerEntities.length === 0) {
        return false;
    }

    // Фільтруємо тільки ті сутності, що мають label "одиниця вимірювання"
    const measureEntities = nerEntities.filter(entity => entity.label === 'одиниця вимірювання');

    // Якщо жодної одиниці вимірювання не знайдено
    if (measureEntities.length === 0) {
        return false;
    }

    // Перевіряємо, чи є хоча б одна правильна одиниця вимірювання
    return measureEntities.some(entity =>
        correctMeasureUnits.includes(entity.text.trim().toLowerCase())
    );
}

function createInstruction(pv_user_data, knowledge) {
    const knowledgeJSON = JSON.stringify(knowledge, null, 2);

    const baseInstruction = 'Ти віртуальний асистент для проєктування сонячної електростанції (СЕС). Твоя мета — отримати від користувача наступну інформацію: ' +
        `вид електростанції, кількість споживання електроенергії, доступна площа для фотопанелей, місце монтажу фотопанелей. Почни з необхідної потужності СЕС. Використовуй знання: ${knowledgeJSON}. Під час відповіді не змінюй відомі дані, просто надай їх.`;

    if (pv_user_data?.['messagesCount'] === 1) {
        return baseInstruction;
    } else {
        const knownData = JSON.stringify(pv_user_data, null, 2);
        return `${baseInstruction} Використовуй уже відомі дані про користувача та зосередься на зборі відсутньої інформації. Відомі дані:\n${knownData}. Для подальшого збору даних обовʼязково задай 1 питання про 1 з відсутніх полей.`;
    }
}

async function transformStringToNumber(value) {
    const content = 'Користувач написав число словами. Твоя задача повернути це число цифрами. Відповідь повинна містити тільки число';
    const processedUserInputNumber = await processInputWithGPT(content, value);
    return isNaN(processedUserInputNumber) ? value : processedUserInputNumber;
}

function checkIfUserDataChanged(pv_user_data, updated_user_data) {
    const fields = [
        'pv_power',
        'pv_area',
        'pv_instalation_place',
        'roof_tilt',
        'roof_orientation',
        'pv_location'
    ];

    return fields.some(field => pv_user_data[field] !== updated_user_data[field]);
}

export const Helpers = {
    buildNERPrompt,
    processInputWithGPT,
    getOpenAIResponse,
    verifyNumberOrString,
    isUnknownAnswer,
    createInstruction,
    transformStringToNumber,
    extractEntitiesFromText,
    extractIntentFromText,
    extractIntentFromSystemText,
    extractNumber,
    isNumberAnswer,
    isCorrectMeasureUnits,
    checkIfUserDataChanged,
    ctrlWrapper
};