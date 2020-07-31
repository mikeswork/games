// Handles Connections.Response after a Buy/Upsell. Handles case when user cancels it as well.
const constants = require('../constants');
const common = require('../common');
const session = require("../helpers/session");
const questions = require('../questions');
const VO = require('../voiceOver/voiceOverService');

const BuyResponseHandler = {
	canHandle(handlerInput) {
		return (
			handlerInput.requestEnvelope.request.type === "Connections.Response" &&
			(handlerInput.requestEnvelope.request.name === "Buy" ||
		     handlerInput.requestEnvelope.request.name === "Upsell" ||
		     handlerInput.requestEnvelope.request.name === "Cancel")
		);
	},
	handle(handlerInput) {
		console.log("[BuyResponseHandler]");
		console.log("handlerInput.requestEnvelope.request", handlerInput.requestEnvelope.request);

		const locale = handlerInput.requestEnvelope.request.locale;
		const ms = handlerInput.serviceClientFactory.getMonetizationServiceClient();
		const productId = handlerInput.requestEnvelope.request.payload.productId;

		return ms.getInSkillProducts(locale).then(function handlePurchaseResponse(result) {
			const product = result.inSkillProducts.filter(record => record.productId === productId)[0];
			console.log(`PRODUCT = ${JSON.stringify(product)}`);
			session.setAttributes(handlerInput, { "availableProduct": product });  // Already set, but this refreshes its values

			let speechSuffix = "";
			let aplType = 'prompt';
			const state = session.getAttributes(handlerInput, "state");

			// Determine what to say say after returning to skill and giving result of ISP
			if (state === constants.STATES.GAME) {
				speechSuffix = questions.getPrevAndResume(handlerInput, 'lets-get-back');
				aplType = 'question';
			} else {
				speechSuffix = VO.get('REPROMPT_START_NEW_GAME');

				session.setAttributes(handlerInput, { 
					"state": constants.STATES.NEW_PROMPT,
					"repromptText": VO.get('REPROMPT_START_NEW_GAME')
				});
			}

			let speechText = "";  // In Alexa voice

			// Determine what to say regarding ISP result
			if (handlerInput.requestEnvelope.request.status.code === "200") {

				// If user asked for a refund, skip creating speechText and just resume
				if (handlerInput.requestEnvelope.request.name !== "Cancel") {
					const payload = handlerInput.requestEnvelope.request.payload;
					console.log("payload.purchaseResult is:", payload.purchaseResult);
					switch (payload.purchaseResult) {
						case "PENDING_PURCHASE":
							speechText = '';  // ISP tells user it's asking parents for permission 
							break;
						case "ACCEPTED":
							// Alexa in ISP already tells you "You bought The Mega Pack"
							speechText = `You've unlocked ${product.summary}. If you don't know the answer to a question, now you can say "magic" to get the answer.`;
							break;
						case "DECLINED":
							// Declined upsell or buy

							// If user declined upsell, request.payload has 'message' with "Skill Upsell was declined."
							const callbackMessage = payload.hasOwnProperty('message') ? payload.message : '';
							if (callbackMessage.indexOf('declined') > -1) {
								speechText = "Okay.";
							}
							// Else user declined buy and Alexa in ISP already says "Okay"

							break;
						case "ALREADY_PURCHASED":
							speechText = `You already own ${product.name}.`;
							break;
						default:
							console.log(
								`unhandled purchaseResult: ${payload.purchaseResult}`
							);
							break;
					}
					
				}

			// Failure, status code is not 200
			} else {
				console.log(
					`Connections.Response indicated failure. error: ${handlerInput.requestEnvelope.request.status.message}`
				);
				speechText = "There was an error handling your purchase request. Please try again or contact us for help.";
			}

			speechText = `${speechText} ${speechSuffix}`

			session.persist(handlerInput);

			return common.createResponse(handlerInput, speechText, aplType);
		});
	}
};

module.exports = BuyResponseHandler;
