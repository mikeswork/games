const session = require('../helpers/session');
const common = require('../common');
const VO = require('../voiceOver/voiceOverService');

// The FallbackIntentHandler is not checking for AMAZON.FallbackIntent specifically
// because sometimes character guess intents and movie guess intents are incorrectly
// triggered and fall through to this handler, so we need to capture all unhandled intents.

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest';
    },
    handle(handlerInput) {
        console.log('[FallbackIntentHandler]', "the intent was:", handlerInput.requestEnvelope.request.intent.name);

        const repromptText = session.getAttributes(handlerInput, 'repromptText');
        const speechText = `${VO.get('LETS_TRY_AGAIN')}${repromptText}`;

        return common.createResponse(handlerInput, speechText);
    }
};

module.exports = FallbackIntentHandler;