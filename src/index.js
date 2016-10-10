"use strict";

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */

//     if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app.05aecccb3-1461-48fb-a008-822ddrt6b516") {
//         context.fail("Invalid Application ID");
//      }

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId
        + ", sessionId=" + session.sessionId);

    // add any session init logic here
}

/**
 * Called when the user invokes the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId
        + ", sessionId=" + session.sessionId);

    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId
        + ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    // handle yes/no intent after the user has been prompted
    if (session.attributes && session.attributes.userPromptedToContinue) {
        delete session.attributes.userPromptedToContinue;
        if ("AMAZON.NoIntent" === intentName) {
            handleFinishSessionRequest(intent, session, callback);
        } else if ("AMAZON.YesIntent" === intentName) {
            handleRepeatRequest(intent, session, callback);
        }
    }

    // dispatch custom intents to handlers here
    if ("RemindIntent" === intentName) {
        handleRemindRequest(intent, session, callback);
    } else if ("DURIntent" === intentName) {
        handleDURRequest(intent, session, callback);
    } else if ("ReminderListIntent" === intentName) {
	handleReminderListIntent(intent, session, callback)
    } else if ("HowDoYouWorkIntent" === intentName) {
	handleHowDoYouWorkIntent(intent, session, callback)
    } else if ("SayReminderIntent" === intentName) {
	handleSayReminderIntent(intent, session, callback)
    }

    else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId
        + ", sessionId=" + session.sessionId);

    // Add any cleanup logic here
}

// ------- Skill specific business logic -------

var CARD_TITLE = "Reminders"; // Be sure to change this for your skill.

function getWelcomeResponse(callback) {
    var sessionAttributes = {},
        speechOutput = "Welcome to Express Scripts! We are here to help you take your meds more reliably.",
        shouldEndSession = false

    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": "",
	"reminders": []
    };
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, repromptText, shouldEndSession));
}

function handleRemindRequest(intent, session, callback) {

    var speechOutput = "";
    var sessionAttributes = {};
    var userGaveUp = intent.name === "DontKnowIntent";

    let reminder = { drug: intent.slots.Drug.value,
		     time: intent.slots.Time.value }

    let reminders = session.attributes.reminders

    if (reminders === undefined) {
	reminders = [ reminder ]
    } else {
	reminders.push(reminder)
    }

    let drugs = session.attributes.drugs
    if (drugs === undefined) {
	drugs = [ reminder.drug ]
    } else {
	drugs.push(reminder.drug)
    }

    speechOutput = `I will remind you to take ${reminder.drug} at ${reminder.time}.`

    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": "",
	"reminders" : reminders,
	"drugs": drugs
    };

    let directives = {
        "header": {
            "namespace": "Alerts",
            "name": "SetAlert",
        },
        "payload": {
            "type": "{{STRING}}",
            "scheduledTime": "{{STRING}}"
        }
    }
    callback(sessionAttributes,
             buildSpeechletResponse(CARD_TITLE, speechOutput, speechOutput, false));

}

function handleReminderListIntent(intent, session, callback) {
    var speechOutput = "";
    var sessionAttributes = {};
    var userGaveUp = intent.name === "DontKnowIntent";

    let reminders = session.attributes.reminders

    if (reminders === undefined ||
	reminders.length === 0) {
	speechOutput = "You have no reminders set."
    } else {
	console.log(reminders)
	speechOutput = "These are your current reminders. "
	for (let reminder in reminders) {
	    let r = reminders[reminder]
	    speechOutput += `${r.drug}, at ${r.time}. `
	}
    }

    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": "",
	"drugs": session.attributes.drugs,
	"reminders": session.attributes.reminders
    };
    callback(sessionAttributes,
             buildSpeechletResponse(CARD_TITLE, speechOutput, speechOutput, false));

}

const handleDURRequest = (intent, session, callback) => {
    const interactions = {
	"grapefruit" : [ "simvastatin" ],
	"digoxin" : [ "quinidine" ],
	"quinidine" : [ "digoxin"],
	"sildenafil" : [ "nitroglycerine" ],
	"nitroglycerine" : [ "sildenafil" ]
    }

    var speechOutput = "That is safe to take with your other medications."


    let interactionDrugs = interactions[intent.slots.Drug.value]
    for (let drugIdx in interactionDrugs) {
	let drug = interactionDrugs[drugIdx]
	console.log(drug)
	console.log(session.attributes.drugs)
	if (session.attributes && session.attributes.drugs.indexOf(drug) >= 0) {
	    speechOutput = `No, taking ${drug} with ${intent.slots.Drug.value} can cause serious side effects. Talk to your doctor first.`
	}
    }

    callback(session.attributes,
	     buildSpeechletResponse(CARD_TITLE, speechOutput, speechOutput, false))
}

const handleSayReminderIntent = (intent, session, callback) => {
    var speechOutput = `It is time to take your ${intent.slots.Drug.value}`


    let interactionDrugs = interactions[intent.slots.Drug.value]
    for (let drugIdx in interactionDrugs) {
	let drug = interactionDrugs[drugIdx]
	console.log(drug)
	console.log(session.attributes.drugs)
	if (session.attributes && session.attributes.drugs.indexOf(drug) >= 0) {
	    speechOutput = `No, taking ${drug} with ${intent.slots.Drug.value} can cause serious side effects. Talk to your doctor first.`
	}
    }

    callback(session.attributes,
	     buildSpeechletResponse(CARD_TITLE, speechOutput, speechOutput, false))
}


function handleRepeatRequest(intent, session, callback) {
    // Repeat the previous speechOutput and repromptText from the session attributes if available
    // else start a new game session
    if (!session.attributes || !session.attributes.speechOutput) {
        getWelcomeResponse(callback);
    } else {
        callback(session.attributes,
            buildSpeechletResponseWithoutCard(session.attributes.speechOutput, session.attributes.repromptText, false));
    }
}

function handleFinishSessionRequest(intent, session, callback) {
    // End the session with a "Good bye!" if the user wants to quit the game
    callback(session.attributes,
        buildSpeechletResponseWithoutCard("Good bye!", "", true));
}

const handleHowDoYouWorkIntent = (intent, session, callback) => {
    var speechOutput = "I'm sorry, but the Express Scripts lawyers have advised me not to answer."
    var sessionAttributes = {}
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, speechOutput, false));
}

// ------- Helper functions to build responses -------


function buildSpeechletResponse(title, output, repromptText, shouldEndSession, directives) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: title,
            content: output
        },
	directive: directives
        shouldEndSession: shouldEndSession
    };
}

function buildSpeechletResponseWithoutCard(output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
	shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}
