import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, MessageSquare, Plus, RefreshCw, User, Bot, FileJson, Copy, Check, Database, Monitor, Settings } from 'lucide-react';
import AgentManager from './components/AgentManager';
import FileUpload from './components/FileUpload';
import JSONUpload from './components/JSONUpload';
import ChatInterface from './components/ChatInterface';
import KnowledgeBaseViewer from './components/KnowledgeBaseViewer';
import HumanAgentDesk from './components/HumanAgentDesk';
import AgentConfig from './components/AgentConfig';

interface KBInfo {
  kb_id: string;
  name: string | null;
  summary: string;
}

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/human-desk" element={<HumanAgentDeskWrapper />} />
      </Routes>
    </Router>
  );
}

// Wrapper for the main application content
const MainApp: React.FC = () => {
  const [kbs, setKbs] = useState<KBInfo[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("config");
  const [copiedKbId, setCopiedKbId] = useState<boolean>(false);

  // Fetch KBs on mount
  useEffect(() => {
    fetchKbs();
  }, []);

  const fetchKbs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/agents`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setKbs(data.kbs || []);
    } catch (err: any) {
      setError(`Failed to fetch agents: ${err.message}`);
      console.error("Fetch agents error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKbCreated = (newKb: KBInfo) => {
    setKbs(prevKbs => [...prevKbs, newKb]);
    setSelectedKbId(newKb.kb_id);
  };

  const handleKbSelected = (kbId: string | null) => {
    setSelectedKbId(kbId);
  };

  const handleCopyKbId = () => {
    if (selectedKbId) {
      navigator.clipboard.writeText(selectedKbId)
        .then(() => {
          setCopiedKbId(true);
          setTimeout(() => setCopiedKbId(false), 1500);
        })
        .catch(err => {
          console.error('Failed to copy KB ID: ', err);
        });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <motion.div
        className="w-80 bg-white border-r border-gray-200 p-4 flex flex-col h-screen"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Bot className="h-8 w-8 text-blue-500 mr-2" />
            <h1 className="text-xl font-bold text-gray-800">Diagnostic AI</h1>
          </div>
          <Link to="/human-desk" title="Human Agent Desk" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
            <Monitor className="h-5 w-5 text-gray-600" />
          </Link>
        </div>
        
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Agents</h2>
            <button 
              onClick={fetchKbs}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <AgentManager
            kbs={kbs}
            selectedKbId={selectedKbId}
            onKbSelected={handleKbSelected}
            onKbCreated={handleKbCreated}
            isLoading={isLoading}
            backendUrl={BACKEND_URL}
            refreshKbs={fetchKbs}
          />
        </div>

        <div className="mt-auto pt-4 border-t border-gray-200">
          <div className="flex items-center text-sm text-gray-600">
            <User className="h-4 w-4 mr-2" />
            <span>User Session</span>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <motion.div 
        className="flex-1 flex flex-col h-screen overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4 rounded shadow-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs with KB ID display */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 py-2 sm:px-6 flex items-center justify-between">
            <div className="flex space-x-4 overflow-x-auto">
              {/* Agent Config Tab */}
              <button
                className={`px-3 py-2 font-medium text-sm rounded-md flex items-center whitespace-nowrap ${ 
                  activeTab === "config"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("config")}
              >
                <Settings className="h-4 w-4 mr-2" />
                Config
              </button>
              {/* Upload Files Tab */}
              <button
                className={`px-3 py-2 font-medium text-sm rounded-md flex items-center ${
                  activeTab === "upload"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("upload")}
              >
                <FileText className="h-4 w-4 mr-2" />
                Upload Files
              </button>
              <button
                className={`px-3 py-2 font-medium text-sm rounded-md flex items-center ${
                  activeTab === "upload-json"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("upload-json")}
              >
                <FileJson className="h-4 w-4 mr-2" />
                JSON Upload
              </button>
              <button
                className={`px-3 py-2 font-medium text-sm rounded-md flex items-center ${
                  activeTab === "view-kb"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("view-kb")}
              >
                <Database className="h-4 w-4 mr-2" />
                KB
              </button>
              <button
                className={`px-3 py-2 font-medium text-sm rounded-md flex items-center ${
                  activeTab === "chat"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setActiveTab("chat")}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat Simulator
              </button>
            </div>
            
            {selectedKbId && (
              <div className="relative group">
                <button
                  onClick={handleCopyKbId}
                  className="flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-mono cursor-pointer hover:bg-gray-200 transition-colors"
                  title="Click to copy Agent ID"
                >
                  {copiedKbId ? 
                    <Check className="h-3 w-3 text-green-500 mr-1" /> : 
                    <Copy className="h-3 w-3 mr-1" />
                  }
                  {selectedKbId}
                </button>
                {copiedKbId && (
                   <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-black text-white text-[10px] rounded opacity-75 whitespace-nowrap">
                     Copied!
                   </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === "upload" ? (
            selectedKbId ? (
              <div className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Upload Files</h2>
                <FileUpload kbId={selectedKbId} backendUrl={BACKEND_URL} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="bg-gray-100 rounded-full p-4 mb-4">
                  <Plus className="h-6 w-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium mb-2 text-gray-900">No Agent Selected</h3>
                <p className="text-gray-500 max-w-md">
                  Please select an existing agent or create a new one to upload files.
                </p>
              </div>
            )
          ) : activeTab === "upload-json" ? (
            selectedKbId ? (
              <div className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Upload JSON</h2>
                <JSONUpload kbId={selectedKbId} backendUrl={BACKEND_URL} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="bg-gray-100 rounded-full p-4 mb-4">
                  <FileJson className="h-6 w-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium mb-2 text-gray-900">No Agent Selected</h3>
                <p className="text-gray-500 max-w-md">
                  Please select an existing agent or create a new one to upload JSON data.
                </p>
              </div>
            )
          ) : activeTab === "view-kb" ? (
            selectedKbId ? (
              <div className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
                <KnowledgeBaseViewer kbId={selectedKbId} backendUrl={BACKEND_URL} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="bg-gray-100 rounded-full p-4 mb-4">
                  <Database className="h-6 w-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium mb-2 text-gray-900">No Agent Selected</h3>
                <p className="text-gray-500 max-w-md">
                  Please select an agent to view its knowledge base.
                </p>
              </div>
            )
          ) : activeTab === "chat" ? (
            selectedKbId ? (
              <div className="h-full flex flex-col">
                <ChatInterface kbId={selectedKbId} backendUrl={BACKEND_URL} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="bg-gray-100 rounded-full p-4 mb-4">
                  <MessageSquare className="h-6 w-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium mb-2 text-gray-900">No Agent Selected</h3>
                <p className="text-gray-500 max-w-md">
                  Please select an existing agent or create a new one to start chatting.
                </p>
              </div>
            )
          ) : activeTab === "config" ? (
            selectedKbId ? (
              <div className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
                <AgentConfig kbId={selectedKbId} backendUrl={BACKEND_URL} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="bg-gray-100 rounded-full p-4 mb-4">
                  <Settings className="h-6 w-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium mb-2 text-gray-900">No Agent Selected</h3>
                <p className="text-gray-500 max-w-md">
                  Please select an agent to view or modify its configuration.
                </p>
              </div>
            )
          ) : ( // Should not happen, but fallback needed
            selectedKbId ? (
              <div className="h-full flex flex-col">
                <ChatInterface kbId={selectedKbId} backendUrl={BACKEND_URL} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="bg-gray-100 rounded-full p-4 mb-4">
                  <MessageSquare className="h-6 w-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-medium mb-2 text-gray-900">No Agent Selected</h3>
                <p className="text-gray-500 max-w-md">
                  Please select an existing agent or create a new one to start chatting.
                </p>
              </div>
            )
          )}
        </div>
      </motion.div>
    </div>
  );
};

// Wrapper component for HumanAgentDesk to pass backend URL
const HumanAgentDeskWrapper: React.FC = () => {
  return <HumanAgentDesk backendUrl={BACKEND_URL} />;
};

export default App;
