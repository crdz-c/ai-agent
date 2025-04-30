const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require('dotenv').config();
const OpenAI = require("openai");
const { createClient } = require('@supabase/supabase-js');
const { createTask, updateTask, deleteTask, getAllTasks, validateToken } = require('./services/todoist');

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

// Service handlers mapping
const serviceHandlers = {
  todoist: {
    create_task: createTask,
    update_task: updateTask,
    delete_task: deleteTask,
    check_tasks: getAllTasks
  }
};

// Main endpoint
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
    console.log('Making OpenAI API request...');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are the intelligent personal assistant for Lucas Cardozo.

Your job is to clearly interpret the user's intent in natural language and return a response in JSON format, without explanations.

Always respond using this structure:

{
  "intent": "create_task" | "update_task" | "delete_task" | "check_tasks" | etc,
  "target_app": "todoist" | "zapier",
  "parameters": {
    // object with keys relevant to the action, like title, date, recipient, label, etc.
  },
  "confirmation_message": "A short, friendly confirmation message in plain English."
}

Guidelines:
- Be specific with the \`intent\` and use the clearest match based on the input.
- Use \`parameters\` to pass all required values for the action.
- The \`confirmation_message\` must summarize the action and use Markdown formatting where appropriate.
- If something is missing, leave it blank but keep the structure intact.`
        },
        { role: "user", content: input },
      ],
    });

    console.log('OpenAI API response received:', completion);

    const responseText = (completion?.choices?.[0]?.message?.content || "").trim();
    let parsedResponse = null;

    try {
      parsedResponse = JSON.parse(responseText);
    } catch (e) {
      console.error('Error parsing OpenAI response:', e);
      return res.status(400).json({
        status: "error",
        error: "GPT response is not valid JSON.",
        raw: responseText
      });
    }

    const { intent, target_app, parameters } = parsedResponse;

    if (!intent || !target_app || !parameters) {
      return res.status(400).json({
        status: "error",
        error: "Returned JSON is incomplete. Expected: intent, target_app, parameters.",
        raw: parsedResponse
      });
    }

    // Log the interaction in Supabase
    await supabase.from('entries').insert([
      {
        input,
        response: JSON.stringify(parsedResponse)
      }
    ]);

    // Handle the intent with the appropriate service
    const handler = serviceHandlers[target_app]?.[intent];

    if (handler) {
      try {
        const result = await handler(parameters);
        
        // Add Todoist-specific URL to message if available
        const taskUrl = result?.url ? `\n[View task in Todoist](${result.url})` : "";
        const message = `${parsedResponse.confirmation_message}${taskUrl}`;

        return res.status(200).json({
          received: input,
          response: parsedResponse,
          result,
          message
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
    console.error("OpenAI API Error:", error?.response?.data || error.message || error);
    res.status(500).json({
      status: "error",
      error: "Failed to process request.",
      details: error.message,
      raw_error: error
    });
  }
});

// Health check endpoint with detailed status
app.get("/", (req, res) => {
  res.json({
    status: "healthy",
    message: "👋 AI Agent Online!",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    headers: {
      'cf-ray': req.headers['cf-ray'],
      'cf-connecting-ip': req.headers['cf-connecting-ip']
    }
  });
});

// Debug endpoint
app.post("/debug", (req, res) => {
  res.json({
    received: req.body,
    headers: req.headers,
    ip: req.ip
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


// Validate configuration before starting server
async function startServer() {
  try {
    // Validate Todoist token
    console.log('Validating Todoist API token...');
    await validateToken();
    
    // Start the server
    app.listen(PORT, HOST, () => {
      console.log(`Server running on ${HOST}:${PORT}`);
      console.log(`Health check available at http://${HOST}:${PORT}/`);
      console.log('OpenAI Configuration:', {
        baseURL: process.env.OPENAI_BASE_URL,
        apiKeyPrefix: process.env.OPENAI_API_KEY.substring(0, 10) + '...'
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
