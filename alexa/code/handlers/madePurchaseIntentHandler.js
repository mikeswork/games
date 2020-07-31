const constants = require('../constants');
const session = require('../helpers/session');
const questions = require('../questions');
const isp = require('../helpers/isp');
const common = require('../common');

const MadePurchaseIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'askAboutPurchase';
    },
    async handle(handlerInput) {
        console.log('[MadePurchaseIntentHandler]');
        const state = session.getAttributes(handlerInput, 'state');
        const repromptText = session.getAttributes(handlerInput, 'repromptText');

        await isp.loadProduct(handlerInput);
        
        const product = session.getAttributes(handlerInput, 'availableProduct');

        let upsellMessage;
        let speechText = '';

        if (product) {
            if (isp.isProductPurchased(handlerInput)) {
                speechText = `You own ${product.name}, which gives you ${product.summary}. `;
            } else if (!isp.isPurchasingOn(handlerInput) || isp.isFTU(handlerInput)) {
                speechText = 'There is nothing to purchase. ';
            } else if (isp.isPendingPermission(handlerInput)) {
                speechText = `I've asked for permission to purchase ${product.name}. `;
            } else if (!isp.expiredOrDeclined(handlerInput)) {
                upsellMessage = 'You did not make a purchase yet. ';
                upsellMessage += `You can get ${product.name} which has ${product.summary}. Want to learn more?`;
            }
        } else {
            speechText = 'There is nothing to purchase. ';
        }

        // Correct speech to resume game
        if (!upsellMessage) {
            speechText += (state === constants.STATES.GAME)
                ? questions.getPrevAndResume(handlerInput, 'lets-get-back')
                : repromptText;
        }

        session.persist(handlerInput);

        return common.createResponse(handlerInput, speechText, '', upsellMessage);
    }
};

module.exports = MadePurchaseIntentHandler;