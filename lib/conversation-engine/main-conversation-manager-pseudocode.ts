// // Pseudo code Nueva conversation manager, teniendo en cuenta el contexto de los diferentes flow modes

// import { ContainerListParams } from "openai/resources/index";

// // 1. Desde route, se llama el conversation manager con el payload procesado


// export type users = 
// | 'business' 
// | 'customer' 

export type customerIntents = 
| 'idle'
| 'booking'
| 'faq'
| 'account'
| 'escalation'

// export type businessIntents = 
// | 'account_management'
// | 'booking_management'

// export type createBookingStage = 
// | 'awaitingPickup'
// | 'awaitingDropoff'
// | 'awaitingServiceType'
// | 'awaitingConfirmation'



// // Simulacion paso a paso

// // User: Hi 
// // Context before:
// Context =
// {
//     "flowStack": [],
//     "flowStates": {}
// }
// // Bot: Hi, how can I help you today?
// // Context after:
// // Same, no changes


// // User: I want to book a service
// // Intent: booking
// // Bot: Sure, can you provide your pickup address?
// // Context after:
// Context =
// {
//     "flowStack": ["booking"],
//     "flowStates": {
//       "booking": {
//         "mode": "createBooking",
//         "stage": "awaitingPickupAddress",
//         "data": {}
//       }
//     }
//   }
  
// // User: 70 elg rdSimage.png
// // Intent: booking
// // Bot: What is the dropoff address?
// // Context after:
// Context =
// {
//     "flowStack": ["booking"],
//     "flowStates": {
//       "booking": {
//         "mode": "createBooking",
//         "stage": "awaitingDropoffAddress",
//         "data": {
//           "pickup": "70 elgar road"
//         }
//       }
//     }
//   }
  
// // User: 123 aberdeen rd
// // Intent: booking
// // Bot: Perfect, from 70 elgar road to 123 aberdeen rd. What type of service are you looking for?
// // Context after:
// Context =
// {
//     "flowStack": ["booking"],
//     "flowStates": {
//       "booking": {
//         "mode": "createBooking",
//         "stage": "awaitingServiceType",
//         "data": {
//           "pickup": "70 elgar road",
//           "dropoff": "123 aberdeen road"
//         }
//       }
//     }
//   }
  
// // User: "I have like 5 fridges to move, which type of service should I select?"
// // Intent: faq
// // Bot: If you're moving 5 fridges, 'Few Items' is the best option. Want to continue your booking? 
// // (One item, few items, apartment, house) - BUTTONS
// // Context after:
// Context =
// {
//     "flowStack": ["booking", "faq"],
//     "flowStates": {
//       "booking": {
//         "mode": "createBooking",
//         "stage": "awaitingServiceType",
//         "data": {
//           "pickup": "70 elgar road",
//           "dropoff": "123 aberdeen road"
//         }
//       },
//       "faq": {
//         "stage": "answeredServiceQuestion"
//       }
//     }
//   }


// // User selects: "Few Items"
// // Intent: booking (retorno al flow anterior)
// // Bot: Perfect. The quote will be $150. Are you OK with this?
// // Context after:
// Context =
// {
//     "flowStack": ["booking"],
//     "flowStates": {
//       "booking": {
//         "mode": "createBooking",
//         "stage": "awaitingConfirmation",
//         "data": {
//           "pickup": "70 elgar road",
//           "dropoff": "123 aberdeen road",
//           "serviceType": "few items",
//           "quote": 150
//         }
//       }
//     }
//   }
  





// /*
// // ----------------
// // 1. WEBHOOK ENTRY
// // ----------------
// on POST /webhook(messagePayload):

//   userId = extractUserId(messagePayload)
//   userMessage = parseMessage(messagePayload)

//   // Step 1: Intent Detection
//   intent = detectIntent(userMessage)

//   // Step 2: Get context and history from supa storage
//   context = loadConversationContext(userId)
//   history = loadRecentInteractions(userId)

