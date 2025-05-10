import { entityHelper } from './nerHelper.js';
import { OpenAIapi } from './openAIHelper.js'
import { ctrlWrapper } from './CtrlWrapper.js';

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

export const Helpers = {
    OpenAIapi,
    entityHelper,
    createInstruction,
    ctrlWrapper
};