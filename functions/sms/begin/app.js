const defaultFromNumber = process.env.TWILIO_SMS_SENDER;
const s3Functions = require('/opt/s3-object-functions.js');
const surveyUtilities = require('/opt/utilities.js');
const twilioSMS = require('/opt/send-sms.js');
const AWS = require('aws-sdk');
const eventbridge = new AWS.EventBridge();

exports.lambdaHandler = async (event, context) => {
    
    console.log("event is ==> ", event);

    let updateUserObject = event.detail.resultsObject;
    
    let surveyResultsFileName = `survey-results/${event.detail.resultsObject.surveyTo}.json`;

    // GET VOICE PROMPTS
    let svpFileName = `voice-prompts/survey-${event.detail.resultsObject.languageSet}.env`;        
    let svpFile = await s3Functions.returnStringFromS3Object(process.env.S3_BUCKET,svpFileName);        
    let surveyVoicePrompts = await surveyUtilities.parseEnvFile(svpFile);    

    switch (event.detail.currentState) {

        case "begin":
            
            // SEND SMS MESSAGE
            let smsObj = {
                body: surveyVoicePrompts.beginSurvey,
                to: event.detail.postBody.From,
                from: defaultFromNumber
            };
        
            await twilioSMS.sendTwilioSMS(smsObj);            
            console.log("Twilio SMS Sent...");

            // UPDATE STATE
            updateUserObject.currentState = "question";

            // SAVE TO S3
            await s3Functions.putJsonObjectIntoS3(process.env.S3_BUCKET,surveyResultsFileName,updateUserObject);    

            // ADD EVENT TO EVENTBUS
            let eventParams = surveyUtilities.formatEventBridgeObject(updateUserObject,event.detail.postBody);            
            await eventbridge.putEvents(eventParams).promise();

            break;
        
    }

};
