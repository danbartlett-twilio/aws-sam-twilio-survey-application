const s3Functions = require('/opt/s3-object-functions.js');
const surveyUtilities = require('/opt/utilities.js');
const VoiceResponse = require('twilio').twiml.VoiceResponse;

exports.lambdaHandler = async (event, context) => {
    
    console.log("event is ==> ", event);
    

    // GET VOICE PROMPTS
    let surveyLanguage = event.queryStringParameters.surveyLanguage ? event.queryStringParameters.surveyLanguage : "en-US";
    let svpFileName = `voice-prompts/survey-${surveyLanguage}.env`;
    let svpFile = await s3Functions.returnStringFromS3Object(process.env.S3_BUCKET,svpFileName);    
    console.log("svpFile is ==> ", svpFile);
    let surveyVoicePrompts = await surveyUtilities.parseEnvFile(svpFile);    

    let response;

    const vr = new VoiceResponse();
    
    // CREATE SURVEY RESULTS RECORD
    // KEY => ${event.queryStringParameters.surveyTo}
    let surveyResultsFileName = `survey-results/${event.queryStringParameters.surveyTo}.json`;
    console.log("surveyResultsFileName is ==> ", surveyResultsFileName);
    let resultsFile = await s3Functions.returnStringFromS3Object(process.env.S3_BUCKET,surveyResultsFileName);    
    let resultsObject;    

    if (resultsFile === false) {
        console.log("Create new survey results file...");

        // CREATE & SAVE RESULTS FILE
        let putObject = surveyUtilities.returnInitialResultsFile(event.queryStringParameters.surveyTo,"voice",surveyVoicePrompts.language);
        let putResult = await s3Functions.putJsonObjectIntoS3(process.env.S3_BUCKET,surveyResultsFileName,putObject);    

        console.log("putResult ==> ", putResult);

        resultsObject = putObject;

    } else {
        
        console.log("Found existing survey results file...");

        resultsObject = JSON.parse(resultsFile);

        console.log("Parsed resultsObject is ==> ", resultsObject);
    } 

    try {

        // CHECK TO SEE IF SURVEY HAS ALREADY BEEN COMPLETED
        console.log("resultsObject.surveyStatus ==> ", resultsObject.surveyStatus);
        
        if (resultsObject.surveyStatus === 'COMPLETED') {
            
            vr.say(
                {language: surveyVoicePrompts.language, voice: surveyVoicePrompts.voice},
                surveyVoicePrompts.surveyCompletedAlready
            );
             
            vr.pause({
                length: 2
            });    

            vr.hangup(); 

        } else {

            vr.say(
                {language: surveyVoicePrompts.language, voice: surveyVoicePrompts.voice},
                surveyVoicePrompts.beginSurvey
            );

            vr.redirect({
                method: 'POST'
            }, `/Prod/voice/question?surveyLanguage=${surveyLanguage}&surveyTo=${event.queryStringParameters.surveyTo}&questionIndex=-1`);

        }        

        console.log(vr.toString());
        
        response = surveyUtilities.formatTwimlResponse(200,vr.toString());
                
    } catch (err) {
        console.log(err);
        return err;
    }

    return response;
};