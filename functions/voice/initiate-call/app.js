const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const defaultFromNumber = process.env.TWILIO_PHONE_NUMBER;
const surveyUtilities = require('/opt/utilities.js');
const client = require('twilio')(accountSid, authToken);

function returnFromNumber(toNumber) {
    // Add logic here to set the FROM number
    return defaultFromNumber;
}

exports.lambdaHandler = async (event, context) => {
    
    console.log("event is ==> ", event);
    
    let bodyParams = await surveyUtilities.parsePostBody(event.body);    

    let fromNumber = returnFromNumber(bodyParams.To);

    let surveyTo = bodyParams.To.substring(1); // REMOVE + to facilitate passing as querystring param
    
    let defaultLanguage = bodyParams.defaultLanguage ? bodyParams.defaultLanguage :"en-US";

    await client.calls.create({        
        twiml: `<Response><Redirect method="GET">https://${event.headers.Host}/${event.requestContext.stage}/voice/initial-message?surveyLanguage=${defaultLanguage}&amp;surveyTo=${surveyTo}</Redirect></Response>`,
        to: bodyParams.To,
        from: fromNumber
        })
    .then( (call) => {
        console.log("call ID => ", call.sid);
    });

    let response = surveyUtilities.formatTwimlResponse(201,`{"success":true, "callTo": "${bodyParams.To}"}`);    

    console.log("Response is => ", response);

    return response;
};
