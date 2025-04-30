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
          content: `You are the intelligent personal assistant for Lucas Cardozo. Your primary function is to interpret user requests and translate them into a structured JSON format for execution.

URGENT FORMATTING INSTRUCTION:
YOUR ENTIRE RESPONSE MUST BE ONE SINGLE VALID JSON OBJECT.
DO NOT USE MARKDOWN, ESPECIALLY NOT CODE BLOCKS OR BACKTICKS.
DO NOT START WITH \`\`\`json OR END WITH \`\`\`.
DO NOT INCLUDE ANY TEXT OUTSIDE THE JSON OBJECT.

The JSON object you return WILL be directly passed to JSON.parse() without any preprocessing. ANY formatting errors will cause system failure.

Your goal is to identify the user's core 'intent', the 'target_app' they likely want to use, extract relevant 'parameters', and formulate a concise 'confirmation_message'.

Output JSON Structure (return exactly this format with your values):
{
  "intent": "ENTITY_ACTION",
  "target_app": "application_name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  },
  "confirmation_message": "A brief, friendly confirmation message in English summarizing the action. Use Markdown."
}
**Guidelines:**
1.  **Intent Inference (ENTITY_ACTION Format):** Determine the primary entity (e.g., TASK, PROJECT, EMAIL, NOTE, CALENDAR_EVENT, AI) and the primary action (e.g., CREATE, UPDATE, DELETE, LIST, GET, SEND, COMPLETE, SEARCH, PLAY, GENERATE). Combine them as 'ENTITY_ACTION'.
    * **Examples based on common requests:**
        * Creating things: `TASK_CREATE`, `PROJECT_CREATE`, `NOTE_CREATE`, `CALENDAR_EVENT_CREATE`, `LABEL_CREATE`, `SECTION_CREATE`, `COMMENT_CREATE`
        * Modifying things: `TASK_UPDATE`, `PROJECT_UPDATE`, `NOTE_UPDATE`, `CALENDAR_EVENT_UPDATE`, `LABEL_UPDATE`, `SECTION_UPDATE`, `COMMENT_UPDATE`
        * Removing things: `TASK_DELETE`, `PROJECT_DELETE`, `NOTE_DELETE`, `CALENDAR_EVENT_DELETE`, `LABEL_DELETE`, `SECTION_DELETE`, `COMMENT_DELETE`
        * Viewing lists/multiple items: `TASK_LIST`, `PROJECT_LIST`, `NOTE_LIST`, `CALENDAR_EVENT_LIST`, `LABEL_LIST`, `SECTION_LIST`, `COMMENT_LIST`, `EMAIL_LIST`, `MESSAGE_LIST` (Use parameters for filtering, e.g., list tasks for 'today', list 'overdue' tasks, list events for 'next week').
        * Getting a specific item: `TASK_GET`, `PROJECT_GET`, `NOTE_GET`, `EMAIL_GET` (Less common via voice, but possible).
        * Completing/Status Change: `TASK_COMPLETE`, `TASK_UNCOMPLETE` (or `TASK_REOPEN`)
        * Searching: `TASK_SEARCH`, `NOTE_SEARCH`, `EMAIL_SEARCH`, `MUSIC_SEARCH`
        * Communication: `EMAIL_SEND`, `MESSAGE_SEND` (infer app like 'gmail' or 'slack')
        * AI Interactions: `AI_CHAT` (or `AI_QUERY`), `AI_ANALYZE`, `AI_GENERATE`, `AI_SUMMARIZE`, `AI_TRANSLATE`
        * Music: `MUSIC_PLAY`, `MUSIC_ADD_TO_PLAYLIST`, `MUSIC_GET_INFO`
    * Map to appropriate target apps: tasks → "todoist", email → "zapier", calendar → "zapier", AI → "openai", music → "spotify"
3.  **Parameter Extraction:** Extract all relevant details (title, description, date/time, people involved, project/label names, search query, etc.) into the 'parameters' object. Normalize dates/times to ISO format "YYYY-MM-DDThh:mm:ss" if possible.
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
        let cleaned = text.trim()
          // Remove code blocks if present
          .replace(/^```(?:json)?\s*([\s\S]*?)```$/, '$1').trim()
          // Extract JSON object if surrounded by other content
          .match(/(\{[\s\S]*\})/)?.pop() || text.trim();
        
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
          
          // Normalize ENTITY_ACTION format
          if (parsedResponse.intent.includes('_')) {
            const [entity, action] = parsedResponse.intent.split('_');
            if (entity && action) {
              parsedResponse.intent = `${entity.toUpperCase()}_${action.toUpperCase()}`;
            }
          }
        } else {
          parsedResponse.intent = "UNKNOWN_ACTION";
        }
      } catch (jsonError) {
        console.error('JSON parsing failed after cleaning:', jsonError);
        throw new Error(`JSON parsing failed: ${jsonError.message}`);
      }
      
      // Validate required fields
      if (!parsedResponse.intent || !parsedResponse.target_app || !parsedResponse.parameters) {
        throw new Error('Missing required fields in response: needs intent, target_app, and parameters');
      }
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      
      return res.status(400).json({
        status: "error",
        error: "GPT response is not valid JSON or is missing required fields.",
        error_details: parseError.message
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
        let additionalInfo = result?.url ? 
          `\n[View ${intent.includes('_') ? intent.split('_')[0] : 'item'} in ${target_app}](${result.url})` : 
          "";
        
        return res.status(200).json({
          received: input,
          response: parsedResponse,
          result,
          message: `${parsedResponse.confirmation_message}${additionalInfo}`
        });
      } catch (e) {
        console.error('Error executing handler:', e);
        return res.status(500).json({
          status: "error",
          error: "Error executing intent handler.",
          details: e.message
        });
      }
    }

    // If no handler found but parsing successful, return the parsed response
    res.status(200).json({
      received: input,
      response: parsedResponse,
      message: "Intent parsed successfully but no handler available."
    });

  } catch (error) {
    console.error("API Error:", error?.response?.data || error.message || error);
    res.status(500).json({
      status: "error",
      error: "Failed to process request.",
      details: error.message
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
