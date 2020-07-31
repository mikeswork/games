const constants = require('../constants');
const session = require('../helpers/session');
const questions = require('../questions');
const scores = require('../scores');
const VO = require('../voiceOver/voiceOverService');
const isp = require('../helpers/isp');
const common = require('../common');

const HelpIntentHandler = {
    canHandle(handlerInput) {
        if (handlerInput.requestEnvelope.request.type === 'IntentRequest') {
            if (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent') {
                return true;
            } else {
                // Alex treats "help" as a movie name and fictional character so we need to handle these cases
                if (handlerInput.requestEnvelope.request.intent.name === 'MCGuess') {
                    const slots = handlerInput.requestEnvelope.request.intent.slots;
                    const movieSlot = slots['movieName'] || {};
                    const charSlot = slots['characterName'] || {};
                    const utterance = movieSlot.value || charSlot.value || '';

                    return utterance === 'help';
                } else {
                    return false;
                }
            }
        } else {
            return false;
        }
    },
    async handle(handlerInput) {
        console.log('[HelpIntentHandler]');
        
        let speechText = '';
        let aplType = '';
        let voID;
        
        // If user launches skill via One-Shot Phrase "Alexa, ask Name the Movie for help"
        // we need to set the correct state so that the game can start and the pertinent
        // help speech & apl text show up:
        if (handlerInput.requestEnvelope.session.new === true) {
            aplType = 'prompt';
            await isp.loadProduct(handlerInput);
            
            if (isp.isPremiumExperience(handlerInput)) {
                session.setAttributes(handlerInput, { 
                    "state": constants.STATES.PLAYER_COUNT_PROMPT,
                    "repromptText": VO.get('REPROMPT_HOW_MANY_ARE_PLAYING') 
                });
            } else {
                session.setAttributes(handlerInput, { 
                    "state": constants.STATES.NEW_FROM_ONESHOT_PROMPT,
                    "repromptText": VO.get('REPROMPT_START_NEW_GAME')
                });
            }
        }

        const state = session.getAttributes(handlerInput, 'state');
        
        switch (state) {
            case constants.STATES.NEW_FROM_ONESHOT_PROMPT:
                speechText = `${VO.get('HELP_GAME_DESCRIPTION_START')} ${VO.get('REPROMPT_START_NEW_GAME')}`;
                break;

            case constants.STATES.GAME:
                const playerCount = session.getAttributes(handlerInput, 'playerCount') || 1;

                speechText = VO.get('HELP_GAME_DESCRIPTION_START');
                
                if (isp.isPremiumExperience(handlerInput) && playerCount === 1) {
                    speechText += VO.get('HELP_GAME_MAGIC_DESCRIPTION');
                }
                
                speechText += playerCount === 1 ? VO.get('HELP_GAME_DESCRIPTION_END') : VO.get('HELP_MULTIPLAYER_GAME_DESCRIPTION_END');
                speechText += VO.get('REPROMPT_READY_TO_GET_BACK');
                
                session.setAttributes(handlerInput, { 
                    "state": constants.STATES.RETURN_PROMPT,
                    "repromptText": VO.get('REPROMPT_READY_TO_GET_BACK')
                });

                aplType = 'prompt';
                break;
                
            case constants.STATES.RESUME_PROMPT:
                speechText = VO.get('HELP_RESUME_DESCRIPTION');
                break;
                
            case constants.STATES.NEW_PROMPT:  // score was read, asking if user wants to start new game
                speechText = scores.get(handlerInput, true);
                break;
                
            case constants.STATES.RESTART_PROMPT:
                speechText = VO.get('HELP_RESTART_DESCRIPTION');
                break;

            case constants.STATES.BONUS_PROMPT:  // score was just read and bonus question available
                speechText = VO.get('HELP_BONUS_PROMPT_DESCRIPTION_1');

                // "... a bonus question, worth...":
                voID = [
                    'ONE_POINT',
                    'TWO_POINTS',
                    'THREE_POINTS',
                    'FOUR_POINTS',
                    'FIVE_POINTS',
                    'SIX_POINTS',
                    'SEVEN_POINTS',
                    'EIGHT_POINTS',
                    'NINE_POINTS',
                    'TEN_POINTS'][constants.BONUS_POINTS-1];
                speechText += VO.get(voID, '.');

                speechText += VO.get('HELP_BONUS_PROMPT_DESCRIPTION_2');

                break;

            case constants.STATES.BONUS_QUESTION:
                speechText = VO.get('HELP_BONUS_QUESTION_DESCRIPTION_1');

                // "... you'll earn...":
                voID = [
                    'ONE_POINT',
                    'TWO_POINTS',
                    'THREE_POINTS',
                    'FOUR_POINTS',
                    'FIVE_POINTS',
                    'SIX_POINTS',
                    'SEVEN_POINTS',
                    'EIGHT_POINTS',
                    'NINE_POINTS',
                    'TEN_POINTS'][constants.BONUS_POINTS-1];
                speechText += VO.get(voID);

                speechText += VO.get('HELP_BONUS_QUESTION_DESCRIPTION_2');

                session.setAttributes(handlerInput, { 
                    "state": constants.STATES.BONUS_PROMPT,
                    "repromptText": VO.get('REPROMPT_ANSWER_BONUS')
                });
                break;

            case constants.STATES.PLAYER_COUNT_PROMPT:
                speechText = VO.get('REPROMPT_HOW_MANY_ARE_PLAYING');
                break;
        }
        
        session.persist(handlerInput);

        return common.createResponse(handlerInput, speechText, aplType);
    }
};

module.exports = HelpIntentHandler;