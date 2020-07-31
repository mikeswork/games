const session = require('../helpers/session');
const isp = require('../helpers/isp');
const constants = require('../constants');
const common = require('../common');
const questions = require('../questions');

const AskRefundIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'askRefund';
    },
    async handle(handlerInput) {
        console.log('[AskRefundIntentHandler]');
        await isp.loadProduct(handlerInput);
        
        const speechPrefix = isp.isFTU(handlerInput) ? '' : 'There is nothing to refund<break strength="strong"/> ';
        let speechText = '';

        if (isp.isProductPurchased(handlerInput)) {
            // Refund flow, exits skill
            const product = session.getAttributes(handlerInput, 'availableProduct');

            return handlerInput.responseBuilder
                .addDirective({
                    type: 'Connections.SendRequest',
                    name: 'Cancel',
                    payload: {
                        InSkillProduct: {
                            productId: product.productId,
                        }
                    },
                    token: "hwp-kids-isp-refund"
                })
                .getResponse();
        } else {
            // Normal flow
            const state = session.getAttributes(handlerInput, 'state');

            if (state === constants.STATES.GAME) {
                speechText = questions.getPrevAndResume(handlerInput, 'repeat');
            } else if (state === constants.STATES.BONUS_QUESTION) {
                speechText = questions.bonusGetPrev(handlerInput);
            } else {
                speechText = session.getAttributes(handlerInput, 'repromptText');
            }
        }

        session.persist(handlerInput);

        return common.createResponse(handlerInput, `${speechPrefix}${speechText}`);
    }
};

module.exports = AskRefundIntentHandler;