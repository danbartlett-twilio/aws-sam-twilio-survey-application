const defaultFromNumber = process.env.TWILIO_MESSAGING_SENDER;
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

        case "welcome":                    

            // SEND SMS MESSAGE
            let smsObj = {
                body: `${surveyVoicePrompts.welcome} 
                
${surveyVoicePrompts.languageOptionSMS}`,
                to: event.detail.postBody.From,
                from: defaultFromNumber
            };
        

            await twilioSMS.sendTwilioSMS(smsObj);            
            console.log("Twilio SMS Sent...");

            // UPDATE STATE
            updateUserObject.currentState = "welcome_wait";

            // SAVE TO S3
            await s3Functions.putJsonObjectIntoS3(process.env.S3_BUCKET,surveyResultsFileName,updateUserObject);    

            break;

        case "welcome_wait":

            // PARSE RESPONSE 

            if (event.detail.messageBody.toLowerCase() === surveyVoicePrompts.welcomeContinue.toLowerCase()) {

                // BEGIN SURVEY
                                
                updateUserObject.currentState = "begin";
                
            } else {

                const languageResponses = surveyVoicePrompts.languageOptionLanguageReply.split(/,/);
                
                const index = languageResponses.findIndex(element => {
                    return element.toLowerCase() === event.detail.messageBody.toLowerCase();
                });
                
                if (index > -1) {
                    //SWITCH LANGUAGE
                    updateUserObject.languageSet = surveyVoicePrompts.languageOptionLanguage;
                    updateUserObject.currentState = "begin";
                } else {
                    // GO BACK TO WELCOME
                    updateUserObject.currentState = "welcome";
                }
                
            }
            
            // SAVE TO S3
            await s3Functions.putJsonObjectIntoS3(process.env.S3_BUCKET,surveyResultsFileName,updateUserObject);    

            // ADD EVENT TO EVENTBUS
            let eventParams = surveyUtilities.formatEventBridgeObject(updateUserObject,event.detail.postBody);            
            await eventbridge.putEvents(eventParams).promise();

            break;
        
    }

};
