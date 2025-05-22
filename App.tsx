import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessage as ChatMessageType, MessageSender, AgentAction, ApiKeyStatus, TodoistApiKeyStatus, CreateTodoistTaskParams, UpdateTodoistTaskParams, ActionParameters } from './types'; // Renamed to avoid conflict
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import { getAgentResponse, isApiKeyAvailable as isGeminiApiKeyAvailable } from './services/geminiService';
import * as todoistService from './services/todoistService';
import { DEFAULT_AGENT_GREETING, MAX_CHAT_HISTORY_LENGTH } from './constants';
import { ExclamationTriangleIcon, AgentIcon } from './components/Icons';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [geminiApiKeyStatus, setGeminiApiKeyStatus] = useState<ApiKeyStatus>(ApiKeyStatus.UNCHECKED);
  const [todoistApiKeyStatus, setTodoistApiKeyStatus] = useState<TodoistApiKeyStatus>(TodoistApiKeyStatus.UNCHECKED);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isGeminiApiKeyAvailable()) {
      setGeminiApiKeyStatus(ApiKeyStatus.VALID);
      setMessages([
        {
          id: crypto.randomUUID(),
          sender: MessageSender.AGENT,
          text: DEFAULT_AGENT_GREETING,
          timestamp: Date.now(),
        },
      ]);
    } else {
      setGeminiApiKeyStatus(ApiKeyStatus.MISSING);
       setMessages([
        {
          id: crypto.randomUUID(),
          sender: MessageSender.AGENT,
          text: "Welcome! Please ensure the Gemini API Key is configured in your deployment environment to enable AI features.",
          timestamp: Date.now(),
        },
      ]);
    }

    if (todoistService.isTodoistApiKeyAvailable()) {
      setTodoistApiKeyStatus(TodoistApiKeyStatus.AVAILABLE);
    } else {
      setTodoistApiKeyStatus(TodoistApiKeyStatus.MISSING);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = useCallback(async (userInput: string) => {
    if (!userInput.trim() || geminiApiKeyStatus !== ApiKeyStatus.VALID) return;

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      sender: MessageSender.USER,
      text: userInput,
      timestamp: Date.now(),
    };
    
    const updatedMessagesWithUser = [...messages, userMessage];
    setMessages(updatedMessagesWithUser);
    setIsLoading(true);

    const agentTypingMessageId = crypto.randomUUID();
    const agentTypingMessage: ChatMessageType = {
        id: agentTypingMessageId,
        sender: MessageSender.AGENT,
        text: "Thinking...",
        timestamp: Date.now(),
        isLoading: true,
    };
    setMessages(prev => [...prev, agentTypingMessage]);

    try {
      const agentResponse = await getAgentResponse(userInput, updatedMessagesWithUser);
      
      const finalAgentMessage: ChatMessageType = {
        id: agentTypingMessageId, 
        sender: MessageSender.AGENT,
        text: agentResponse.agentInitialReply,
        timestamp: Date.now(),
        action: agentResponse.actionDetails ? { ...agentResponse.actionDetails, isExecuted: false, executionResult: undefined } : undefined,
        isLoading: false,
      };
      
      setMessages(prev => prev.map(msg => msg.id === agentTypingMessageId ? finalAgentMessage : msg));

    } catch (error) {
      console.error("Error getting agent response:", error);
      const errorMessage: ChatMessageType = {
        id: agentTypingMessageId, 
        sender: MessageSender.AGENT,
        text: "Sorry, I encountered an error processing your request with the AI. Please try again.",
        timestamp: Date.now(),
        isLoading: false,
      };
      setMessages(prev => prev.map(msg => msg.id === agentTypingMessageId ? errorMessage : msg));
    } finally {
      setIsLoading(false);
    }
  }, [geminiApiKeyStatus, messages]);

  const handleExecuteAction = useCallback(async (actionToExecute: AgentAction, messageId: string) => {
    if (actionToExecute.target_tool === 'Todoist' && todoistApiKeyStatus !== TodoistApiKeyStatus.AVAILABLE) {
      const errorText = "Error: Todoist API Key is not configured in the deployment environment.";
      setMessages(prevMessages =>
        prevMessages.map(msg => 
          msg.id === messageId && msg.action ? { ...msg, action: { ...msg.action, isExecuted: true, executedAt: Date.now(), executionResult: errorText } } : msg
        )
      );
      const errorConfirmation: ChatMessageType = {
        id: crypto.randomUUID(),
        sender: MessageSender.AGENT,
        text: `Cannot execute Todoist action: The Todoist API Key is not configured. Please set it in your deployment environment.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorConfirmation]);
      return;
    }

    let executionResultText = `Action '${actionToExecute.description}' would be logged (simulated for non-Todoist).`;
    let success = false; 
    let finalConfirmationMessage = actionToExecute.suggested_confirmation_message;

    setMessages(prevMessages =>
      prevMessages.map(msg => {
        if (msg.id === messageId && msg.action) {
          return {
            ...msg,
            action: {
              ...msg.action,
              isExecuted: true, 
              executedAt: Date.now(),
              executionResult: "Executing...", 
            },
          };
        }
        return msg;
      })
    );

    try {
      if (actionToExecute.target_tool === 'Todoist') {
        const params: ActionParameters = actionToExecute.parameters;
        switch (actionToExecute.intent) {
          case 'create_task':
            const taskParams: CreateTodoistTaskParams = {
              content: params.content as string,
              due_string: params.dueDate as string | undefined,
              description: params.description as string | undefined,
              priority: params.priority as number | undefined,
            };
            if (!taskParams.content) throw new Error("Task content is missing.");
            const createdTask = await todoistService.createTask(taskParams);
            executionResultText = `Successfully created Todoist task: "${createdTask.content}".`;
            finalConfirmationMessage = actionToExecute.suggested_confirmation_message || executionResultText;
            success = true;
            break;
          case 'update_task':
            const taskIdToUpdate = params.taskId || params.id || params.taskName || params.content; 
            if (!taskIdToUpdate) throw new Error("Task identifier (ID or name/content) required for update.");
            const updateParams: UpdateTodoistTaskParams = {
              content: params.newTitle || params.newContent, 
              due_string: params.dueDate,
              description: params.description,
              priority: params.priority,
              labels: params.labels as string[] | undefined,
            };
            Object.keys(updateParams).forEach(key => updateParams[key as keyof UpdateTodoistTaskParams] === undefined && delete updateParams[key as keyof UpdateTodoistTaskParams]);
            if (Object.keys(updateParams).length === 0) throw new Error("No updates provided for the task.");

            const updatedTask = await todoistService.updateTask(taskIdToUpdate as string, updateParams);
            executionResultText = `Successfully updated Todoist task: "${updatedTask.content || taskIdToUpdate}".`;
            finalConfirmationMessage = actionToExecute.suggested_confirmation_message || executionResultText;
            success = true;
            break;
          case 'delete_task':
            const taskIdToDelete = params.taskId || params.id || params.taskName || params.content;
            if (!taskIdToDelete) throw new Error("Task identifier (ID or name/content) required for deletion.");
            await todoistService.deleteTask(taskIdToDelete as string);
            executionResultText = `Successfully deleted Todoist task: "${taskIdToDelete}".`;
            finalConfirmationMessage = actionToExecute.suggested_confirmation_message || executionResultText;
            success = true;
            break;
          case 'complete_task':
            const taskIdToComplete = params.taskId || params.id || params.taskName || params.content;
            if (!taskIdToComplete) throw new Error("Task identifier (ID or name/content) required for completion.");
            await todoistService.completeTask(taskIdToComplete as string);
            executionResultText = `Successfully completed Todoist task: "${taskIdToComplete}".`;
            finalConfirmationMessage = actionToExecute.suggested_confirmation_message || executionResultText;
            success = true;
            break;
          default:
            executionResultText = `Intent '${actionToExecute.intent}' for Todoist is recognized but not yet implemented for execution.`;
            finalConfirmationMessage = executionResultText;
            success = false; 
        }
      } else if (actionToExecute.target_tool === 'GeneralConversation' || actionToExecute.target_tool === 'UnsupportedTool') {
         executionResultText = `This is a conversational turn, no specific execution needed.`;
         finalConfirmationMessage = actionToExecute.suggested_confirmation_message || actionToExecute.description;
         success = true; 
      }
       else {
        executionResultText = `Action for tool '${actionToExecute.target_tool}' (intent: '${actionToExecute.intent}') is not yet executable. Description: ${actionToExecute.description}`;
        finalConfirmationMessage = executionResultText;
        success = false; 
        console.log(`Simulating execution for ${actionToExecute.target_tool}, intent: ${actionToExecute.intent}`, actionToExecute);
      }
    } catch (error: any) {
      console.error(`Error executing action ${actionToExecute.target_tool}.${actionToExecute.intent}:`, error);
      executionResultText = `Failed to execute '${actionToExecute.description}': ${error.message}`;
      finalConfirmationMessage = executionResultText; 
      success = false;
    }

    setMessages(prevMessages =>
      prevMessages.map(msg => {
        if (msg.id === messageId && msg.action) {
          return {
            ...msg,
            action: {
              ...msg.action,
              isExecuted: true,
              executedAt: Date.now(),
              executionResult: executionResultText, 
            },
          };
        }
        return msg;
      })
    );
    
    const agentConfirmationMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      sender: MessageSender.AGENT,
      text: finalConfirmationMessage, 
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, agentConfirmationMessage]);

  }, [todoistApiKeyStatus]);


  return (
    <div className="flex flex-col h-screen max-h-screen bg-gray-100 antialiased">
      <header className="bg-indigo-600 text-white p-4 shadow-md flex items-center space-x-2">
        <AgentIcon className="w-8 h-8"/>
        <h1 className="text-xl font-semibold">Personal Agent</h1>
      </header>

      {geminiApiKeyStatus === ApiKeyStatus.MISSING && (
         <div className="p-4 m-4 bg-red-100 border border-red-400 text-red-700 rounded-md flex items-center">
            <ExclamationTriangleIcon className="w-6 h-6 mr-3 text-red-500" />
            <div>
                <h3 className="font-bold">Gemini API Key Missing!</h3>
                <p className="text-sm">The Gemini API key (<code>GEMINI_API_KEY</code>) is not configured. This application requires it to function.</p>
                <p className="text-sm mt-1">Please ensure it's set as an environment variable in your deployment platform (e.g., Render).</p>
            </div>
        </div>
      )}
      {todoistApiKeyStatus === TodoistApiKeyStatus.MISSING && geminiApiKeyStatus === ApiKeyStatus.VALID && (
         <div className="p-4 m-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md flex items-center">
            <ExclamationTriangleIcon className="w-6 h-6 mr-3 text-yellow-500" />
            <div>
                <h3 className="font-bold">Todoist API Key Missing!</h3>
                <p className="text-sm">The Todoist API key (<code>TODOIST_API_KEY</code>) is not configured. Todoist actions will not be available.</p>
                <p className="text-sm mt-1">Please ensure it's set as an environment variable in your deployment platform (e.g., Render) if you intend to use Todoist features.</p>
            </div>
        </div>
      )}

      <main className="flex-grow p-4 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} onExecuteAction={(action, id) => handleExecuteAction(action as AgentAction, id)} />
        ))}
        <div ref={messagesEndRef} />
      </main>

      <ChatInput 
        onSendMessage={handleSendMessage} 
        isLoading={isLoading} 
        disabled={geminiApiKeyStatus !== ApiKeyStatus.VALID}
      />
    </div>
  );
};

export default App;