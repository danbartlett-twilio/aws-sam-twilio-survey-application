const s3Functions = require('/opt/s3-object-functions.js');
const surveyUtilities = require('/opt/utilities.js');
const twilioSecurity = require('/opt/validate-twilio-header.js');
const AWS = require('aws-sdk');
const eventbridge = new AWS.EventBridge();

exports.lambdaHandler = async (event, context) => {
    
    console.log("event is ==> ", event);
    
    let bodyParams = {};
    let surveyTo = "";
    let defaultLanguage = process.env.DEFAULT_LANGUAGE;
    
    if (event.source != undefined && event.source == process.env.EVENT_SOURCE_NAME) {
        // This is an event trigger from EventBridge
        bodyParams.From = event.detail.resultsObject.From;
        bodyParams.Body = "";
        surveyTo = event.detail.resultsObject.surveyTo;
        if(event.detail.language != undefined) {
            defaultLanguage = event.detail.resultsObject.language;
        }         
    } else {
        // This is a POST from the REST API
        // Parse the post body parameters
        bodyParams = await surveyUtilities.parsePostBody(event.body);    
        surveyTo = bodyParams.From.substring(1); // REMOVE + to facilitate passing as querystring param

        // CHECK X-Twilio-Signature
        let securityCheck = await twilioSecurity.validateTwilioXHeader(event,bodyParams);
        console.log("Security Check on X-Twilio-Signature => ", securityCheck);

        // IF THIS CHECK FAILS, THEN STOP PROCESSING AND SEND ALERTS / LOGS!

    }

    // FETCH OR CREATE SURVEY RESULTS RECORD
    // KEY => ${post body surveyTo}
    let surveyResultsFileName = `survey-results/${surveyTo}.json`;
    console.log("surveyResultsFileName is ==> ", surveyResultsFileName);
    let resultsFile = await s3Functions.returnStringFromS3Object(process.env.S3_BUCKET,surveyResultsFileName);    
    let resultsObject;    

    if (resultsFile === false) {
        console.log("Create new survey results file...");

        // CREATE & SAVE RESULTS FILE
        let putObject = surveyUtilities.returnInitialResultsFile(surveyTo,"sms",defaultLanguage);
        await s3Functions.putJsonObjectIntoS3(process.env.S3_BUCKET,surveyResultsFileName,putObject);    

        console.log("Saved new object to S3...");
        
        resultsObject = putObject;

    } else {
        
        console.log("Found existing survey results file...");

        resultsObject = JSON.parse(resultsFile);

        console.log("Parsed resultsObject is ==> ", resultsObject);
    }   

    let response = surveyUtilities.formatTwimlResponse(201,`{"success":true, "callTo": "${bodyParams.To}"}`);    

    console.log("Response is => ", response);  

    // ADD EVENT TO EVENTBUS FOR PROCESSING
    let messageBody = bodyParams.Body ? bodyParams.Body.replace(/\+/g, " ").trim() : "";
    let eventParams = surveyUtilities.formatEventBridgeObject(resultsObject,bodyParams,messageBody);
    console.log("eventParams ==> ", eventParams);            
    
    const result = await eventbridge.putEvents(eventParams).promise();    
    console.log("result of eventbridge put ==> ", result);

    return response;

};