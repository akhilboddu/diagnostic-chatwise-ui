import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CornerDownLeft, Bot, UserCircle2, Copy, RefreshCw, Trash2 } from 'lucide-react';

// Define the props interface
interface ChatInterfaceProps {
  kbId: string;
  backendUrl: string;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  isLoading?: boolean; // Can still be used for the placeholder
  isError?: boolean;
  isHandoff?: boolean; // Keep for now, might be relevant in fetch response
}

// Backend history item structure (for clarity)
interface HistoryItem {
  type: 'human' | 'ai';
  content: string;
}

// Use the props interface in the component definition
const ChatInterface: React.FC<ChatInterfaceProps> = ({ kbId, backendUrl }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Tracks if a message request is in progress
  const [isHistoryLoading, setIsHistoryLoading] = useState(false); // Tracks history loading
  const [historyError, setHistoryError] = useState<string | null>(null); // Tracks history loading error
  const [isClearingHistory, setIsClearingHistory] = useState(false); // State for clearing history
  const [clearHistoryError, setClearHistoryError] = useState<string | null>(null); // Error state for clearing
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null); // Keep for aborting fetch

  // Scroll to bottom whenever messages change
  useEffect(() => {
    // Only scroll if not loading history, prevent jumping on load
    if (!isHistoryLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isHistoryLoading]);

  // Load history and reset chat when kbId changes
  useEffect(() => {
    // Cleanup function: Abort fetch if component unmounts or kbId changes mid-fetch
    const historyAbortController = new AbortController();
    
    const loadHistory = async () => {
      if (!kbId) return; // Don't fetch if no kbId

      console.log(`Loading chat history for kbId: ${kbId}`);
      setIsHistoryLoading(true);
      setHistoryError(null);
      // Clear existing messages immediately but keep input/loading state
      setMessages([]);
      setUserInput('');
      setIsLoading(false);
      // Cancel any ongoing message fetch request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      const cleanBackendUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
      const historyUrl = `${cleanBackendUrl}/agents/${kbId}/history`;

      try {
        const response = await fetch(historyUrl, { 
            signal: historyAbortController.signal,
            method: 'GET'
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, details: ${errorText || 'Failed to fetch history'}`);
        }

        const data: { history: HistoryItem[] } = await response.json();
        console.log("History response:", data);

        const formattedHistory = data.history.map((item, index) => ({
          id: `hist-${kbId}-${index}`,
          sender: item.type === 'human' ? 'user' as const : 'ai' as const,
          text: item.content,
        }));

        // Set history messages, followed by the welcome message
        setMessages([
          ...formattedHistory,
          {
            id: `ai-welcome-${Date.now()}`,
            sender: 'ai',
            text: "Hello! I'm your AI assistant. How can I help you today?",
          }
        ]);

      } catch (error: any) { // Catch any error
        if (error.name === 'AbortError') {
          console.log('History fetch aborted.');
        } else {
          console.error("Failed to load chat history:", error);
          setHistoryError(error.message || "Failed to load chat history.");
          // Add an error message to the chat
          setMessages([
            {
                id: `err-hist-${Date.now()}`,
                sender: 'ai',
                text: `Error loading history: ${error.message || 'Unknown error'}`,
                isError: true,
            }
          ]);
        }
      } finally {
        setIsHistoryLoading(false);
      }
    };

    loadHistory();

    // Cleanup function for the effect
    return () => {
      historyAbortController.abort(); // Abort fetch if kbId changes or component unmounts
    };
  }, [kbId, backendUrl]); // Rerun when kbId or backendUrl changes

  const handleSendMessage = useCallback(() => {
    const trimmedInput = userInput.trim();
    if (!trimmedInput || isLoading) return; // Prevent sending if empty or already loading

    // Cancel any existing fetch request
    if (abortControllerRef.current) {
        console.log("Aborting previous fetch request");
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmedInput,
    };

    const aiPlaceholderMessageId = `ai-loading-${Date.now()}`;

    const aiPlaceholderMessage: Message = {
      id: aiPlaceholderMessageId,
      sender: 'ai',
      text: '...', // Indicate loading
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, aiPlaceholderMessage]);
    setUserInput('');
    setIsLoading(true); // Disable input field

    // Prepare endpoint and body
    const cleanBackendUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    const regularPath = `/agents/${kbId}/chat`; // Endpoint path without query param
    const regularUrl = cleanBackendUrl + regularPath;
    const requestBody = { message: trimmedInput };

    console.log(`Sending POST request to: ${regularUrl}`);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    fetch(regularUrl, {
        method: 'POST', // Changed to POST
        signal: controller.signal,
        headers: { // Added headers
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody) // Added JSON body
    })
    .then(response => {
        if (!response.ok) {
            // Try to get error details from response body
            return response.text().then(text => {
                throw new Error(`HTTP error! status: ${response.status}, details: ${text || 'No details'}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log("Fetch response:", data);
        // Adapt based on your actual API response structure
        const answer = data.answer || data.response || data.content || "No answer provided";
        const isHandoff = data.handoff === true; // Example check for handoff flag

        setMessages(prev => prev.map(msg =>
            msg.id === aiPlaceholderMessageId ? {
                ...msg,
                text: answer,
                isLoading: false,
                isHandoff: isHandoff // Set handoff status if applicable
            } : msg
        ));
    })
    .catch(error => {
        console.error("Fetch error:", error);
        if (error.name !== 'AbortError') {
            setMessages(prev => prev.map(msg =>
                msg.id === aiPlaceholderMessageId ? {
                    ...msg,
                    text: `Error: ${error.message || 'Failed to get response'}`,
                    isLoading: false,
                    isError: true
                } : msg
            ));
        }
    })
    .finally(() => {
        setIsLoading(false);
        abortControllerRef.current = null; // Clear controller when done
    });

  }, [userInput, kbId, backendUrl, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Limit max height
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
    adjustTextareaHeight();
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    // Consider adding a toast notification for feedback
  };

  // Regenerate should work with fetch now
  const handleRegenerateResponse = () => {
      if (isLoading) return;

      // Find the last user message that led to an AI response (or error)
      const lastUserMessageIndex = messages.slice().reverse().findIndex(msg => msg.sender === 'user');
      if (lastUserMessageIndex === -1) return; // No user message found

      const lastUserMessage = messages[messages.length - 1 - lastUserMessageIndex];

      if (lastUserMessage) {
          console.log('Regenerating response for:', lastUserMessage.text);
          // Set input and trigger send immediately
          setUserInput(lastUserMessage.text);
          // Need to trigger send *after* state updates. A small timeout helps.
          setTimeout(() => {
              handleSendMessage();
          }, 0);
      }
  };

  // Function to clear chat history
  const handleClearHistory = useCallback(async () => {
    if (!kbId || isClearingHistory) return;

    console.log(`Clearing chat history for kbId: ${kbId}`);
    setIsClearingHistory(true);
    setClearHistoryError(null);
    const userConfirmed = window.confirm("Are you sure you want to clear the chat history for this agent?");
    
    if (!userConfirmed) {
      setIsClearingHistory(false);
      return;
    }

    const cleanBackendUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    const historyUrl = `${cleanBackendUrl}/agents/${kbId}/history`;

    try {
      const response = await fetch(historyUrl, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, details: ${errorText || 'Failed to clear history'}`);
      }

      console.log("History cleared successfully.");
      // Reset messages to just the welcome message
      setMessages([
        {
          id: `ai-welcome-${Date.now()}`,
          sender: 'ai',
          text: "Hello! I'm your AI assistant. How can I help you today?",
        }
      ]);
      // Clear any history loading errors if successful
      setHistoryError(null); 
      
    } catch (error: any) {
      console.error("Failed to clear chat history:", error);
      setClearHistoryError(error.message || "Failed to clear history.");
      // Optionally show a temporary error message in UI or use a toast
    } finally {
      setIsClearingHistory(false);
    }
  }, [kbId, backendUrl, isClearingHistory]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow">
      {/* Messages Container */}
      {isHistoryLoading && <div className="p-4 text-center text-gray-500">Loading history...</div>}
      {historyError && <div className="p-4 text-center text-red-600">Error loading history: {historyError}</div>}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`flex max-w-[80%] md:max-w-[70%] group ${
                msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 mt-1 ${msg.sender === 'user' ? 'ml-2' : 'mr-2'}`}>
                {msg.sender === 'user' ? (
                  <div className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center">
                    <UserCircle2 className="h-5 w-5" />
                  </div>
                ) : (
                  <div className={`rounded-full w-8 h-8 flex items-center justify-center ${
                      msg.isError ? 'bg-red-100 text-red-600' :
                      msg.isHandoff ? 'bg-yellow-100 text-yellow-600' : // Style for handoff
                      'bg-indigo-100 text-indigo-600'
                    }`}>
                    <Bot className="h-5 w-5" />
                  </div>
                )}
              </div>

              {/* Message Bubble */}
              <div className={`relative`}>
                <div
                  className={`rounded-lg px-4 py-2 ${
                    msg.sender === 'user'
                      ? 'bg-blue-500 text-white rounded-tr-none'
                      : msg.isError
                      ? 'bg-red-100 text-red-800 rounded-tl-none'
                      : msg.isHandoff // Style for handoff
                      ? 'bg-yellow-100 text-yellow-800 rounded-tl-none'
                      : 'bg-gray-100 text-gray-800 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {/* Loading indicator (pulsing dot) */}
                  {msg.isLoading && msg.sender === 'ai' && (
                     <span className="inline-block w-2 h-2 ml-1 bg-indigo-300 rounded-full animate-pulse"></span>
                  )}
                </div>

                {/* Action buttons - Show for AI messages that are not loading */}
                {!msg.isLoading && msg.sender === 'ai' && (
                  <div className={`absolute top-2 right-0 translate-x-full opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1`}>
                    <button
                      onClick={() => handleCopyMessage(msg.text)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    {/* Only show regenerate if it's not an error/handoff */}
                    {!msg.isError && !msg.isHandoff && (
                       <button
                           onClick={handleRegenerateResponse}
                           className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                           title="Regenerate Response"
                           disabled={isLoading}
                       >
                           <RefreshCw className="h-3.5 w-3.5" />
                       </button>
                    )}
                  </div>
                )}
                 {/* Copy button for user messages */}
                 {!msg.isLoading && msg.sender === 'user' && (
                     <div className={`absolute top-2 left-0 -translate-x-full opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1`}>
                         <button
                           onClick={() => handleCopyMessage(msg.text)}
                           className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                           title="Copy"
                         >
                           <Copy className="h-3.5 w-3.5" />
                         </button>
                     </div>
                 )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4">
        <div className={`flex items-end bg-gray-50 rounded-lg border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 ${isLoading ? 'opacity-70' : ''}`}>
          <textarea
            ref={textareaRef}
            value={userInput}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "Waiting for response..." : "Type your message..."}
            disabled={isLoading || isClearingHistory} // Disable textarea while clearing
            className="flex-1 max-h-[150px] m-1 p-2 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !userInput.trim() || isClearingHistory} // Disable send while clearing
            className={`m-1 p-2 rounded-md ${
              isLoading || !userInput.trim() || isClearingHistory
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-blue-500 hover:bg-blue-50'
            }`}
          >
            <CornerDownLeft className="h-5 w-5" />
          </button>
        </div>

        {/* Bottom row with clear button and hint text */} 
        <div className="mt-2 flex justify-between items-center">
          <div className="text-xs text-gray-500">
             Press Enter to send, Shift+Enter for new line
          </div>
          <button
             onClick={handleClearHistory}
             disabled={!kbId || isClearingHistory || isHistoryLoading} // Disable if no kbId or during operations
             className={`px-3 py-1 text-xs font-medium rounded flex items-center transition-colors ${
                 !kbId || isClearingHistory || isHistoryLoading 
                 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                 : 'bg-red-50 text-red-600 hover:bg-red-100'
             }`}
             title="Clear Chat History"
          >
             <Trash2 className="h-3.5 w-3.5 mr-1" />
             {isClearingHistory ? 'Clearing...' : 'Clear History'}
           </button>
         </div>
         {/* Display clear history error */}
         {clearHistoryError && <div className="mt-1 text-xs text-red-600 text-right">Error: {clearHistoryError}</div>}
      </div>
    </div>
  );
};

export default ChatInterface; 