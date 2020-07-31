module.exports = {
    getAttributes(handlerInput, attributeName) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};

        if (attributeName) {
            // Return specific attribute if passed
            return sessionAttributes.hasOwnProperty(attributeName) ? sessionAttributes[attributeName] : undefined;
        } else {
            // Return all attributes
            return sessionAttributes;
        }
    },

    setAttributes(handlerInput, newAttributes) {
        const attributesManager = handlerInput.attributesManager;
        const previousAttributes = attributesManager.getSessionAttributes() || {};
        const attributesToUpdate = Object.assign(previousAttributes, { "lastActivityTime": Date.now() }, newAttributes || {});
        
        attributesManager.setSessionAttributes(attributesToUpdate);
    },
    
    async persist(handlerInput) {
        const attributesManager = handlerInput.attributesManager;
        const sessionAttributes = attributesManager.getSessionAttributes() || {};
        
        attributesManager.setPersistentAttributes(sessionAttributes);
        await attributesManager.savePersistentAttributes();
    }
}