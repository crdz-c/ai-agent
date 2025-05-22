
export enum MessageSender {
  USER = 'user',
  AGENT = 'agent',
}

export interface ActionParameters {
  [key: string]: any;
}

export interface AgentAction {
  intent: string; // e.g., "create_task", "read_email"
  target_tool: string; // e.g., "Todoist", "Gmail", "GeneralConversation"
  parameters: ActionParameters; // Parameters for the action
  description: string; // Human-readable summary of the action (from Gemini)
  suggested_confirmation_message?: string; // Humanized confirmation message (from Gemini)
  isExecuted?: boolean;
  executedAt?: number;
  executionResult?: string; // To store success/error message from execution
}

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  action?: AgentAction;
  timestamp: number;
  isLoading?: boolean;
}

export interface GeminiAgentResponse {
  agentInitialReply: string; // Conversational reply from the agent
  actionDetails?: Omit<AgentAction, 'isExecuted' | 'executedAt' | 'executionResult'>; // Details for a potential action
}

export enum ApiKeyStatus {
  UNCHECKED = 'UNCHECKED',
  VALID = 'VALID',
  MISSING = 'MISSING',
}

export enum TodoistApiKeyStatus {
  UNCHECKED = 'UNCHECKED',
  AVAILABLE = 'AVAILABLE',
  MISSING = 'MISSING',
}

export interface TodoistTask {
  id: string;
  content: string;
  description?: string;
  project_id?: string;
  section_id?: string;
  parent_id?: string;
  order?: number;
  labels?: string[];
  priority?: number;
  due?: {
    string: string;
    date: string;
    datetime?: string;
    timezone?: string;
  } | null;
  url: string;
  comment_count: number;
  created_at: string;
  creator_id: string;
  assignee_id?: string | null;
  assigner_id?: string | null;
  is_completed: boolean;
}

export interface CreateTodoistTaskParams {
  content: string;
  description?: string;
  project_id?: string;
  section_id?: string;
  parent_id?: string;
  order?: number;
  labels?: string[];
  priority?: number;
  due_string?: string;
  due_date?: string;
  due_datetime?: string;
  due_lang?: string;
}

export interface UpdateTodoistTaskParams {
  content?: string;
  description?: string;
  labels?: string[];
  priority?: number;
  due_string?: string;
  due_date?: string;
  due_datetime?: string;
}
