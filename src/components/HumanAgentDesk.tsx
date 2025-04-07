import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Inbox, CheckCircle, User, Bot, UserCheck, CornerDownLeft, PlusSquare, BookPlus } from 'lucide-react';
import AddKbDrawer from './AddKbDrawer';

// Updated Conversation interface to match the API response structure
interface ConversationDetails {
  last_message_preview: string;
  last_message_timestamp: string; // Assuming ISO string format
  message_count: number;
  needs_human_attention: boolean;
}

interface Conversation {
  kb_id: string;
  name: string | null; // Renamed from kb_name to match API
  conversation: ConversationDetails; // Nested conversation details
}

// Updated Message interface to align with API structure, but we'll map it for internal use
interface ApiMessage {
  type: 'human' | 'ai' | 'human_agent';
  content: string;
  timestamp: string; 
}

// Internal Message interface used by the component's rendering logic
interface Message {
  sender: 'user' | 'ai' | 'human_agent';
  text: string; // We'll map 'content' to 'text'
  timestamp: string; // Assuming ISO string format
}

interface HumanAgentDeskProps {
  backendUrl: string;
}

const HumanAgentDesk: React.FC<HumanAgentDeskProps> = ({ backendUrl }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const [responseText, setResponseText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- State for KB Drawer --- 
  const [isKbDrawerOpen, setIsKbDrawerOpen] = useState<boolean>(false);
  const [selectedMessageText, setSelectedMessageText] = useState<string | null>(null);
  // --- End KB Drawer State ---

  const fetchConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    setError(null);
    try {
      const response = await fetch(`${backendUrl}/conversations`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Assuming the API returns an array of conversations
      const fetchedConversations: Conversation[] = data.conversations || [];
      // Sort conversations by timestamp (newest first)
      fetchedConversations.sort((a, b) => 
        new Date(b.conversation.last_message_timestamp).getTime() - new Date(a.conversation.last_message_timestamp).getTime()
      );
      setConversations(fetchedConversations);
    } catch (err: any) {
      setError(`Failed to fetch conversations: ${err.message}`);
      console.error("Fetch conversations error:", err);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [backendUrl]);

  const fetchConversationHistory = useCallback(async (kbId: string) => {
    setIsLoadingHistory(true);
    setError(null);
    try {
      const response = await fetch(`${backendUrl}/agents/${kbId}/history`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Assuming the API returns messages in { history: [...] } format
      const fetchedHistory: ApiMessage[] = data.history || [];
      // Map API response to the internal Message structure
      const mappedHistory: Message[] = fetchedHistory.map(apiMsg => ({
        sender: apiMsg.type === 'human' ? 'user' : apiMsg.type,
        text: apiMsg.content,
        timestamp: apiMsg.timestamp
      }));
      setConversationHistory(mappedHistory);
    } catch (err: any) {
      setError(`Failed to fetch conversation history: ${err.message}`);
      console.error("Fetch history error:", err);
      setConversationHistory([]); // Clear history on error
    } finally {
      setIsLoadingHistory(false);
    }
  }, [backendUrl]);

  // Fetch conversations on mount and set interval for refresh
  useEffect(() => {
    fetchConversations();
    const intervalId = setInterval(fetchConversations, 30000); // Refresh every 30 seconds
    return () => clearInterval(intervalId); // Cleanup interval on unmount
  }, [fetchConversations]);

  // Fetch history when a conversation is selected
  useEffect(() => {
    if (selectedConversationId) {
      fetchConversationHistory(selectedConversationId);
    } else {
      setConversationHistory([]); // Clear history if no conversation is selected
    }
  }, [selectedConversationId, fetchConversationHistory]);

  const handleSelectConversation = (kbId: string) => {
    setSelectedConversationId(kbId);
    // Reset response form when changing conversation
    setResponseText('');
  };

  const handleSendResponse = useCallback(async () => {
    if (!selectedConversationId || !responseText.trim()) return;

    setIsSending(true);
    setError(null);
    try {
      // Always use human-chat endpoint now
      const endpoint = 'human-chat';
      const payload = { message: responseText };

      const response = await fetch(`${backendUrl}/agents/${selectedConversationId}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 400) {
          throw new Error('Message cannot be empty');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Refresh history and conversation list after successful response
      await fetchConversationHistory(selectedConversationId);
      await fetchConversations(); 
      
      // Clear form and show success message
      setResponseText('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

    } catch (err: any) {
      setError(err.message || 'Failed to send response');
      console.error("Send response error:", err);
    } finally {
      setIsSending(false);
    }
  }, [responseText, selectedConversationId, backendUrl, fetchConversationHistory, fetchConversations]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendResponse();
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Limit max height, e.g., 150px
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px'; 
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResponseText(e.target.value);
    adjustTextareaHeight();
  };

  const filteredConversations = conversations.filter(conv => 
    filter === 'all' || conv.conversation.needs_human_attention
  );

  // Helper to format timestamps
  const formatTimestamp = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch (e) {
      return isoString; // Fallback to raw string if parsing fails
    }
  };

  // --- KB Drawer Functions --- 
  const handleOpenKbDrawer = useCallback((messageText: string | null = null) => {
    setSelectedMessageText(messageText || null);
    setIsKbDrawerOpen(true);
  }, []);

  const handleCloseKbDrawer = useCallback(() => {
    setIsKbDrawerOpen(false);
  }, []);
  // --- End KB Drawer Functions --- 

  return (
    <div className="flex h-screen bg-gray-100 relative overflow-hidden">
      {/* Left Sidebar (Conversation List) */}
      <motion.div
        className="w-80 bg-white border-r border-gray-200 flex flex-col"
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Conversations</h2>
          <div className="mt-4 flex space-x-2">
            <button 
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center transition-colors duration-150 ${filter === 'all' ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <Inbox className="h-4 w-4 mr-1.5" /> All
            </button>
            <button 
              onClick={() => setFilter('attention')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center transition-colors duration-150 ${filter === 'attention' ? 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <AlertCircle className="h-4 w-4 mr-1.5" /> Needs Attention
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoadingConversations ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : error && conversations.length === 0 ? (
             <div className="p-4 text-red-600">Error loading conversations.</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No conversations {filter === 'attention' ? 'needing attention' : 'found'}.</div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.kb_id}
                onClick={() => handleSelectConversation(conv.kb_id)}
                className={`block px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors duration-150 
                  ${selectedConversationId === conv.kb_id ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'} 
                  ${conv.conversation.needs_human_attention ? 'border-l-2 border-yellow-500' : 'border-l-2 border-transparent'}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {conv.name || conv.kb_id}
                  </span>
                  {conv.conversation.needs_human_attention && (
                    <AlertCircle className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0 ml-2" />
                  )}
                </div>
                <p className="text-xs text-gray-600 truncate mb-1">{conv.conversation.last_message_preview}</p>
                <span className="text-xs text-gray-400">{formatTimestamp(conv.conversation.last_message_timestamp)}</span>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* Main Content Area */}
      <motion.div 
        className="flex-1 flex flex-col overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {error && !selectedConversationId && (
           <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 m-4 rounded">
             <p><strong>Error:</strong> {error}</p>
           </div>
        )}
        {selectedConversationId ? (
          <>
            {/* Conversation Display */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 relative">
              {isLoadingHistory ? (
                <div className="text-center text-gray-500 py-10">Loading history...</div>
              ) : conversationHistory.length === 0 ? (
                 <div className="text-center text-gray-500 py-10">No messages in this conversation yet.</div>
              ) : (
                conversationHistory.map((msg, index) => {
                  // Check if the message is an AI message indicating a handoff
                  const isHandoffMessage = msg.sender === 'ai' && msg.text.includes('(needs help)');
                  return (
                    <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : (msg.sender === 'human_agent' ? 'justify-start pl-10' : 'justify-start')}`}>
                      {msg.sender === 'ai' && <Bot className="h-6 w-6 text-blue-500 flex-shrink-0 mt-1" />}
                      {msg.sender === 'human_agent' && <UserCheck className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />}
                      <div 
                        className={`relative max-w-xl px-4 py-2.5 rounded-xl shadow-sm group 
                          ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 
                            (msg.sender === 'human_agent' ? 'bg-green-100 text-green-900 rounded-bl-none' : 
                             'bg-white text-gray-800 rounded-bl-none')}
                          ${isHandoffMessage ? 'bg-orange-50 ring-1 ring-orange-300' : ''}`}
                      >
                        {isHandoffMessage && <AlertCircle className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 text-orange-500 bg-white rounded-full" />}
                        <p className={`text-sm leading-relaxed ${isHandoffMessage ? 'text-orange-900' : ''}`}>{msg.text}</p>
                        <span className={`text-[11px] opacity-70 block mt-1.5 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>{formatTimestamp(msg.timestamp)}</span>

                        {/* Action Buttons Container - appears on hover */} 
                        <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1 
                          ${msg.sender === 'user' ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'}`}>
                          {/* Add to KB Button */} 
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenKbDrawer(msg.text);
                            }}
                            className="text-gray-400 hover:text-purple-600 p-1.5 rounded-full bg-white hover:bg-purple-50 shadow-sm border border-gray-200"
                            title="Add to Knowledge Base"
                          >
                            <PlusSquare className="h-3.5 w-3.5" />
                          </button>
                           {/* Add other buttons like Copy here if desired */} 
                        </div>
                      </div>
                      {msg.sender === 'user' && <User className="h-6 w-6 text-gray-400 flex-shrink-0 mt-1" />}
                    </div>
                  );
                })
              )}
            </div>

            {/* Response Interface */}
            <div className="p-4 bg-white border-t border-gray-200">
              {/* Success Message Indicator */} 
              {showSuccess && (
                <motion.div 
                  className="mb-3 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm flex items-center shadow-sm"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  Response sent successfully!
                </motion.div>
              )}

              {/* General Add to KB Button */} 
              <div className="mb-3 flex justify-end">
                 <button 
                   onClick={() => handleOpenKbDrawer()}
                   className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 border border-transparent rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center shadow-sm"
                   title="Add new knowledge to the KB"
                 >
                   <BookPlus className="h-4 w-4 mr-2" />
                   Add to KB
                 </button>
               </div>

              {/* Input Area like ChatInterface */}
              <div className={`flex items-end bg-gray-50 rounded-lg border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 ${isSending ? 'opacity-70' : ''}`}>
                <textarea
                  ref={textareaRef}
                  value={responseText}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder={isSending ? "Sending..." : "Response to User..."}
                  disabled={isSending}
                  className="flex-1 max-h-[150px] m-1 p-2 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none text-sm"
                  rows={1}
                />
                <button
                  onClick={handleSendResponse}
                  disabled={isSending || !responseText.trim()} 
                  className={`m-1 p-2 rounded-md ${
                    isSending || !responseText.trim()
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-blue-500 hover:bg-blue-50'
                  }`}
                >
                  {isSending ? (
                    <>
                      {/* Use a simpler loading indicator or just disable */} 
                      <CornerDownLeft className="h-5 w-5" /> 
                    </>
                  ) : (
                    <CornerDownLeft className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Hint Text */} 
              <div className="mt-2 text-xs text-gray-500">
                Press Enter to send, Shift+Enter for new line
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-6">
            {error && (
              <div className="w-full max-w-md mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
                <p><strong>Error:</strong> {error}</p>
              </div>
            )}
            <div className="text-center text-gray-500">
              <Inbox className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg">Select a conversation to view details</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Reusable KB Drawer */} 
      <AddKbDrawer
        isOpen={isKbDrawerOpen}
        onClose={handleCloseKbDrawer}
        kbId={selectedConversationId}
        backendUrl={backendUrl}
        initialText={selectedMessageText}
      />
    </div>
  );
};

export default HumanAgentDesk; 