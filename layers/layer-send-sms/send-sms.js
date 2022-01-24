const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

exports.sendTwilioSMS = async (msgParams) => {

    await client.messages.create(msgParams)
        .then((message) => {
            // Success, return message SID
            console.log("Twilio SMS message ==> ", message);
            return true;
        })
        .catch((e) => {
            console.log("Error sending Twilio SMS ==> ", e);
            // Error, return error object
            return false
        });    

};