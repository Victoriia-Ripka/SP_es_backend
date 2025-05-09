import { Helpers } from '../helpers/index.js';
import { OpenAIapi } from '../helpers/openAIHelper.js';
import { KBService } from './knowledgeBaseService.js';

const kbSerice = new KBService();

// function handle визначити потужність СЕС
// TODO: можливість обробляти Вт у кВт
async function handlePowerIntent(userInput, pv_user_data, nerEntities, cache) {
    // const content = 'Якщо повідомлення користувача містить число (цифрами або словами) - поверни true. Інакше поверни false. Поверни тільки "true" або "false".';
    // const processedIsANumber = await Helpers.processInputWithGPT(content, userInput);

    const knowledge = kbSerice.getKnowledge("СЕС", "потужність");
    console.log(knowledge)

    let answer, updated_user_data;

    if (!nerEntities) {
        const content = `Дай відповідь базуючись на знаннях. Не додавай своєї інформації. Знання: ${knowledge["опис"]}`;
        answer = await OpenAIapi.processInputWithGPT(content, value);
    }

    // if (processedIsANumber === 'true') {
    //     // перевірка на одиниці вимірювання
    //     const includesCorrectUnits = Helpers.isCorrectMeasureUnits(nerEntities, ["Вт", "кВт", "вт", "квт"]);
    //     if (!includesCorrectUnits) {
    //         answer = "Для визначення потужності потрібні дані у Вт або кВт";
    //         return { answer, updated_user_data: pv_user_data };
    //     }

    // } else {
    //     // TODO: додати логіку (так само як у handleAreaIntent)
    //     answer = "third else.";
    //     updated_user_data = { ...pv_user_data };
    //     console.log("third option: ", answer, updated_user_data);
    // }

    return { answer, updated_user_data: { ...pv_user_data } };
}

// function handle визначити площу СЕС
// TODO: додати можливість обробляти різні одиниці вимірювання
// TODO: third option with KB
async function handleAreaIntent(userInput, pv_user_data, nerEntities) {
    const content = 'Якщо повідомлення користувача містить число (цифрами або словами) - поверни true. Інакше поверни false. Поверни тільки "true" або "false".';
    const processedIsANumber = await Helpers.processInputWithGPT(content, userInput);

    let answer, updated_user_data;

    if (processedIsANumber === 'true') {
        // перевірка на одиниці вимірювання
        const includesCorrectUnits = Helpers.isCorrectMeasureUnits(nerEntities, ["м2", "м 2", "м кв", "ар", "ари"]);
        if (!includesCorrectUnits) {
            answer = "Для визначення площі СЕС потрібні дані у відповідних одиницях вимірювання (наприклад: м кв).";
            return { answer, updated_user_data: pv_user_data };
        }

        const pvArea = Helpers.extractNumber(userInput);

        if (pvArea > 0) {
            answer = `Площа під монтаж СЕС визначена як ${pvArea} м кв.`;
            updated_user_data = rewritePVUserData(pv_user_data, pvArea, "pv_area");
        } else {
            answer = "Площа повинна бути додатня.";
            updated_user_data = { ...pv_user_data };
        }

    } else {
        // TODO: додати логіку (так само як у handlePowerIntent)
        answer = "third else";
        updated_user_data = { ...pv_user_data };
        console.log("third option: ", answer, updated_user_data);
    }

    return { answer, updated_user_data };
}

// TODO: third option with KB
async function handlePlaceIntent(userInput, pv_user_data, nerEntities) {
    const placeEnt = nerEntities.find(item => item.label === 'місце монтажу');

    let answer, updated_user_data;

    answer = "назва більш конкретно місце монтажу";
    updated_user_data = { ...pv_user_data };
    console.log("third option: ", answer, updated_user_data);

    return { answer, updated_user_data };
}

