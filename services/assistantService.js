import OpenAI from 'openai';
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
});

async function processUserInput(userInput) {
    const response = await client.responses.create({
        model: 'gpt-3.5-turbo',
        instructions: 'Ти віртуальний асистент для проєктування СЕС',
        input: userInput,
      });
      
      console.log(response.output_text);

      return response.output_text;

    // const completion = await client.createChatCompletion({
    //     model: "",
    //     messages: [{ role: "user", content: userInput }],
    // });

    // const intent = extractIntentFromText(completion.data.choices[0].message.content);

    // if (intent === "орендувати") {
    //     const cars = await Car.find({});
    //     return `Ось машини, які доступні:\n${cars.map(c => c.brand + " " + c.model).join("\n")}`;
    // }
}

function extractIntentFromText(text) {
    // умовний парсер або інша модель/логіка
    if (text.includes("орендувати")) return "орендувати";
    if (text.includes("прощання")) return "прощання";
    return "інше";
}

export const assistant = { 
    processUserInput 
};

