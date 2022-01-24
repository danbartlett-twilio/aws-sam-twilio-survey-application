const defaultFromNumber = process.env.TWILIO_SMS_SENDER;
const s3Functions = require('/opt/s3-object-functions.js');
const twilioSMS = require('/opt/send-sms.js');

exports.lambdaHandler = async (event, context) => {
    
    console.log("event is ==> ", event);
       
    // FETCH SURVEY RESULTS RECORD
    let surveyResultsFileName = `survey-results/${event.detail.resultsObject.surveyTo}.json`;
    console.log("surveyResultsFileName is ==> ", surveyResultsFileName);
    let resultsFile = await s3Functions.returnStringFromS3Object(process.env.S3_BUCKET,surveyResultsFileName);    
    let resultsObject = JSON.parse(resultsFile);

    // Do any post survey processing here!
    // We are just going to send the json answers
    // back in a text message

    let message = `******
Here are your answers! This message shows that you can run processing after a survey completes.
${JSON.stringify(resultsObject, null, 4)}
******`;    

    // SEND SMS MESSAGE
    let smsObj = {
        body: message,
        to: event.detail.postBody.From,
        from: defaultFromNumber
    };

    await twilioSMS.sendTwilioSMS(smsObj);            
    console.log("Twilio SMS Sent...");

};
