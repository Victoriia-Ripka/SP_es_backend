import OpenAI from 'openai';
import { OPENAI_API_KEY } from '../config/config.js';

const client = new OpenAI({
    apiKey: OPENAI_API_KEY,
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

async function getOpenAIResponse(instructions, input) {
    const response = await client.responses.create({
        model: 'gpt-3.5-turbo',
        instructions,
        input,
    });
    return response.output_text;
};

export const OpenAIapi = { getOpenAIResponse, processInputWithGPT };