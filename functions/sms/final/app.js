const defaultFromNumber = process.env.TWILIO_MESSAGING_SENDER;
const s3Functions = require('/opt/s3-object-functions.js');
const surveyUtilities = require('/opt/utilities.js');
const twilioSMS = require('/opt/send-sms.js');
const AWS = require('aws-sdk');
const eventbridge = new AWS.EventBridge();

exports.lambdaHandler = async (event, context) => {
    
    console.log("event is ==> ", event);
    
    // GET VOICE PROMPTS
    let svpFileName = `voice-prompts/survey-${event.detail.resultsObject.languageSet}.env`;        
    let svpFile = await s3Functions.returnStringFromS3Object(process.env.S3_BUCKET,svpFileName);        
    let surveyVoicePrompts = await surveyUtilities.parseEnvFile(svpFile);    

    
    switch (event.detail.currentState) {

        case "final":
            
            // SEND SMS MESSAGE
            let smsObj = {
                body: surveyVoicePrompts.finalGoodbye,
                to: event.detail.postBody.From,
                from: defaultFromNumber
            };
        
            await twilioSMS.sendTwilioSMS(smsObj);            
            console.log("Twilio SMS Sent...");

            let surveyResultsFileName = `survey-results/${event.detail.resultsObject.surveyTo}.json`;
            
            let finalUserObject = event.detail.resultsObject;
            
            finalUserObject.currentState = 'post-survey';
            
            // SAVE TO S3
            await s3Functions.putJsonObjectIntoS3(process.env.S3_BUCKET,surveyResultsFileName,finalUserObject);                

            // EDIT THE OBJECT (unsaved) SENT TO EVENTBRIDGE
            // TO TRIGGER POST PROCESSING
            finalUserObject.currentState = 'post-survey-results'; 

            // ADD EVENT TO EVENTBUS
            let eventParams = surveyUtilities.formatEventBridgeObject(finalUserObject,event.detail.postBody);            
            await eventbridge.putEvents(eventParams).promise();

            break;

        case "post-survey":
        
            // SEND SMS MESSAGE
            let smsObjCompleted = {
                body: surveyVoicePrompts.surveyCompletedAlready,
                to: `+${event.detail.resultsObject.surveyTo}`,
                from: defaultFromNumber
            };
        
            await twilioSMS.sendTwilioSMS(smsObjCompleted);            
            console.log("Twilio SMS Sent...");

            break;            
        
    }

};
