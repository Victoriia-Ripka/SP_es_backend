import fs from 'fs';
import path from 'path';
import { processInputWithGPT } from './openAIHelper.js';

const textcatExamplesFile = JSON.parse(fs.readFileSync(path.resolve('./config/textcat_examples.json'), 'utf8'));

function buildTextcatPrompt(examples) {
    const examplesText = examples.map(ex => `Text: ${ex.text}\nIntent: ${ex.label}`).join('\n\n');
    return `
        Ти класифікуєш наміри користувача. Визнач намір користувача.
        Приклади:
        ${examplesText}

        Формат відповіді: тільки мітка наміру (наприклад: "визначити місце монтажу", "привітання", "інформація")
    `;
};

async function extractIntentFromText(userInput) {
    const context = buildTextcatPrompt(textcatExamplesFile);
    const intent = await processInputWithGPT(context, userInput);

    console.log('[INFO Intent]', intent);
    return intent;
}

export { buildTextcatPrompt, extractIntentFromText };