/* 

    Parses body of POST request and returns JS object

*/


// Parses POST body into an Object
exports.parsePostBody = async (body) => {
  
  // Pull out params passed in POST body 
  return bodyParams = JSON.parse('{"' + body.replace(/&/g, '","').replace(/=/g,'":"') + '"}', function(key, value) { return key===""?value:decodeURIComponent(value) });

}

/* 

    Adapted from: dotenv => https://github.com/motdotla/dotenv

*/


function log (message /*: string */) {
  console.log(`[dotenv][DEBUG] ${message}`)
}

const NEWLINE = '\n'
const RE_INI_KEY_VAL = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/
const RE_NEWLINES = /\\n/g
const NEWLINES_MATCH = /\r\n|\n|\r/

// Parses src into an Object
exports.parseEnvFile = async (src) => {
  
  const obj = {}

  // convert Buffers before splitting into lines and processing
  src.toString().split(NEWLINES_MATCH).forEach(function (line, idx) {
    // matching "KEY' and 'VAL' in 'KEY=VAL'
    const keyValueArr = line.match(RE_INI_KEY_VAL)
    // matched?
    if (keyValueArr != null) {
      const key = keyValueArr[1]
      // default undefined or missing values to empty string
      let val = (keyValueArr[2] || '')
      const end = val.length - 1
      const isDoubleQuoted = val[0] === '"' && val[end] === '"'
      const isSingleQuoted = val[0] === "'" && val[end] === "'"

      // if single or double quoted, remove quotes
      if (isSingleQuoted || isDoubleQuoted) {
        val = val.substring(1, end)

        // if double quoted, expand newlines
        if (isDoubleQuoted) {
          val = val.replace(RE_NEWLINES, NEWLINE)
        }
      } else {
        // remove surrounding whitespace
        val = val.trim()
      }

      obj[key] = val
    }
  });

  return obj
}


// Returns TwiML response object
exports.formatTwimlResponse = function(statusCode,twimlString) {

  let response = {
    'statusCode': statusCode,
    headers: {
        'Content-Type': 'application/xml'
        //'Access-Control-Allow-Origin': '*'
    },
    body: twimlString
  }

  return response;
  
};

// Returns JSON Object to Put to EventBridge
exports.formatEventBridgeObject = function(userObject,postBody,messageBody) {

  // PUT TO EVENTBRIDGE
  let eventParams = {
    "Entries": [ 
    {
      // Event envelope fields
      Source: process.env.EVENT_SOURCE_NAME,
      EventBusName: process.env.EVENTBUS_NAME,
      DetailType: process.env.EVENT_DETAIL_TYPE,
      Time: new Date(),

      // Main event body
      Detail: JSON.stringify({
        currentState: userObject.currentState,
        messageBody: messageBody,
        resultsObject: userObject,            
        postBody: postBody                    
      })
    }
    ]    
  };


  return eventParams;
  
};

// Returns JSON Object to Put to EventBridge
exports.returnInitialResultsFile = function(surveyTo,medium,defaultLanguage) {
    
  // CREATE RESULTS FILE
    let resultsObject = {
      surveyTo:surveyTo,
      questions:[],
      surveyMedium: medium,
      surveyStarted: Date.now(),            
      surveyStatus: 'STARTED',
      currentState: 'welcome',
      questionIndex: 0,            
      languageSet: defaultLanguage
  };

  return resultsObject;

}
