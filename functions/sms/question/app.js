const defaultFromNumber = process.env.TWILIO_SMS_SENDER;
const s3Functions = require('/opt/s3-object-functions.js');
const surveyUtilities = require('/opt/utilities.js');
const twilioSMS = require('/opt/send-sms.js');
const AWS = require('aws-sdk');
AWS.config.region = process.env.DEFAULT_AWS_REGION || 'us-east-1';
const eventbridge = new AWS.EventBridge();

exports.lambdaHandler = async (event, context) => {
    
    console.log("event is ==> ", event);

    let updateUserObject = event.detail.resultsObject;
    
    let surveyResultsFileName = `survey-results/${event.detail.resultsObject.surveyTo}.json`;

    // GET VOICE PROMPTS
    let svpFileName = `voice-prompts/survey-${event.detail.resultsObject.languageSet}.env`;        
    let svpFile = await s3Functions.returnStringFromS3Object(process.env.S3_BUCKET,svpFileName);        
    let surveyVoicePrompts = await surveyUtilities.parseEnvFile(svpFile);    

    // SURVEY CONFIGURATION OBJECT
    let surveyFileName = `survey-config.json`;
    let surveyFile = await s3Functions.returnStringFromS3Object(process.env.S3_BUCKET,surveyFileName);    
    let surveyObject = await JSON.parse(surveyFile);

    switch (event.detail.currentState) {

        case "question":

            let prompt = "";
            if (updateUserObject.questionIndex === 0) {
                prompt = surveyVoicePrompts.firstQuestion
            } else {
                prompt = (updateUserObject.questionIndex == [surveyObject.questions.length - 1]) ? surveyVoicePrompts.lastQuestion : surveyVoicePrompts.nextQuestion;
            }

            let question = surveyVoicePrompts[surveyObject.questions[updateUserObject.questionIndex].questionName]

            // SEND SMS MESSAGE
            let smsObj = {
                body: `${prompt} ${question}`,
                to: event.detail.postBody.From,
                from: defaultFromNumber
            };        
            await twilioSMS.sendTwilioSMS(smsObj);            
            console.log("Twilio SMS Sent...");

            // UPDATE STATE
            updateUserObject.currentState = "question_wait";

            // SAVE TO S3
            await s3Functions.putJsonObjectIntoS3(process.env.S3_BUCKET,surveyResultsFileName,updateUserObject);    

            break;

            case "question_wait":
            
                // RECORD RESULT
                // Add Error handling on user input
                // For now, this will just record integers or strings
                let answer;
                if (surveyObject.questions[updateUserObject.questionIndex].questionType == 'dtmf') {
                    answer = parseInt(event.detail.messageBody);
                } else {
                    answer = event.detail.messageBody
                }
                updateUserObject.questions[updateUserObject.questionIndex] = {answer: answer, answerConfidence: "sms"};

                // UPDATE STATE
                updateUserObject.questionIndex = parseInt(updateUserObject.questionIndex + 1);
                
                if (updateUserObject.questionIndex == surveyObject.questions.length) {
                    console.log("last");
                    updateUserObject.surveyCompleted = Date.now();
                    updateUserObject.surveyStatus = "COMPLETED";
                    updateUserObject.currentState = "final";
                } else {
                    console.log("not last");
                    updateUserObject.currentState = "question";
                }
    
                // SAVE TO S3
                await s3Functions.putJsonObjectIntoS3(process.env.S3_BUCKET,surveyResultsFileName,updateUserObject);    
                
                // ADD EVENT TO EVENTBUS
                let eventParams = surveyUtilities.formatEventBridgeObject(updateUserObject,event.detail.postBody);            
                await eventbridge.putEvents(eventParams).promise();
    
                break;            

    }

};