//   // Step 3: Run Conversation Manager
//   response, updatedContext = conversationManager(
//     userMessage, intent, context, history
//   )

//   // Step 4: Save interaction & context in supabase
//   logInteraction(userId, userMessage, response, intent)
//   saveConversationContext(userId, updatedContext)

//   // Step 5: Send response to user
//   sendMessageToUser(userId, response)




// // ------------------------
// // 2. Conversation Manager
// // ------------------------
// function conversationManager(message, intent, context, history):

//     currentFlow = context.flowStack.peek()

//     if intent ≠ currentFlow:
//         context.flowStack.push(intent)
//         currentFlow = intent

//     flowState = context.flowStates[currentFlow]

//     // Step 1: Route to main handler
//     response, newState, flowFinished = routeToHandler(
//         flow = currentFlow,
//         message = message,
//         state = flowState,
//         history = history
//     )

//     // Step 2: Update state
//     context.flowStates[currentFlow] = newState

//     if flowFinished:
//         context.flowStack.pop()

//     return response, context


// // -------------------
// // 3. Route to Handler
// // -------------------
// Function routeToHandler(flow, message, state, history):

//   switch flow:
//     case "booking":
//         return bookingHandler(message, state, history)
//     case "faq":
//         return faqHandler(message, state, history)
//     case "account":
//         return accountHandler(message, state, history)



// function bookingHandler(message, state, history):

//     if state.mode == null:
//         state.mode = detectBookingSubmode(message)

//         switch state.mode:
//             case "createBooking":
//                 return createBookingFlow(message, state, history)
//             case "cancelBooking":
//                 return cancelBookingFlow(message, state, history)
    



// // ---------------------
// // 4. Create Booking Flow
// // ---------------------
// function createBookingFlow(message, state, history):

//   switch state.stage:

//     case null:
//       responseMeta = {
//         flow: "booking",
//         stage: "awaitingPickup",
//         data: {},
//         action: "ask_pickup",
//         contextSummary: "New booking started"
//       }
//       return {
//         response: generateBotResponse(responseMeta, message),
//         newState: {
//           mode: "createBooking",
//           stage: "awaitingPickup",
//           data: {}
//         },
//         flowFinished: false
//       }

//     case "awaitingPickup":
//       if containsAddress(message):
//         pickup = extractAddress(message)
//         responseMeta = {
//           flow: "booking",
//           stage: "awaitingDropoff",
//           data: { pickup },
//           action: "ask_dropoff",
//           contextSummary: "Pickup received"
//         }
//         return {
//           response: generateBotResponse(responseMeta, message),
//           newState: {
//             mode: "createBooking",
//             stage: "awaitingDropoff",
//             data: { pickup }
//           },
//           flowFinished: false
//         }
//       else:
//         responseMeta = {
//           flow: "booking",
//           stage: "awaitingPickup",
//           data: state.data,
//           action: "ask_pickup_again",
//           contextSummary: "Invalid pickup address"
//         }
//         return {
//           response: generateBotResponse(responseMeta, message),
//           newState: state,
//           flowFinished: false
//         }

//     // ...otros stages como awaitingDropoff, awaitingServiceType, awaitingConfirmation...

//     case "awaitingConfirmation":
//       if isPositive(message):
//         responseMeta = {
//           flow: "booking",
//           stage: "completed",
//           data: state.data,
//           action: "confirm_booking",
//           contextSummary: "User accepted quote"
//         }
//         return {
//           response: generateBotResponse(responseMeta, message),
//           newState: {
//             mode: "createBooking",
//             stage: "completed",
//             data: state.data
//           },
//           flowFinished: true
//         }



// // -------------------------
// // 5. Generate Bot Response
// // -------------------------
// function generateBotResponse(meta, userMessage):

//   prompt = buildPrompt(
//     flow = meta.flow,
//     stage = meta.stage,
//     data = meta.data,
//     action = meta.action,
//     contextSummary = meta.contextSummary,
//     userMessage = userMessage
//   )

//   llmResponse = callLLM(prompt)
//   return llmResponse.text
// */