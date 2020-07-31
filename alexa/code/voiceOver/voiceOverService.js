const VoiceOverData = require('../../data/voiceOverData.json');
const Utils = require('../helpers/util');
// const _ = require('lodash');

module.exports = class VoiceOverService {
	// MAIN ACCESORS
	static get(id, punct = '') {
		const data = this.getData(id);
		return this.dataToSSML(data, punct) || this.dataToString(data, punct);
	}

    static getText(id, punct = '') {
        return this.dataToString(this.getData(id), punct);
    }
	
	static getRandomPrefixed(prefix, punct = '') {
		const prefixRegex = new RegExp(`^${prefix}`);
		const allPrefixed = Object.keys(VoiceOverData)
		.filter(key => prefixRegex.test(key))
		.map(id => VoiceOverData[id]);
		
		const randomVO = allPrefixed[Math.floor(Math.random() * allPrefixed.length)];
		return this.dataToSSML(randomVO, punct) || this.dataToString(randomVO, punct);
	}

	static getData(id) {
		return VoiceOverData[id];
	}
	
	// CONVERSION HELPERS
	static dataToString(voData, punct) {
		return `${(voData || {}).text}${punct} `;
	}

	static dataToSSML(voData, punct) {
		let voiceOverFileName = (voData || {}).snd;
		let ssmlTag = undefined;
		let ssmlBreak;

		// Amazon made change so Alexa now reads punctuations literally instead of pausing.
		// We need to convert punctuations like , . into <break/> tags.
		switch (punct) {
			case ',':
				ssmlBreak = '<break strength="medium"/>';
				break;
			
			case '.':
				ssmlBreak = '<break strength="strong"/>';
				break;

			default:
				ssmlBreak = '';
		}

		if (voiceOverFileName) {
            const url = `https://***/${voiceOverFileName}`;
			ssmlTag = `<audio src="${url}" />${ssmlBreak} `;
			console.log("ssmlTag:", ssmlTag);
		}
		return ssmlTag;
	}

	static getRightMovie(movieTitle, punct) {
	    const rightAnswerVoId = movieTitle.replace(/\s/g, '_').replace(/\W/g, '').toUpperCase() + "_WAS_RIGHT_ANSWER";
	    return this.get(rightAnswerVoId, punct);
	}

	static getRightCharacter(characterName, punct) {
		const rightAnswerVoId = characterName.replace(/\s/g, '_').replace(/\W/g, '').toUpperCase() + "_WAS_RIGHT_CHARACTER";
	    return this.get(rightAnswerVoId, punct);
	}

	static getCharacterQuote(characterName, type = 'auto', punct) {
		const quoteId = characterName.replace(/\s/g, '_').replace(/\W/g, '').toUpperCase() + "_QUOTE";

		if (type === 'text') {
			return this.getText(quoteId, punct);
		} else {
			return this.get(quoteId, punct);
		}
	}
};
