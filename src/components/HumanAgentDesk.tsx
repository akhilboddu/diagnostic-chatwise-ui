import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, AlertCircle, Send, Inbox, Filter, CheckCircle, User, Bot, UserCheck } from 'lucide-react';

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
  const [updateKb, setUpdateKb] = useState<boolean>(false);
  const [kbUpdateText, setKbUpdateText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

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
    setUpdateKb(false);
    setKbUpdateText('');
  };

  const handleSendResponse = async () => {
    if (!selectedConversationId || !responseText.trim()) return;

    setIsSending(true);
    setError(null);
    try {
      // Choose endpoint and payload based on whether we're updating KB
      const endpoint = updateKb ? 'human_response' : 'human-chat';
      const payload = updateKb ? {
        human_response: responseText,
        update_kb: true,
        kb_update_text: kbUpdateText.trim() || responseText,
      } : {
        message: responseText
      };

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
      setUpdateKb(false);
      setKbUpdateText('');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

    } catch (err: any) {
      setError(err.message || 'Failed to send response');
      console.error("Send response error:", err);
    } finally {
      setIsSending(false);
    }
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

  return (
    <div className="flex h-screen bg-gray-100">
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
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
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
                        className={`relative max-w-xl px-4 py-2.5 rounded-xl shadow-sm 
                          ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 
                            (msg.sender === 'human_agent' ? 'bg-green-100 text-green-900 rounded-bl-none' : 
                             'bg-white text-gray-800 rounded-bl-none')}
                          ${isHandoffMessage ? 'bg-orange-50 ring-1 ring-orange-300' : ''}`}
                      >
                        {isHandoffMessage && <AlertCircle className="absolute -top-1.5 -left-1.5 h-3.5 w-3.5 text-orange-500 bg-white rounded-full" />}
                        <p className={`text-sm leading-relaxed ${isHandoffMessage ? 'text-orange-900' : ''}`}>{msg.text}</p>
                        <span className={`text-[11px] opacity-70 block mt-1.5 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>{formatTimestamp(msg.timestamp)}</span>
                      </div>
                      {msg.sender === 'user' && <User className="h-6 w-6 text-gray-400 flex-shrink-0 mt-1" />}
                    </div>
                  );
                })
              )}
            </div>

            {/* Response Interface */}
            <div className="p-4 bg-white border-t border-gray-200 space-y-3">
              {/* Success Message Indicator */} 
              {showSuccess && (
                <motion.div 
                  className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm flex items-center shadow-sm"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  Response sent successfully!
                </motion.div>
              )}

              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-500 resize-none transition duration-150 ease-in-out text-sm"
                rows={3}
                placeholder="Response to User..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                disabled={isSending}
              />
              {updateKb && (
                <div className="space-y-1.5">
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-500 resize-none transition duration-150 ease-in-out text-sm"
                    rows={2}
                    placeholder="Knowledge Base Text (optional, defaults to user response)"
                    value={kbUpdateText}
                    onChange={(e) => setKbUpdateText(e.target.value)}
                    disabled={isSending}
                  />
                  <p className="text-xs text-gray-500">Customize the knowledge to add to the system. If left blank, the user response will be used.</p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                   <input 
                     type="checkbox" 
                     id="update-kb" 
                     checked={updateKb}
                     onChange={(e) => setUpdateKb(e.target.checked)}
                     className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-offset-0 focus:ring-2"
                     disabled={isSending}
                   />
                   <label htmlFor="update-kb" className="text-sm text-gray-700 select-none">Add to Knowledge Base</label>
                 </div>
                <button
                  onClick={handleSendResponse}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed flex items-center transition duration-150 ease-in-out shadow-sm"
                  disabled={!responseText.trim() || isSending}
                >
                  {isSending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2.5 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" /> Send
                    </>
                  )}
                </button>
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
    </div>
  );
};

export default HumanAgentDesk; 