import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Save, CheckCircle, Eye, Code } from 'lucide-react';

// Interface for the component props
interface AgentConfigProps {
  kbId: string;
  backendUrl: string;
}

// Interface for the agent configuration data from the API
interface AgentConfigData {
  system_prompt?: string | null;
  // confidence_threshold?: number | null; // Removed based on new API doc
  max_iterations?: number | null;
  // Add other config fields as needed
}

// Interface for the payload sent to the API (only includes settable fields)
interface AgentConfigPayload {
  system_prompt?: string | null;
  max_iterations?: number | null;
}

// Type for the view mode
type ViewMode = 'structured' | 'raw';

const AgentConfig: React.FC<AgentConfigProps> = ({ kbId, backendUrl }) => {
  const [config, setConfig] = useState<AgentConfigData>({});
  const [initialConfig, setInitialConfig] = useState<AgentConfigData>({}); // To track changes
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('structured'); // Add view mode state, default to structured

  const fetchConfig = useCallback(async () => {
    if (!kbId) return;
    console.log(`Fetching config for ${kbId}`);
    setIsLoading(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const response = await fetch(`${backendUrl}/agents/${kbId}/config`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Provide a more specific default error message
        throw new Error(errorData.message || `Failed to fetch config (status: ${response.status})`);
      }
      const data: AgentConfigData = await response.json();
      // Ensure we initialize all potential keys even if API omits them
      const fullConfig = {
         system_prompt: data.system_prompt ?? null,
         max_iterations: data.max_iterations ?? null,
      };
      setConfig(fullConfig);
      setInitialConfig(fullConfig); // Store initial state for change detection
    } catch (err: any) {
      setError(`Failed to fetch agent configuration: ${err.message}`);
      console.error("Fetch config error:", err);
      // Reset config on error?
      setConfig({}); 
      setInitialConfig({});
    } finally {
      setIsLoading(false);
    }
  }, [kbId, backendUrl]);

  // Fetch config when kbId changes
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setConfig(prevConfig => ({
      ...prevConfig,
      [name]: type === 'number' ? (value === '' ? null : Number(value)) : value,
    }));
  };

  const handleSaveChanges = async () => {
    if (!kbId) return;
    console.log(`Saving config for ${kbId}`);
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    const payload: Partial<AgentConfigPayload> = {};
    // Ensure system_prompt exists before comparing/assigning
    if (config.hasOwnProperty('system_prompt') && config.system_prompt !== initialConfig.system_prompt) {
      payload.system_prompt = config.system_prompt;
    }
    // Ensure max_iterations exists and handle potential undefined/null
    const currentMaxIter = config.max_iterations ?? null;
    const initialMaxIter = initialConfig.max_iterations ?? null;
    if (config.hasOwnProperty('max_iterations') && currentMaxIter !== initialMaxIter) {
        // Ensure valid number (>=1) or null before sending
        payload.max_iterations = (currentMaxIter !== null && currentMaxIter >= 1) ? currentMaxIter : null;
        // If the user entered an invalid value but it *is* a change, we send null (or revert to initial? sending null seems safer)
    }

    if (Object.keys(payload).length === 0) {
      console.log("No changes detected, skipping save.");
      setIsSaving(false);
      return;
    }

    console.log("Payload:", JSON.stringify(payload));

    try {
      const response = await fetch(`${backendUrl}/agents/${kbId}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to save config (status: ${response.status})`);
      }

      // Update initial config to reflect saved state AFTER successful save
      setInitialConfig(config); 
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); // Hide success message after 3s
    } catch (err: any) {
      setError(`Failed to save configuration: ${err.message}`);
      console.error("Save config error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Check if there are any changes compared to the initial config
  const hasChanges = JSON.stringify(config) !== JSON.stringify(initialConfig);

  // Helper function to parse prompt into sections for structured view
  const parsePromptSections = (prompt: string | null | undefined): { header: string; content: string }[] => {
    if (!prompt) return [];
    
    // Regex to find headers like **Header:** followed by content
    // Removed 's' flag, use [\s\S] to match any character including newlines
    const sectionRegex = /\n\n\*\*([A-Z][A-Za-z\s&/-]+):\*\*\n([\s\S]*?)(?=\n\n\*\*|$)/g;
    const sections: { header: string; content: string }[] = [];
    let match;

    // Add the initial part of the prompt before the first header (if any)
    // Need to adjust the logic slightly as exec behavior might change without 's'
    let lastIndex = 0;
    const introMatch = prompt.match(/^([\s\S]*?)(?=\n\n\*\*)/); // Find content before first header
    if (introMatch) {
        sections.push({ header: "Introduction / Overview", content: introMatch[1].trim() });
        lastIndex = introMatch[0].length;
    } else {
        // Check if the entire prompt might be just the intro (no headers)
        if (!/\n\n\*\*[A-Z]/.test(prompt)) { 
             sections.push({ header: "System Prompt", content: prompt.trim() });
             return sections; // Early return if no headers found
        }
    }

    sectionRegex.lastIndex = lastIndex; // Start searching after the intro

    while ((match = sectionRegex.exec(prompt)) !== null) {
        sections.push({
            header: match[1].trim(),
            content: match[2].trim(),
        });
    }
    
    // If still empty after trying regex (e.g., only intro was found but regex didn't match format)
    // and intro wasn't added earlier, add the whole prompt.
    if (sections.length === 0 && !introMatch && prompt.trim()) {
         sections.push({ header: "System Prompt", content: prompt.trim() });
    }

    return sections;
  };

  const promptSections = parsePromptSections(config.system_prompt);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">Agent Configuration</h2>

      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <p className="ml-2 text-gray-600">Loading configuration...</p>
        </div>
      )}

      {error && (
        <div className="flex items-start p-3 rounded-md border bg-red-50 border-red-300">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-4">
          {/* View Mode Toggle Buttons */}
          <div className="flex justify-end space-x-2 mb-4">
            <button
              onClick={() => setViewMode('structured')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center transition-colors duration-150 ${viewMode === 'structured' ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              title="Structured View (Read-only)"
            >
              <Eye className="h-4 w-4 mr-1.5" /> Structured View
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center transition-colors duration-150 ${viewMode === 'raw' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              title="Raw Text / Edit Mode"
            >
              <Code className="h-4 w-4 mr-1.5" /> Raw / Edit
            </button>
          </div>

          {/* System Prompt Area - Conditional Rendering */}
          <div>
            <label htmlFor="system_prompt" className="block text-sm font-medium text-gray-700 mb-1">
              System Prompt
            </label>

            {viewMode === 'raw' ? (
              // Raw / Edit Mode
              <textarea
                id="system_prompt"
                name="system_prompt"
                rows={15} // Increased rows for raw editing
                className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono disabled:bg-gray-50"
                placeholder="Enter the system prompt for the agent..."
                value={config.system_prompt ?? ''} 
                onChange={handleInputChange}
                disabled={isSaving}
              />
            ) : (
              // Structured View Mode (Read-Only)
              <div className="space-y-4 border border-gray-200 rounded-md p-4 bg-gray-50">
                {promptSections.length > 0 ? (
                  promptSections.map((section, index) => (
                    <div key={index}>
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">{section.header}</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap pl-2 border-l-2 border-gray-300">
                        {section.content}
                      </p>
                    </div>
                  ))
                 ) : (
                   <p className="text-sm text-gray-500 italic">No system prompt content to display.</p>
                 )}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {viewMode === 'raw' 
                 ? "Edit the agent\'s persona, instructions, and constraints. Use Markdown for formatting."
                 : "Defines the agent\'s persona, instructions, and constraints (switch to Raw view to edit)."
              }
            </p>
          </div>

          {/* Max Iterations */}
          <div>
            <label htmlFor="max_iterations" className="block text-sm font-medium text-gray-700 mb-1">
              Max Iterations
            </label>
            <input
              type="number"
              id="max_iterations"
              name="max_iterations"
              min="1"
              step="1"
              className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-50"
              placeholder="e.g., 3"
              value={config.max_iterations ?? ''} // Handle null/undefined
              onChange={handleInputChange}
              disabled={isSaving}
            />
             <p className="mt-1 text-xs text-gray-500">Maximum number of internal steps the agent can take (must be &ge; 1).</p>
          </div>

          {/* Save Button Area */} 
          <div className="pt-4 border-t border-gray-200 flex items-center justify-end space-x-3">
            {saveSuccess && (
               <div className="text-sm text-green-600 flex items-center">
                 <CheckCircle className="h-4 w-4 mr-1.5" /> 
                 Configuration saved!
               </div>
            )}
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={!hasChanges || isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="-ml-1 mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentConfig; 