const s3Functions = require('/opt/s3-object-functions.js');
const surveyUtilities = require('/opt/utilities.js');
const VoiceResponse = require('twilio').twiml.VoiceResponse;

exports.lambdaHandler = async (event, context) => {
    
    // console.log("event is ==> ", event);
    
    let surveyLanguage = event.queryStringParameters.surveyLanguage ? event.queryStringParameters.surveyLanguage : "en-US";
    
    let svpFileName = `voice-prompts/survey-${surveyLanguage}.env`;  
    let svpFile = await s3Functions.returnStringFromS3Object(process.env.S3_BUCKET,svpFileName);        
    let surveyVoicePrompts = await surveyUtilities.parseEnvFile(svpFile); 

    // console.log("surveyVoicePrompts => ", surveyVoicePrompts);

    let response;

    const vr = new VoiceResponse();
    
    try {
    
        vr.say(
                {language: surveyVoicePrompts.language, voice: surveyVoicePrompts.voice},
                surveyVoicePrompts.welcome 
            );

        vr.pause({
            length: 2
        });    

        const gather = vr.gather({
            action: `/Prod/voice/switch-language?surveyLanguage=${surveyLanguage}&surveyTo=${event.queryStringParameters.surveyTo}&languageSwitchVoiceTarget=${surveyVoicePrompts.languageOptionLanguage}&languageSwitchVoiceTargetName=${surveyVoicePrompts.languageOptionLanguageName}`,
            method: 'POST',
            input: 'dtmf speech',
            numDigits: 1
        });        

        gather.say(
            {language: surveyVoicePrompts.languageOptionLanguage, voice: surveyVoicePrompts.languageOptionVoice},
            `${surveyVoicePrompts.languageOption} ${surveyVoicePrompts.languageOptionLanguageName}`
        );

        vr.redirect({
            method: 'GET'
        }, `/Prod/voice/begin-survey?surveyLanguage=${surveyLanguage}&surveyTo=${event.queryStringParameters.surveyTo}`);        
                
        response = surveyUtilities.formatTwimlResponse(200,vr.toString());        
                
    } catch (err) {
        console.log(err);
        return err;
    }

    return response;
};
