function buildNERPrompt(userInput, examples) {
    const examplesText = examples.map(ex => `Text: ${ex.text}\nEntities: ${JSON.stringify(ex.entities)}`).join('\n\n');
    return `
Виділи іменовані сутності з тексту.

Приклади:
${examplesText}

Текст для обробки:
${userInput}
Формат відповіді: JSON масив з об'єктами { "text": "...", "label": "..." }
`;
};

export default buildNERPrompt;