const answerDataSet = {
    finance: {
        "pv_data_field": "is_exist_money_limit",
        "true": "Фінансові можливості вказані як 'обмежені'.",
        "false": "Фінансові можливості вказані як 'необмежені'.",
        "neutral": "Чи у вас є обмежені фінансові можливості? "
    },
    "power grid": {
        "pv_data_field": "is_possible_electricity_grid_connection",
        "true": "Можливість підключення до е-мережі вказана як 'можлива'.",
        "false": "Можливість підключення до е-мережі вказана як 'неможлива'.",
        "neutral": "Чи є у Вас можливість підключення до електромережі? "
    },
    autonomy: {
        "pv_data_field": "is_electric_autonomy_important",
        "true": "Авномомність енергетичної системи вказана як 'важлива'.",
        "false": "Авномомність енергетичної системи вказана як 'неважлива'.",
        "neutral": "Чи вам важливо мати автономну електричну систему? "
    }
}

// TODO: connect to KB (field: PV, aspect: finance)
// TOFIX: prompt to GPT
async function handleConfidanceIntent(userInput, pv_user_data, param, field) {
    let answer, updated_user_data;

    if (!param) {
        const context = "Опрацюй текст тачим чином, щоб повернути 'позитивна впевненість', 'негативна впевненість' або 'нейтральна впевненість'. Поверни тільки рядок з двох слів.";
        param = await Helpers.processInputWithGPT(context, userInput);
        console.log("param from GPT: ", param);
    }

    return { answer, updated_user_data }
}

const questionExamples = {
    pv_power: "Яка потужність СЕС вам необхідна?",
    pv_instalation_place: "Де ви хочете розмістити фотопанелі?",
    pv_area: "Яка площа поверхні доступна для монтажу фотопанелей? ",
    is_electric_autonomy_important: "Чи енергетична незалежність від е-мережі для вас є важливою? (питання так/ні)",
    is_possible_electricity_grid_connection: "Чи у вас є можливість підключитися до е-мережі? (питання так/ні)",
    is_exist_money_limit: "Чи ви маєте бюджетний ліміт? (питання так/ні)",
}

// function керує напрямок розмови далі
// TODO: якщо вже все заповнено?
async function createNextQuestion(pv_user_data, context) {
    context += "Для створення питання опирайся на приклади: " + JSON.stringify(questionExamples);
    const response = await Helpers.processInputWithGPT(context, JSON.stringify(pv_user_data));
    return response;
}


async function giveInformationFromKB(nerEntities, userInput, pv_user_data) {
    let field = '';
    let detail = '';

    nerEntities.forEach(entity => {
        if (entity.label === "СЕС") {
            field = entity.label;
        } else if (entity.label === "характеристика") {
            detail = entity.text;
        }
    });

    let answer;

    if (!field) {
        field = getLastField(pv_user_data);

        if (!field) {
            answer = "Не знайдено основне поле для бази знань (наприклад, СЕС).";
            return answer;
        }
    }

    const knowledge = kbSerice.getKnowledge(field, detail);
    console.log("!!! knowledge: ", knowledge);
    const instructions = Helpers.createInstruction(pv_user_data, knowledge);
    answer = await Helpers.getOpenAIResponse(instructions, userInput);

    return answer;
}

function getContextFromCache(pv_user_data) {
    return pv_user_data?.cache?.at(-1) ?? null;
}

function getLastField(pv_user_data) {
    const context = getContextFromCache(pv_user_data);
    return context?.field ?? null;
}

// Function to determine user intent
async function determineUserIntent(userInput, pv_user_data, nerEntities) {
    const currentIntentFromUserInput = await Helpers.extractIntentFromText(userInput);
    const previousIntentFromUser = pv_user_data["intent"];

    console.log(currentIntentFromUserInput, previousIntentFromUser)

    // Якщо користувач не знає або відповів числом — залишаємо попередній намір
    if (Helpers.isUnknownAnswer(nerEntities) || Helpers.isNumberAnswer(nerEntities)) {
        return { intent: previousIntentFromUser, confidence: null };
    }

    // Якщо користувач так/ні/і тп..
    if (currentIntentFromUserInput.includes("впевненість")) {
        return { intent: previousIntentFromUser, confidence: currentIntentFromUserInput };
    }

    return { intent: currentIntentFromUserInput, confidence: null };
}

export const AssistantService = {
    handlePowerIntent,
    handleAreaIntent,
    handlePlaceIntent,
    handleConfidanceIntent,
    createNextQuestion,
    giveInformationFromKB
};

