const s3Functions = require('/opt/s3-object-functions.js');
const surveyUtilities = require('/opt/utilities.js');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const AWS = require('aws-sdk');
AWS.config.region = process.env.DEFAULT_AWS_REGION || 'us-east-1';
const eventbridge = new AWS.EventBridge();

exports.lambdaHandler = async (event, context) => {
    
    console.log("event is ==> ", event);
    
    // SURVEY LANGUAGE SPECIFIC PROMPTS
    let surveyLanguage = event.queryStringParameters.surveyLanguage ? event.queryStringParameters.surveyLanguage : "en-US";
    let svpFileName = `voice-prompts/survey-${surveyLanguage}.env`;
    let svpFile = await s3Functions.returnStringFromS3Object(process.env.S3_BUCKET,svpFileName);    
    let surveyVoicePrompts = await surveyUtilities.parseEnvFile(svpFile);

    // SURVEY CONFIGURATION OBJECT
    let surveyFileName = `survey-config.json`;
    let surveyFile = await s3Functions.returnStringFromS3Object(process.env.S3_BUCKET,surveyFileName);    
    let surveyObject = await JSON.parse(surveyFile);
    
    console.log("surveyObject is ==> ", surveyObject);

    // USER RESULTS OBJECT
    let surveyResultsFileName = `survey-results/${event.queryStringParameters.surveyTo}.json`;
    let resultsFile = await s3Functions.returnStringFromS3Object(process.env.S3_BUCKET,surveyResultsFileName);    
    let resultsObject = JSON.parse(resultsFile);    

    let questionIndex = parseInt( event.queryStringParameters.questionIndex);

    // Record answer of last question if not the first question
    if (questionIndex > -1) {

        let bodyParams = await surveyUtilities.parsePostBody(event.body); 

        //console.log("Digits are ==> ", bodyParams.Digits); // undefined if speech
        //console.log("From are ==> ", bodyParams.From);
        //console.log("SpeechResult ==> ", bodyParams.SpeechResult); // undefined if digits
        //console.log("Confidence ==> ", bodyParams.Confidence); // undefined if digits        
        
        let answer;
        let answerConfidence;

        // Add Error handling on user input
        // For now, this will just record integers or strings
        if (surveyObject.questions[questionIndex].questionType === "dtmf") {        
            // SET USER ANSWER FROM SpeechResult
            answer = bodyParams.Digits;
            answerConfidence = "DTMF";            
            
        } else if (surveyObject.questions[questionIndex].questionType === "speech") {
            // SET USER ANSWER FROM DTMF
            answer = bodyParams.SpeechResult;
            answerConfidence = bodyParams.Confidence;

        }

        resultsObject.questions[questionIndex] = {answer: answer, answerConfidence: answerConfidence};
        
        if (questionIndex == surveyObject.questions.length - 1) {            
            resultsObject.surveyCompleted = Date.now();
            resultsObject.surveyStatus =  'COMPLETED';          
        }

        let putResult = await s3Functions.putJsonObjectIntoS3(process.env.S3_BUCKET,surveyResultsFileName,resultsObject);    

    }

    // Move to the next question
    questionIndex++;

    let response;

    const vr = new VoiceResponse();
    
    try {

        // Check if all questions have been asked
        if (questionIndex === surveyObject.questions.length) {
            // END QUESTIONS

            vr.say(
                {language: surveyVoicePrompts.language, voice: surveyVoicePrompts.voice},
                surveyVoicePrompts.finalGoodbye
            );  
            vr.hangup();
            
            // POST EVENT TO EVENTBRIDGE
            let finalUserObject = { currentState: 'post-survey', surveyTo: event.queryStringParameters.surveyTo };
            let postBody = { From: '+'+event.queryStringParameters.surveyTo };
            let eventParams = surveyUtilities.formatEventBridgeObject(finalUserObject,postBody);            
            await eventbridge.putEvents(eventParams).promise();
            console.log("Event sent to EventBridge for post processing...");            

        } else {

            let prompt = "";
            if (questionIndex === 0) {
                prompt = surveyVoicePrompts.firstQuestion
            } else {
                prompt = (questionIndex === [surveyObject.questions.length - 2]) ? surveyVoicePrompts.lastQuestion : surveyVoicePrompts.nextQuestion;
            }
            
            vr.say(
                    {language: surveyVoicePrompts.language, voice: surveyVoicePrompts.voice},
                    prompt
                );

            vr.pause({
                length: 2
            });    

            const gather = vr.gather({
                action: `/Prod/voice/question?surveyLanguage=${surveyLanguage}&surveyTo=${event.queryStringParameters.surveyTo}&questionIndex=${questionIndex}`,
                method: 'POST',
                input: surveyObject.questions[questionIndex].questionType,
                numDigits: 1,
                language: surveyVoicePrompts.language
            });        

            
            gather.say(
                {language: surveyVoicePrompts.language, voice: surveyVoicePrompts.voice},
                surveyVoicePrompts[surveyObject.questions[questionIndex].questionName]
            );

            vr.redirect({
                method: 'GET'
            }, `/Prod/voice/begin-survey?surveyLanguage=${surveyLanguage}&surveyTo=${event.queryStringParameters.surveyTo}`);            
        
        }

        console.log(vr.toString());

        response = await surveyUtilities.formatTwimlResponse(200,vr.toString());        
                
    } catch (err) {
        console.log(err);
        return err;
    }

    return response;
};