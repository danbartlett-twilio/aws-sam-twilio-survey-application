# Template for Interactive Serverless Applications using Twilio Voice and Messaging Channels

## ...and also handles multiple languages!

Because of the well-documented benefits of serverless computing (scalability, event driven, cost, speed), I thought it would be helpful to our customers to show how organizations could build serverless applications to leverage the power of cloud computing and Twilio's awesome APIs.

This blog will walk you through deploying a serverless application in AWS and provisioning Voice and Messaging channels in Twilio to build a cloud application that can host a survey over either voice or messaging channels. The serverless application is managed from json configuration files and survey results are also saved as json file. The survey created by this application could be initiated after a support call, a purchase, or any customer engagement. This code base could also be used as a starter or template for anything you want to build to take advantage of Twilio's Voice and Messaging APIs. For good measure, **this survey is ALSO multilingual** as this is a common ask for our global customers. Language content and configurations are stored in external env files. 

## Let's start with the architecture diagram...

![Template for Interactive Serverless Applications using Twilio Voice and Messaging Channels](https://user-images.githubusercontent.com/78064764/150879699-eff87bba-2d8c-4a9c-8727-811783194149.png)

Going left to right, the end users will interact with either a voice call or a sms conversation. The Twilio container features our Messaging and Programmable Voice APIs. The AWS layer contains the bulk of the functionality for this application. Last, the enterprise can initiate these interactions from their internal systems.

It is important to point out that Voice and Messaging are inherently different channels -- Voice calls are synchronous connections while Messaging is asynchronous. For Voice calls, this application leverages Twilio's Programmable Voice to maintain the synchronous connection while making rest calls to the serverless application to dynamically collect instructions on how to handle the call. Being asynchronous, Messaging interacts with the application via a single webhook while the serverless application needs to maintain state to be able to dynamically interact with the end user.

### AWS Resources

All of the AWS components of the serverless application are provided as IAAC and deployed via CloudFormation into AWS. Here is an overview of the components:

- AWS SAM => an open-source framework that enables you to build serverless applications on AWS
- AWS Lambda => serverless compute service
- API Gateway => managed api service
- S3 => Persistence layer used to store configuration and data (could be something else)
- EventBridge => serverless event bus

Go through the commented **template.yaml** file to review the resources that will be created upon deploy. 

### In your Twilio stack you will utlize:

- Programmable Voice
- Messaging
- Phone Numbers

## Twilio Studio

Before we begin, I want to point out that [Twilio Studio](https://www.twilio.com/studio) is one of my favorite Twilio products. Twilio Studio allows you to visually build interactive workflows on multiple Twilio channels. If you have not researched Twilio Studio [Studio Docs](https://www.twilio.com/docs/studio), I encourage you to do so!

This template offers some similar capabilities to Stuido, but in an all code environment. This template could be an alternative solution that allows you to build channel interactivity from within your AWS account. This flexibility could unclock additional capabilities and meet additional requirements. 

In addition, this template could be used in conjuction with Twilio Studio or other Twilio products where you need to generate TwiML or make API calls. Building this functionality in the cloud AND using serverless technowlogies has many benefits!

### Prerequisites

- Twilio Account
- AWS Account with permissions to provision Lambdas, a S3 bucket, IAM Roles &  Policies, an API Gateway, and a custom EventBus.
- [AWS SAM CLI installed](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html)

## Let's build it!

Here are the basic step

1. Provision Twilio Phone Number
2. Add Twilio Credentials to AWS Parameter Store
3. Download code
4. Deploy Code
5. Upload config files to S3
6. Set webhook url for Messaging
7. Try it out! 

## 1. Provision Twilio Phone Number

Purchasing a phone number from Twilio is a snap. Login to your Twilio Account and then select PHONE NUMBERS > MANAGE > BUY A NUMBER. 

Here is [Twilio blog](https://support.twilio.com/hc/en-us/articles/223183168-Buying-a-toll-free-number-with-Twilio) that explains this process in more details.

Copy the phone number that you purchase to use later...

## 2. Add Parameters to Parameter Store

Making sure that you never include credentials in your code is a core security tenant. So we are going to use AWS Parameter Store to save our credentials. The compute components will be able to access these credentials at runtime.

From your AWS Console, go to **Systems Manager**. Next, select **Parameter Store**.

Select **Create parameter** and enter values for:

- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER
- TWILIO_MESSAGE_SERVICE

Find your TWILIO_ACCOUNT_SID and TWILIO_AUTHTOKEN from the Account Info card on the dashboard page for the Twilio Account you are using for this project.

For TWILIO_PHONE_NUMBER and the TWILIO_MESSAGE_SERVICE, use the phone number that you bought in step 1.

![Screen Shot 2022-01-24 at 9 52 40 AM](https://user-images.githubusercontent.com/78064764/150879919-5ebdc9cf-1c8e-4aba-b10c-6b4c2da4df9b.png)

## 3. Download code

Download the code from this repo.

This template uses the node Twilio SDK, but that SDK is not saved so you need to install. Do to /layers/layer-twilo and then run ```npm install``` to pull down everything you need into the node_modules.

Next, open up /template.yaml and do a search for **DEFAULT_AWS_REGION** and update the value for each of those properties to the AWS region you plan to deploy to. 

## 4. Deploy Code

Using AWS SAM makes deploying serverless applications really easy. First run:

```bash
$ sam build 
```

...which go through the yaml file, **template.yaml** and build all of the functions and layers and prepare the stack to be deployed.

Next run:

```bash
$ sam deploy --guided
```

...which will start an interactive command prompt session to set basic configurations and then deploy all of your resources via a stack in CloudFormation. Here are the answers to enter after running that command except substitute your AWS Region of choice!

<img width="925" alt="sam-deploy-guided" src="https://user-images.githubusercontent.com/78064764/150880888-b67f6f0f-8b13-4bfe-a3b5-7cce82e15e21.png">

Once that finishes, go to your AWS Console and then CloudFormation and you can browse through the new stack you just created. All of the Lambdas, Lambda Layers, S3 buckets, Custom EventBus, IAM Roles, and API Gateways are all created automatically. IAAC is awesome!

Also note that the first time you run the deploy command, SAM will create a samconfig.toml file to save your answers for subsequent deployments. After you deploy the first time, you can drop the "--guided" parameter for future deploymenets.

Go to the OUTPUT tab of the deployed stack in CloudFormation. Keep that tab open as you will need those values in later steps (InitiateSurveySMSApi, InitiateSurveyVoiceApi, SrcBucket, TwilioMessagingWebhook).

## 5. Upload config files to S3

This application stores configuration files and results files in a S3 bucket. You could use a different option for persistence with your application (like DynamoDB or RDS).

We are storing three different things:

1. **survey-config.json** => This contains an array of questions to be asked in the survey. 
2. **voice-prompts/** => This S3 folder contains env files for each language you want supported in the the survey. Name file using the and country identifiers and the application will automatically select the correct file.
3. **survey-results/** => This S3 folders hold json files for all survey respondents. The files are named using the respondents' phone numbers as the unique identifier.

The ```sam deploy``` command created the S3 bucket. Now you just need to take a few steps to finalize setup. From AWS Console, go to the S3 bucket (name is then OUTPUT tab in the CloudFormation stack page from step 4), and then do the following:

1. Upload config-files/survey-config.json to bucket root
2. Create folder called voice-prompts
3. Upload the two .env files from config-files/voice-prompts to the voice-prompts folder
4. Create a folder in the S3 bucket called "survey-results/"

Here is what your S3 bucket should look like:

![Screen Shot 2022-01-21 at 2 22 33 PM](https://user-images.githubusercontent.com/78064764/150879991-e94cf391-5d5d-4a69-bd34-358b0d2e453f.png)

## 6. Set webhook url for Messaging

We talked a little already about the nature of voice calls versus messaging conversations. Since voice is synchronous, Twilio Programmable Voice keeps the call alive. For messaging, Twilio will handle incoming messages by forwarding those messages to a webhook. The application needs to maintain state and respond to incoming messages dynamically.

From the OUTPUT tab in the CloudFormation Stack, copy the value for TwilioMessagingWebhook.

From the Twilio Console, go to Phone Numbers > Manage > Active Numbers. Click on the phone number you are using for this project and the scroll down to the Messaging Section. Set the **A MESSAGING COMES IN** handler to WEBHOOK and then paste the URL for TwilioMessagingWebhook as where the webhook will post to when a message comes in.

On a side note, for this project we will just assign outgoing and incoming message configurations to an individual number. For production, you will likely want to utilize [Twilio Messaging Services](https://www.twilio.com/docs/messaging/services).

## 7. Try it out! 

Believe it or not, we should now have a working serverless survey application that works on voice and messaging.

Both the voice and the messaging flows are initiated from post requests. 

We can start with a voice call. Use the InitiateSurveyVoiceApi value from the CloudFormation Output tabs. You will also pass in values for **To** (survey recipient) and **defaultLanguage**. Here is a screenshot from POSTMAN for a voice call:

<img width="1140" alt="Voice-POSTMAN" src="https://user-images.githubusercontent.com/78064764/150879803-cad350f8-dce2-4363-ab66-b8a3e39cbe49.png">

That post request should initiate a voice survey. Once you finish the survey you can go to the survey-results folder in the S3 bucket and review the json file to see the results. Before you try out the SMS flow, delete the json file if you plan to use the same TO phone number.

Here is a screenshot from POSTMAN to initiate an SMS survey:

<img width="1146" alt="SMS-POSTMAN" src="https://user-images.githubusercontent.com/78064764/150879774-9454a19a-032d-4ecb-a260-b9fc13dff6d1.png">

You can delete the json file in the survey-results folder of the S3 buckets to try different paths (different languages, different answers, etc.)

If you want to change the questions, edit the survey-config.json file to add or remove questions. Then change the corresponding language specific questions in the voice-prompts folder. Add a new language by adding a new env file in that folder. Here are the [Twilio Supported Languages](https://support.twilio.com/hc/en-us/articles/223132827-What-Languages-can-the-Say-TwiML-Verb-Speak-).

### Not a production solution!

While you can get this system working pretty quickly, it is NOT production ready. The support user journeys are largely the "happy paths" so additional error and execption handling are needed. In addition, the APIs into AWS are NOT secured. You would need to secure the APIs for a production system. 

## Summary

Use this application template to start building a custom multilingual survey over voice and messaging channels or any other interactive application that needs to leverage Twilio and AWS!

## Cleanup

To avoid any undesired costs, you can easily delete the application that you created, you can use the AWS CLI. Assuming you used your project name for the stack name, you can run the following:

```bash
aws cloudformation delete-stack --stack-name twiml-survey
```

In addition, you can delete the stack from CloudFormation in the AWS console. Select the DELETE STACK option.

## Resources

* [Programmable Voice](https://www.twilio.com/docs/voice)
* [TwiML](https://www.twilio.com/docs/voice/twiml)
* [Messaging](https://www.twilio.com/docs/sms)
* [Twilio Studio](https://www.twilio.com/docs/studio)
* [AWS SAM developer guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html)
