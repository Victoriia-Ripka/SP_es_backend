import fs from 'fs';
import path from 'path';
import { processInputWithGPT } from './openAIHelper.js';

const textcatExamples = JSON.parse(fs.readFileSync(path.resolve('./config/textcat_examples.json'), 'utf8'));

function buildTextcatPrompt(userInput, examples) {
    const examplesText = examples.map(ex => `Text: ${ex.text}\nIntent: ${ex.label}`).join('\n\n');
    return `
        Визнач намір користувача.

        Приклади:
        ${examplesText}

        Текст для класифікації:
        ${userInput}
        Формат відповіді: тільки мітка наміру (наприклад: "орендувати", "прощання", "інформація")
    `;
};

async function extractIntentFromText(userInput) {
    const textcatPrompt = buildTextcatPrompt(userInput, textcatExamples);
    const textcatContent = 'Ти класифікуєш наміри користувача.';
    const intent = await processInputWithGPT(textcatContent, textcatPrompt);

    console.log('[INFO Intent]', intent);
    return intent;
}

export { buildTextcatPrompt, extractIntentFromText };