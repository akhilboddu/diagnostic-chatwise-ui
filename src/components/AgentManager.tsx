import React, { useState } from 'react';
import { Plus, Trash2, Check, Loader2 } from 'lucide-react';

// Define the KBInfo interface based on App.tsx
interface KBInfo {
  kb_id: string;
  name: string | null;
  summary: string;
}

// Define the props interface
interface AgentManagerProps {
  kbs: KBInfo[];
  selectedKbId: string | null;
  onKbSelected: (kbId: string | null) => void;
  onKbCreated: (newKb: KBInfo) => void;
  isLoading: boolean;
  backendUrl: string;
  refreshKbs: () => Promise<void>; // Match the type from App.tsx
}

// Use the props interface in the component definition
const AgentManager: React.FC<AgentManagerProps> = ({
  kbs,
  selectedKbId,
  onKbSelected,
  onKbCreated,
  isLoading,
  backendUrl,
  refreshKbs
}) => {
  const [newKbName, setNewKbName] = useState('');
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingKbId, setDeletingKbId] = useState<string | null>(null);

  const handleCreateKb = async () => {
    if (!newKbName.trim()) {
      setError("Please enter a name for the agent");
      return;
    }
    
    setCreateLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${backendUrl}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKbName }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      const createdKb = await response.json();
      onKbCreated({ ...createdKb, summary: createdKb.message || "(Agent created)" });
      setNewKbName('');
      setCreatingAgent(false);
    } catch (error: any) {
      console.error("Failed to create KB:", error);
      setError(error.message || "Failed to create agent");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteKb = async (kbIdToDelete: string) => {
    setDeletingKbId(kbIdToDelete);
    setError(null);
    try {
      const response = await fetch(`${backendUrl}/agents/${kbIdToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      // If the deleted KB was the selected one, deselect it
      if (selectedKbId === kbIdToDelete) {
        onKbSelected(null);
      }

      // Refresh the list from the parent component
      await refreshKbs(); 

    } catch (error: any) {
      console.error("Failed to delete KB:", error);
      setError(error.message || "Failed to delete agent");
      // Optional: Add more specific error handling or user feedback
    } finally {
      setDeletingKbId(null); // Reset deleting state regardless of outcome
    }
  };

  return (
    <div className="flex flex-col">
      {/* Create Agent UI */}
      {creatingAgent ? (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="flex flex-col space-y-2">
            <label htmlFor="agent-name" className="text-xs font-medium text-gray-700">
              Agent Name
            </label>
            <input
              id="agent-name"
              type="text"
              value={newKbName}
              onChange={(e) => setNewKbName(e.target.value)}
              placeholder="e.g., Siza Diagnostics"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end space-x-2 pt-2">
              <button 
                onClick={() => {
                  setCreatingAgent(false);
                  setError(null);
                  setNewKbName('');
                }}
                className="rounded px-3 py-1 text-xs text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateKb}
                disabled={createLoading || !newKbName.trim()}
                className="rounded bg-blue-500 px-3 py-1 text-xs text-white hover:bg-blue-600 disabled:bg-blue-300 flex items-center"
              >
                {createLoading ? (
                  <>
                    <svg className="mr-1 h-3 w-3 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating...
                  </>
                ) : "Create Agent"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreatingAgent(true)}
          className="mb-4 flex w-full items-center justify-center rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50"
        >
          <Plus className="mr-1 h-4 w-4" />
          New Agent
        </button>
      )}

      {/* Agent List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <svg className="h-5 w-5 animate-spin text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-96 pr-1 -mr-1">
          {kbs.length === 0 ? (
            <p className="text-center py-4 text-sm text-gray-500">No agents found. Create one to get started.</p>
          ) : (
            <ul className="space-y-1">
              {kbs.map((kb) => (
                <li
                  key={kb.kb_id}
                  onClick={() => onKbSelected(kb.kb_id)}
                  className={`flex items-center justify-between rounded-md px-3 py-2 cursor-pointer transition-colors group ${
                    selectedKbId === kb.kb_id
                      ? "bg-blue-50 text-blue-700"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center overflow-hidden">
                    {selectedKbId === kb.kb_id && (
                      <Check className="h-3.5 w-3.5 text-blue-500 mr-1.5 flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">{kb.name || kb.kb_id}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteKb(kb.kb_id);
                    }}
                    disabled={deletingKbId === kb.kb_id}
                    className="ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed p-1 rounded-full hover:bg-red-50"
                    title="Delete Agent"
                  >
                    {deletingKbId === kb.kb_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentManager; 