
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GEMINI_MODEL_NAME, SYSTEM_PROMPT_TEMPLATE, MAX_CHAT_HISTORY_LENGTH } from '../constants';
import type { GeminiAgentResponse, AgentAction, ChatMessage as ChatMessageType } from '../types';
import { MessageSender } from '../types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let ai: GoogleGenAI | null = null;
if (GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
} else {
    console.warn("Gemini API key not found in process.env.GEMINI_API_KEY. The application may not function correctly. Please ensure it's set in your deployment environment (e.g., Render).");
}

export function isApiKeyAvailable(): boolean {
  return !!GEMINI_API_KEY && !!ai;
}

function formatChatHistory(chatHistory: ChatMessageType[]): string {
  if (!chatHistory || chatHistory.length === 0) {
    return "No previous conversation.";
  }
  return chatHistory
    .slice(-MAX_CHAT_HISTORY_LENGTH) // Get the last N messages
    .map(msg => `${msg.sender === MessageSender.USER ? 'User' : 'Agent'}: ${msg.text}${msg.action ? ` (Action: ${msg.action.description})` : ''}`)
    .join('\n');
}

export async function getAgentResponse(userInput: string, fullChatHistory: ChatMessageType[]): Promise<GeminiAgentResponse> {
  if (!ai) {
    console.error("Gemini API key not configured or AI client not initialized.");
    return {
      agentInitialReply: "Error: The AI service is not configured. Please ensure the Gemini API key is set correctly in your deployment environment.",
      actionDetails: undefined,
    };
  }

  const historyString = formatChatHistory(fullChatHistory);
  const prompt = SYSTEM_PROMPT_TEMPLATE
    .replace("{chatHistory}", historyString)
    .replace("{userInput}", userInput);

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_MODEL_NAME,
        contents: prompt, 
        config: {
          responseMimeType: "application/json",
        },
      });
    
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    try {
      const parsedData = JSON.parse(jsonStr) as GeminiAgentResponse;
      if (typeof parsedData.agentInitialReply !== 'string') {
        console.warn("Gemini response did not contain a valid 'agentInitialReply'. Raw:", jsonStr);
        return { agentInitialReply: "I received an unusual response. Could you try rephrasing?", actionDetails: undefined };
      }
      if (parsedData.actionDetails) {
        const { target_tool, intent, parameters, description, suggested_confirmation_message } = parsedData.actionDetails as Omit<AgentAction, 'isExecuted' | 'executedAt' | 'executionResult'>;
        if (typeof target_tool !== 'string' || typeof intent !== 'string' || typeof parameters !== 'object' || typeof description !== 'string' || (suggested_confirmation_message && typeof suggested_confirmation_message !== 'string')) {
          console.warn("Gemini response 'actionDetails' has invalid structure. Raw:", jsonStr, parsedData.actionDetails);
          return { agentInitialReply: parsedData.agentInitialReply, actionDetails: undefined };
        }
      }
      return parsedData;
    } catch (e) {
      console.error("Failed to parse JSON response from Gemini:", e, "Raw response:", jsonStr);
      return {
        agentInitialReply: `I tried to process that, but received an unexpected format. Here's a snippet: ${jsonStr.substring(0,200)}...`,
        actionDetails: undefined,
      };
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    let errorMessage = "Sorry, I encountered an error while trying to process your request with the AI.";
    if (error instanceof Error) {
        errorMessage += ` Details: ${error.message}`;
    }
    return {
      agentInitialReply: errorMessage,
      actionDetails: undefined,
    };
  }
}
