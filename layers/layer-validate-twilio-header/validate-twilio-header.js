const twilio = require('twilio');


// Function used to sort Post Parameters alphabetically
function sortObj(obj) {
    return Object.keys(obj).sort().reduce(function (result, key) {
        result[key] = obj[key];
        return result;
    }, {});
}  

/*
*
* This function uses Twilio SDK to validate that the webhook
* is coming from Twilio. Uses the X-Twilio-Signature header
*
*/

exports.validateTwilioXHeader = async (event,postObject) => {

    const sortedParams = sortObj(postObject);

    let twilioSignature = event.headers['X-Twilio-Signature'];

    let url = `https://${event.requestContext.domainName}${event.requestContext.path}`;

    console.log("twilioSignature ==> ", twilioSignature);
    console.log("url ==> ", url);
    console.log("sortedParams ==> ", sortedParams);

    const requestIsValid = await twilio.validateRequest(
        process.env.TWILIO_AUTH_TOKEN,
        twilioSignature,
        url,
        sortedParams
      );
    
    console.log("requestIsValid => ", requestIsValid);

    return requestIsValid;

};