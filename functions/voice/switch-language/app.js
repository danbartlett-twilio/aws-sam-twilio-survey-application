const surveyUtilities = require('/opt/utilities.js');
const VoiceResponse = require('twilio').twiml.VoiceResponse;

exports.lambdaHandler = async (event, context) => {
    
    console.log("event is ==> ", event);
    
    let bodyParams = await surveyUtilities.parsePostBody(event.body); 

    //console.log("Digits are ==> ", bodyParams.Digits); // undefined if speech
    //console.log("From are ==> ", bodyParams.From);
    //console.log("SpeechResult ==> ", bodyParams.SpeechResult); // undefined if digits
    //console.log("Confidence ==> ", bodyParams.Confidence); // undefined if digits

    let surveyLanguage = event.queryStringParameters.surveyLanguage ? event.queryStringParameters.surveyLanguage : "en-US";    
    
    if (bodyParams.Digits === undefined) {        
        if ( bodyParams.SpeechResult.toUpperCase().startsWith(event.queryStringParameters.languageSwitchVoiceTargetName.toUpperCase()) ) {
            // MATCH CHANGE LANGUAGE
            surveyLanguage = event.queryStringParameters.languageSwitchVoiceTarget;
        }
    } else if (parseInt(bodyParams.Digits) === 9) {
        surveyLanguage = event.queryStringParameters.languageSwitchVoiceTarget;
    }
    
    console.log("final surveyLanguage is ==> ", surveyLanguage);

    let response;

    const vr = new VoiceResponse();
    
    try {
    
        vr.redirect({
            method: 'GET'
        }, `/Prod/voice/begin-survey?surveyLanguage=${surveyLanguage}&surveyTo=${event.queryStringParameters.surveyTo}`);
    
        console.log(vr.toString());

        response = await surveyUtilities.formatTwimlResponse(200,vr.toString());        

                
    } catch (err) {
        console.log(err);
        return err;
    }

    return response;
};
