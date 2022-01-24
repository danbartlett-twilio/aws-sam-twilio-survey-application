const surveyUtilities = require('/opt/utilities.js');
const AWS = require('aws-sdk');
AWS.config.region = process.env.DEFAULT_AWS_REGION || 'us-east-1';
const eventbridge = new AWS.EventBridge();

exports.lambdaHandler = async (event, context) => {
    
    console.log("event is ==> ", event);
    
    // Pull Post Params to initiate SMS Survey
    let bodyParams = await surveyUtilities.parsePostBody(event.body);    
    let fromNumber = bodyParams.To;
    let surveyTo = bodyParams.To.substring(1); // REMOVE + to facilitate passing as querystring param
    let defaultLanguage = bodyParams.defaultLanguage ? bodyParams.defaultLanguage : process.env.DEFAULT_LANGUAGE;

    // PUT and Event to EventBridge
    let initiateObject = {
        currentState: 'initiate-sms',
        From: fromNumber,
        surveyTo: surveyTo,
        language: defaultLanguage
    };
    let eventParams = surveyUtilities.formatEventBridgeObject(initiateObject,{},"");            
    await eventbridge.putEvents(eventParams).promise();

    // Return a response to http POST request
    let response = surveyUtilities.formatTwimlResponse(201,`{"success":true, "smsTo": "${bodyParams.To}"}`);    
    return response;
};
