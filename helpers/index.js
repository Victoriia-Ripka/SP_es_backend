import { buildNERPrompt, extractEntitiesFromText } from './nerHelper.js';
import { buildTextcatPrompt, extractIntentFromText } from './textcatHelper.js';
import { processInputWithGPT, getOpenAIResponse } from './openAIHelper.js'

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


// function чи відповідь є невизначеністю
function isUnknownAnswer(nerEntities) {
    return nerEntities.some(entity => entity.label === 'невідомо');
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

export {
    buildNERPrompt,
    buildTextcatPrompt,
    processInputWithGPT,
    getOpenAIResponse,
    verifyNumberOrString,
    isUnknownAnswer,
    createInstruction,
    transformStringToNumber,
    extractEntitiesFromText,
    extractIntentFromText,
    extractNumber
};