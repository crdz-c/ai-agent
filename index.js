const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
require('dotenv').config();
const OpenAI = require("openai");
const { createClient } = require('@supabase/supabase-js');
const { 
  // Task Management
  createTask, updateTask, deleteTask, completeTask, uncompleteTask,
  // Task Retrieval
  getAllTasks, getTaskById, getFilteredTasks, searchTasks,
  // Project Management
  getAllProjects, getProjectById, createProject, updateProject, deleteProject,
  // Section Management
  getSections, createSection, updateSection, deleteSection,
  // Label Management
  getAllLabels, createLabel, updateLabel, deleteLabel,
  // Comment Management
  getComments, createComment, updateComment, deleteComment,
  // Token Validation
  validateToken
} = require('./services/todoist');
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
// Define service capabilities
const serviceCapabilities = {
  // Todoist capabilities
  todoist: {
    TASK: {
      CREATE: createTask,
      UPDATE: updateTask,
      DELETE: deleteTask,
      COMPLETE: completeTask,
      UNCOMPLETE: uncompleteTask,
      LIST: getAllTasks,
      GET: getTaskById,
      SEARCH: searchTasks
    },
    PROJECT: {
      CREATE: createProject,
      UPDATE: updateProject,
      DELETE: deleteProject,
      LIST: getAllProjects,
      GET: getProjectById
    },
    SECTION: {
      CREATE: createSection,
      UPDATE: updateSection,
      DELETE: deleteSection,
      LIST: getSections
    },
    LABEL: {
      CREATE: createLabel,
      UPDATE: updateLabel,
      DELETE: deleteLabel,
      LIST: getAllLabels
    },
    COMMENT: {
      CREATE: createComment,
      UPDATE: updateComment,
      DELETE: deleteComment,
      LIST: getComments
    }
  },
  
  // Placeholder for future Zapier integration
  zapier: {
    EMAIL: {
      SEND: null, // Will be implemented when Zapier is integrated
      LIST: null,
      SEARCH: null
    },
    CALENDAR_EVENT: {
      CREATE: null,
      UPDATE: null,
      DELETE: null,
      LIST: null
    },
    NOTE: {
      CREATE: null,
      UPDATE: null,
      DELETE: null,
      LIST: null
    }
  }
};

// Legacy handler mapping for backward compatibility
const legacyHandlers = {
  todoist: {
    create_task: createTask,
    update_task: updateTask,
    delete_task: deleteTask,
    complete_task: completeTask,
    uncomplete_task: uncompleteTask,
    check_tasks: getAllTasks,
    get_task: getTaskById,
    filter_tasks: getFilteredTasks,
    search_tasks: searchTasks,
    list_projects: getAllProjects,
    get_project: getProjectById,
    create_project: createProject,
    update_project: updateProject,
    delete_project: deleteProject,
    list_sections: getSections,
    create_section: createSection,
    update_section: updateSection,
    delete_section: deleteSection,
    list_labels: getAllLabels,
    create_label: createLabel,
    update_label: updateLabel,
    delete_label: deleteLabel,
    list_comments: getComments,
    create_comment: createComment,
    update_comment: updateComment,
    delete_comment: deleteComment
  }
};
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
          content: `You are the intelligent personal assistant for Lucas Cardozo. Your primary function is to interpret user requests in natural language (English only) and translate them into a structured JSON format for execution. Respond *only* with the JSON object, without any introductory text or explanations.

Your goal is to identify the user's core 'intent', the 'target_app' they likely want to use, extract relevant 'parameters', and formulate a concise 'confirmation_message'.

**Output JSON Structure:**
{
  "intent": "ENTITY_ACTION", // Standardized intent name, e.g., TASK_CREATE, EMAIL_SEND. See guidelines.
  "target_app": "application_name", // e.g., "todoist", "gmail", "notion", "google_calendar", "openai", "spotify"
  "parameters": { // Dynamically filled based on extracted info. Keys like: "title", "body", "recipient", "due_date", "project_name", "query" },
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
    * Infer the most logical combination based on the user's full request.

2.  **Target Application:** Map applications as follows:
    * Tasks, projects, sections, labels, comments → "todoist"
    * Emails, messages → "zapier" 
    * Calendar events, meetings → "zapier"
    * Notes, documents → "zapier"
    * AI queries, generation → "openai"
    * Music → "spotify"

3.  **Parameter Extraction:** Extract all relevant details (title, description, date/time, people involved, project/label names, search query, etc.) into the 'parameters' object. Normalize dates/times to ISO format "YYYY-MM-DDThh:mm:ss" if possible.
4.  **Confirmation Message:** Generate a short, user-friendly confirmation in English reflecting the action and key parameters (e.g., "OK, task '**Review PR**' created in project 'Work'.", "Showing your tasks for **today**.", "Playing '**Bohemian Rhapsody**' on Spotify.").
5.  **Handling Missing Information:** Extract what's available. If critical info is missing for the *execution* later, the subsequent code should handle that; your job here is primarily interpretation into JSON.
6.  **English Only:** Assume input is English; generate confirmation in English.
7.  **JSON Only:** Your entire response must be *only* the JSON object without any markdown code blocks or additional formatting.`
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
    let handler;
    
    // Check for ENTITY_ACTION format first (new format)
    if (intent.includes('_')) {
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
        
        // Add tool-specific URL to message if available
        let additionalInfo = "";
        
        if (result?.url) {
          // Detect language based on the confirmation message
          const languageDetection = {
            // Words that indicate Portuguese
            pt: ['tarefa', 'criada', 'concluída', 'atualizada', 'excluída', 'encontrada', 'projeto', 'reunião', 'marcada'],
            // Words that indicate Spanish (for future use)
            es: ['tarea', 'creada', 'completada', 'actualizada', 'eliminada', 'encontrada', 'proyecto', 'reunión'],
            // French words (for future use)
            fr: ['tâche', 'créée', 'terminée', 'mise à jour', 'supprimée', 'trouvée', 'projet', 'réunion']
          };
          
          // Default to English
          let language = 'en';
          
          // Check each language for matches
          for (const [lang, words] of Object.entries(languageDetection)) {
            if (words.some(word => parsedResponse.confirmation_message.toLowerCase().includes(word))) {
              language = lang;
              break;
            }
          }
          
          // Set link text based on detected language
          const linkText = {
            en: `View ${entity || 'item'} in ${target_app}`,
            pt: `Ver ${entity === 'TASK' ? 'tarefa' : entity === 'PROJECT' ? 'projeto' : 'item'} no ${target_app}`,
            es: `Ver ${entity === 'TASK' ? 'tarea' : entity === 'PROJECT' ? 'proyecto' : 'elemento'} en ${target_app}`,
            fr: `Voir ${entity === 'TASK' ? 'tâche' : entity === 'PROJECT' ? 'projet' : 'élément'} dans ${target_app}`
          };
          
          additionalInfo = `\n[${linkText[language] || linkText.en}](${result.url})`;
        }
        
        const message = `${parsedResponse.confirmation_message}${additionalInfo}`;
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
    message: "👋 AI Agent Online! (EN/PT-BR)",
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
