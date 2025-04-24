const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require('dotenv').config();
const OpenAI = require("openai").default;
const { createClient } = require('@supabase/supabase-js');
const { createTask, updateTask, deleteTask, getAllTasks } = require('./services/todoist');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Define intentRouter with handlers
const intentRouter = {
  create_task: {
    todoist: async (parameters) => {
      return await createTask({
        title: parameters.title,
        dueDate: parameters.due_date
      });
    }
  },
  // other intents and target_apps can be added here
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
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are the intelligent personal assistant for Lucas Cardozo.

Your job is to clearly interpret the user's intent in natural language and return a response in JSON format, without explanations.

Always respond using this structure:

{
  "intent": "create_task" | "check_email" | "create_note" | etc,
  "target_app": "todoist" | "gmail" | "calendar" | "notion" | "slack" | "spotify" | "lastfm" | "openai",
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

    const responseText = (completion?.choices?.[0]?.message?.content || "").trim();
    let parsedResponse = null;

    try {
      parsedResponse = JSON.parse(responseText);
    } catch (e) {
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

    await supabase.from('entries').insert([
      {
        input,
        response: JSON.stringify(parsedResponse)
      }
    ]);

    const handler = intentRouter[intent]?.[target_app];

    if (typeof handler === "function") {
      try {
        const result = await handler(parameters);

        const formattedMessage = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are Lucas's personal assistant. Your task is to transform an API response into a clear, useful, and friendly message in English. Use a direct, informal, and human tone. If there are links, highlight with [see more](link). Use Markdown moderately and emojis only when appropriate. Summarize important information without repeating technical fields.`
            },
            {
              role: "user",
              content: `This was the API response:\n${JSON.stringify(result)}`
            }
          ],
          temperature: 0.7
        });

        const pretty = formattedMessage.choices[0]?.message?.content || "";

        return res.status(200).json({
          received: input,
          response: parsedResponse,
          result,
          message: pretty
        });
      } catch (e) {
        return res.status(500).json({
          status: "error",
          error: "Error executing intent handler.",
          details: e.message
        });
      }
    }

    res.status(200).json({
      received: input,
      response: parsedResponse
    });

  } catch (error) {
    console.error("GPT error:", error?.response?.data || error.message || error);
    res.status(500).json({
      status: "error",
      error: "Failed to process GPT response."
    });
  }
});

// GET test
app.get("/", (req, res) => {
  res.send("👋 AI Agent Online!");
});

// Quick diagnostic endpoint
app.post("/debug", (req, res) => {
  res.json({
    received: req.body
  });
});


// Endpoint to list all Todoist tasks
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
