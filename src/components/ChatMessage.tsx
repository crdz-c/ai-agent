import React from 'react';
import { ChatMessage as ChatMessageType, MessageSender, AgentAction } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
  onExecuteAction: (action: AgentAction, messageId: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onExecuteAction }) => {
  const isUserMessage = message.sender === MessageSender.USER;
  
  return (
    <div className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-3/4 p-3 rounded-lg ${isUserMessage ? 'bg-blue-500 text-white' : 'bg-white'} shadow`}>
        <div className="text-sm font-medium">
          {isUserMessage ? 'You' : 'Assistant'}
        </div>
        <div className="mt-1">
          {message.isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-pulse">Thinking...</div>
            </div>
          ) : (
            <div>{message.text}</div>
          )}
        </div>
        
        {message.action && !message.action.isExecuted && (
          <div className="mt-3 pt-2 border-t">
            <div className="text-xs font-semibold mb-1">Suggested Action:</div>
            <div className="text-sm mb-2">{message.action.description}</div>
            <button 
              onClick={() => onExecuteAction(message.action as AgentAction, message.id)}
              className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
            >
              Execute
            </button>
          </div>
        )}
        
        {message.action && message.action.isExecuted && (
          <div className="mt-3 pt-2 border-t">
            <div className="text-xs font-semibold mb-1">Action Result:</div>
            <div className="text-sm">{message.action.executionResult}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;

