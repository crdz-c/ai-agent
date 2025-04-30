const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require('dotenv').config();
const OpenAI = require("openai");
const { createClient } = require('@supabase/supabase-js');
const { serviceCapabilities, legacyHandlers } = require('./intentRouter');
const { validateToken, getAllTasks } = require('./services/todoist');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Enable trust proxy for Cloudflare
app.set('trust proxy', true);

app.use(cors({
  origin: ['https://agent.cardozo.cc', 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Initialize OpenAI with project API configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  defaultQuery: { 'api-version': '2024-02-15' },
  defaultHeaders: { 'api-key': process.env.OPENAI_API_KEY }
});

app.post("/agent", async (req, res) => {
  const input = req.body.input;
  const token = req.headers['authorization'];
  
  if (!token || token !== `Bearer ${process.env.AGENT_SECRET}`) {
    return res.status(403).json({ error: "Unauthorized access" });
  }
  
  if (!input || typeof input !== 'string') {
    return res.status(400).json({
      status: "error",
      error: "Malformed request: the 'input' field must be a valid string."
    });
  }

  try {
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are the intelligent personal assistant for Lucas Cardozo. Your primary function is to interpret user requests into a structured JSON format that our backend service API can execute.

CRITICAL FORMATTING REQUIREMENT:
YOUR ENTIRE RESPONSE MUST BE A SINGLE VALID JSON OBJECT.
DO NOT USE MARKDOWN FORMATTING LIKE CODE BLOCKS OR BACKTICKS.
DO NOT INCLUDE ANY TEXT OUTSIDE THE JSON OBJECT.
THE OUTPUT WILL BE DIRECTLY PARSED WITH JSON.parse() WITHOUT ANY PREPROCESSING.

Your goal is to map user intent to our service API capabilities by identifying:
1. The core 'intent' using ENTITY_ACTION format
2. The appropriate 'target_app' for execution
3. All relevant 'parameters' needed for the operation
4. A clear 'confirmation_message' for user feedback

Output JSON Structure:
{
  "intent": "ENTITY_ACTION",
  "target_app": "application_name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  },
  "confirmation_message": "A brief confirmation message in English summarizing the action. You may use Markdown formatting in this field only."
}

TECHNICAL IMPLEMENTATION GUIDELINES:

1. SERVICE CAPABILITIES MAP:
   Our backend supports the following capabilities. Match user requests to these exact patterns:
   
   A. TODOIST SERVICE (target_app: "todoist")
      * Tasks: TASK_CREATE, TASK_UPDATE, TASK_DELETE, TASK_COMPLETE, TASK_UNCOMPLETE, TASK_LIST, TASK_GET, TASK_SEARCH
      * Projects: PROJECT_CREATE, PROJECT_UPDATE, PROJECT_DELETE, PROJECT_LIST, PROJECT_GET
      * Sections: SECTION_CREATE, SECTION_UPDATE, SECTION_DELETE, SECTION_LIST
      * Labels: LABEL_CREATE, LABEL_UPDATE, LABEL_DELETE, LABEL_LIST
      * Comments: COMMENT_CREATE, COMMENT_UPDATE, COMMENT_DELETE, COMMENT_LIST
   
   B. ZAPIER SERVICE (target_app: "zapier")
      * Email: EMAIL_SEND, EMAIL_LIST, EMAIL_SEARCH, EMAIL_GET, EMAIL_REPLY
      * Calendar: CALENDAR_EVENT_CREATE, CALENDAR_EVENT_UPDATE, CALENDAR_EVENT_DELETE, CALENDAR_EVENT_LIST, CALENDAR_EVENT_SEARCH, CALENDAR_EVENT_GET
      * Notes: NOTE_CREATE, NOTE_UPDATE, NOTE_DELETE, NOTE_LIST, NOTE_SEARCH, NOTE_GET
   
   C. OPENAI SERVICE (target_app: "openai")
      * AI functions: AI_CHAT, AI_QUERY, AI_ANALYZE, AI_GENERATE, AI_SUMMARIZE, AI_TRANSLATE
   
   D. SPOTIFY SERVICE (target_app: "spotify")
      * Music functions: MUSIC_PLAY, MUSIC_ADD_TO_PLAYLIST, MUSIC_SEARCH, MUSIC_GET_INFO

2. PARAMETER EXTRACTION REQUIREMENTS:
4.  **Confirmation Message:** Generate a short, user-friendly confirmation in English reflecting the action and key parameters (e.g., "OK, task '**Review PR**' created in project 'Work'.", "Showing your tasks for **today**.", "Playing '**Bohemian Rhapsody**' on Spotify.").
5.  **Handling Missing Information:** Extract what's available. If critical info is missing for the *execution* later, the subsequent code should handle that; your job here is primarily interpretation into JSON.
6.  **English Only:** Assume input is English; generate confirmation in English.
7.  **CRITICAL - PURE JSON ONLY:** Your response MUST be the raw JSON object itself. Do not wrap it in code blocks. Do not use backticks. Do not use ```json tags. The response will be directly parsed as JSON, so any non-JSON content will cause errors.

IMPORTANT: Examples of WRONG responses:
```json
{
  "intent": "TASK_CREATE",
  ...
}
```

Or:
{
  "intent": "TASK_CREATE",
  ...
}

Example of CORRECT response format (the only acceptable format):
{"intent":"TASK_CREATE","target_app":"todoist","parameters":{"title":"Example Task","dueDate":"2023-04-30T15:00:00","priority":3},"confirmation_message":"Task *Example Task* created for April 30th with **high priority**."}

ANY deviation from pure JSON output will cause the integration to FAIL.`
        }
      ]
    });
    
    let parsedResponse;
    
    try {
      // Extract the content from the completion
      let responseText = completion.choices[0].message.content;
      
      // Clean and parse the JSON response
      function parseJsonResponse(text) {
        // Clean and extract valid JSON from response
        let cleaned = text.trim();
        
        // Remove code blocks if present
        const codeBlockMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*?)```$/);
        if (codeBlockMatch) {
          cleaned = codeBlockMatch[1].trim();
        }
        
        // Extract JSON object if surrounded by other content
        const jsonObjectMatch = cleaned.match(/(\{[\s\S]*\})/);
        if (jsonObjectMatch) {
          cleaned = jsonObjectMatch[1].trim();
        }
        
        // Validate JSON structure
        if (!cleaned.startsWith('{') || !cleaned.endsWith('}')) {
          throw new Error('Response is not a valid JSON object');
        }
        
        return JSON.parse(cleaned);
      }
      
      // Parse the response
      parsedResponse = parseJsonResponse(responseText);
      
      // Intent field validation and normalization
      if (parsedResponse.intent !== undefined) {
        // Ensure intent is a string
        if (typeof parsedResponse.intent !== 'string') {
          parsedResponse.intent = String(parsedResponse.intent);
        }
        
        // Normalize ENTITY_ACTION format to ensure consistent casing
        if (parsedResponse.intent.includes('_')) {
          const [entity, action] = parsedResponse.intent.split('_');
          if (entity && action) {
            parsedResponse.intent = `${entity.toUpperCase()}_${action.toUpperCase()}`;
          }
        } else {
          // Handle legacy format if needed
          console.log('Warning: Intent does not follow ENTITY_ACTION format:', parsedResponse.intent);
        }
      } else {
        console.log('Warning: Missing intent in GPT response, using UNKNOWN_ACTION');
        parsedResponse.intent = "UNKNOWN_ACTION";
      }
      
      // Validate required fields
      if (!parsedResponse.target_app || !parsedResponse.parameters) {
        throw new Error('Missing required fields in response: needs target_app and parameters');
      }
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      return res.status(400).json({
        status: "error",
        error: "Failed to parse GPT response",
        details: parseError.message
      });
    }

    const { intent, target_app, parameters } = parsedResponse;
    let handler;
    
    // Find appropriate handler based on intent format
    if (intent.includes('_')) {
      // Try ENTITY_ACTION format first (new format)
      const [entity, action] = intent.split('_');
      handler = serviceCapabilities[target_app]?.[entity]?.[action];
    }
    
    // Fall back to legacy format if no handler found
    if (!handler) {
      handler = legacyHandlers[target_app]?.[intent];
    }

    if (handler) {
      try {
        const result = await handler(parameters);
        
        // Create response with link if available
        let additionalInfo = "";
        if (result?.url) {
          const entityType = intent.includes('_') ? intent.split('_')[0].toLowerCase() : 'item';
          additionalInfo = `\n[View ${entityType} in ${target_app}](${result.url})`;
        }
        
        return res.status(200).json({
          received: input,
          response: parsedResponse,
          result,
          message: `${parsedResponse.confirmation_message || 'Request processed successfully.'}${additionalInfo}`
        });
      } catch (e) {
        console.error('Error executing handler:', e);
        return res.status(500).json({
          status: "error",
          error: "Error executing intent handler.",
          details: e.message,
          intent: intent,
          target_app: target_app
        });
      }
    }

    // If no handler found but parsing successful, return the parsed response
    res.status(200).json({
      received: input,
      response: parsedResponse,
      message: `Intent '${intent}' for ${target_app} was recognized but no handler is available.`
    });

  } catch (error) {
    console.error("API Error:", error?.response?.data || error.message || error);
    res.status(500).json({
      status: "error",
      error: "Failed to process request.",
      details: error.message,
      request_id: req.headers['x-request-id'] || 'unknown'
    });
  }
});

// Health check endpoint with detailed status
app.get("/", (req, res) => {
  res.json({
    status: "healthy",
    message: "👋 AI Agent Online! (EN/PT-BR)",
    timestamp: new Date().toISOString(),
    version: "1.1.0",
    headers: {
      'cf-ray': req.headers['cf-ray'],
      'cf-connecting-ip': req.headers['cf-connecting-ip']
    }
  });
});

// Tasks list endpoint
app.get("/tasks", async (req, res) => {
  const token = req.headers['authorization'];
  if (!token || token !== `Bearer ${process.env.AGENT_SECRET}`) {
    return res.status(403).json({ error: "Unauthorized access" });
  }
  try {
    const tasks = await getAllTasks();
    res.json({ tasks });
  } catch (e) {
    res.status(500).json({
      status: "error",
      error: "Error fetching tasks from Todoist.",
      details: e.message
    });
  }
});

// Validate configuration and start server
async function startServer() {
  try {
    // Validate Todoist token
    console.log('Validating Todoist API token...');
    await validateToken();
    
    // Start the server
    app.listen(PORT, HOST, () => {
      console.log(`AI Agent server running on ${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
