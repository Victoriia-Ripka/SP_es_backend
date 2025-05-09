import fs from 'fs';
import path from 'path';
import { OpenAIapi } from './openAIHelper.js';

const textcatExamplesFile = JSON.parse(fs.readFileSync(path.resolve('./config/textcat_examples.json'), 'utf8'));

function buildTextcatPrompt(examples) {
    const examplesText = examples.map(ex => `Text: ${ex.text}\nIntent: ${ex.label}`).join('\n\n');
    return `
        Ти класифікуєш наміри користувача. Визнач намір користувача.
        Приклади:
        ${examplesText}

        Формат відповіді: тільки мітка наміру (наприклад: "визначити місце монтажу", "привітання", "інформація").
        Не придумуй нових намірів, викорисовуй тільки наміри з прикладів.
    `;
};

async function extractIntentFromText(userInput) {
    const context = buildTextcatPrompt(textcatExamplesFile);
    const intent = await OpenAIapi.processInputWithGPT(context, userInput);

    console.log('[INFO Intent]', intent);
    return intent;
}

async function extractIntentFromSystemText(userInput) {
    let context = buildTextcatPrompt(textcatExamplesFile) + 'Ти аналізуєш текст відповіді експертної системи і класифікуєш можливий намір, що випливає з питання. Поверни тільки назву наміру. Приклад: Можу запитати, яка потужність СЕС вам потрібна? => Можу запитати, яка потужність СЕС вам потрібна? => визначити потужність';
    const intent = await OpenAIapi.processInputWithGPT(context, userInput);

    console.log('[INFO Intent]', intent);
    return intent;
}

export { extractIntentFromSystemText, extractIntentFromText };