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

export default buildTextcatPrompt;