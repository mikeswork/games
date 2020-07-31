const AWS = require('aws-sdk');

const s3SigV4Client = new AWS.S3({
    signatureVersion: 'v4'
});

const session = require('./session');


module.exports.getS3PreSignedUrl = function getS3PreSignedUrl(s3ObjectKey) {

    const bucketName = process.env.S3_PERSISTENCE_BUCKET;
    const s3PreSignedUrl = s3SigV4Client.getSignedUrl('getObject', {
        Bucket: bucketName,
        Key: s3ObjectKey,
        Expires: 60*1 // the Expires is capped for 1 minute
    });
    // console.log(`Util.s3PreSignedUrl: ${s3ObjectKey} URL ${s3PreSignedUrl}`);
    return s3PreSignedUrl;

};

// Return number of current player based on the current round (e.g. 1, 2, 3, or 4)
module.exports.roundToPlayer = (currentRound, players) => {
    return (currentRound % players) ? (currentRound % players) : players;
};

module.exports.getIspCongratsText = (handlerInput) => {
    let speechText = '';
    const product = session.getAttributes(handlerInput, 'availableProduct');
    
    if (product) {
        speechText = `Thanks for buying ${product.name}! You've unlocked ${product.summary}. `;
        speechText += `If you don't know the answer to a question, now you can say "magic" to get the answer. `;
    }
    
    return speechText;
};