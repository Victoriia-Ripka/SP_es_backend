import OpenAI from 'openai';
import dotenv from "dotenv";

dotenv.config();

const client = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
});

async function processInputWithGPT(instruction, input) {
    const response = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: instruction },
            { role: 'user', content: input }
        ]
    });

    return response.choices[0].message.content.trim();
}

export default processInputWithGPT;