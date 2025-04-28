import {isUnknownAnswer, isNumberAnswer} from '../helpers/index.js';
import {extractIntentFromText, extractIntentFromSystemText} from '../helpers/textcatHelper.js';


// Function to determine user intent, original intent
async function determineUserIntent(userInput, pv_user_data, nerEntities) {
    let intent = pv_user_data["intent"];
    let originalIntent =  pv_user_data.cache.original_intent; //  pv_user_data["intent"]

    const newIntentFromUserInput = (await giveNewOrOldIntent(userInput, pv_user_data, nerEntities));

    if (newIntentFromUserInput !== originalIntent) {
        intent = newIntentFromUserInput;
    }

    return { intent, originalIntent };
}

// function змінює інтенцію, але якщо відповідь "невизначена", то залишає попередню
async function giveNewOrOldIntent(userInput, pv_user_data, nerEntities) {
    if (isUnknownAnswer(nerEntities) || isNumberAnswer(nerEntities)) {
        // Якщо користувач не знає або відповів числом — залишаємо попередній намір
        return pv_user_data["intent"];
    }

    const newIntent = await extractIntentFromText(userInput);
    return newIntent;
}

// Функція для зміни наміру на основі відповіді системи
async function changeUserIntentFromSystem(answer, pv_user_data) {
    const possibleNewIntent = await extractIntentFromSystemText(answer);

    // Якщо визначився новий намір, оновлюємо pv_user_data
    if (possibleNewIntent && possibleNewIntent !== pv_user_data["intent"]) {
        return { ...pv_user_data, intent: possibleNewIntent };
    }

    pv_user_data = changeOriginalIntent(pv_user_data, pv_user_data["intent"]);
    return pv_user_data;
}

function getOriginalIntent(pv_user_data) {
    return pv_user_data.cache.original_intent || '';
}

function changeOriginalIntent(pv_user_data, newOriginalIntent) {
    if(pv_user_data['intent'] === pv_user_data['cache']['original_intent']){
        pv_user_data.cache.original_intent = newOriginalIntent;
    }
    
    return pv_user_data;
}

function a() {

}

export {
    determineUserIntent,
    changeUserIntentFromSystem,
    changeOriginalIntent
}