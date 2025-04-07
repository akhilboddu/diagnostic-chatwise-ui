import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Database, BookPlus, Trash2, CheckCircle } from 'lucide-react';
import AddKbDrawer from './AddKbDrawer';

interface ContentItem {
  id: string;
  document: string;
}

interface KnowledgeBaseViewerProps {
  kbId: string;
  backendUrl: string;
}

const KnowledgeBaseViewer: React.FC<KnowledgeBaseViewerProps> = ({ kbId, backendUrl }) => {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isKbDrawerOpen, setIsKbDrawerOpen] = useState<boolean>(false);

  // State for Cleanup Action
  const [isCleaning, setIsCleaning] = useState<boolean>(false);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [showCleanupSuccess, setShowCleanupSuccess] = useState<boolean>(false);

  // Moved fetchContent outside useEffect so it can be called by cleanup
  const fetchContent = useCallback(async () => {
    if (!kbId) return;

    setIsLoading(true);
    setError(null);
    // Keep existing content while loading? Or clear?
    // setContent([]);
    // setTotalCount(0);

    try {
      const response = await fetch(`${backendUrl}/agents/${kbId}/content`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setContent(data.content || []);
      setTotalCount(data.total_count || 0);
    } catch (err: any) {
      setError(`Failed to fetch knowledge base content: ${err.message}`);
      console.error("Fetch KB content error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [kbId, backendUrl]);

  useEffect(() => {
    fetchContent(); // Call on initial load / kbId change
  }, [fetchContent]);

  const handleOpenKbDrawer = useCallback(() => {
    setIsKbDrawerOpen(true);
  }, []);

  const handleCloseKbDrawer = useCallback(() => {
    setIsKbDrawerOpen(false);
    // Refresh content after adding new knowledge?
    fetchContent(); 
  }, [fetchContent]); // Add fetchContent dependency

  // Handler for Cleanup Button
  const handleCleanupKb = useCallback(async () => {
    if (!kbId || !window.confirm("Are you sure you want to run cleanup on this knowledge base? This might remove redundant or conflicting entries.")) {
        return;
    }

    setIsCleaning(true);
    setCleanupError(null);
    setShowCleanupSuccess(false);

    try {
      const response = await fetch(`${backendUrl}/agents/${kbId}/cleanup`, {
        method: 'POST',
        // No body needed according to common practice for such endpoints
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Cleanup failed: status ${response.status}`);
      }
      
      // Show success and refresh content
      setShowCleanupSuccess(true);
      fetchContent(); // Refresh the list after cleanup
      setTimeout(() => setShowCleanupSuccess(false), 3000); // Hide after 3s

    } catch (err: any) {
      setCleanupError(err.message || 'An unknown error occurred during cleanup.');
      console.error("Cleanup KB error:", err);
    } finally {
      setIsCleaning(false);
    }
  }, [kbId, backendUrl, fetchContent]);

  return (
    <div className="space-y-4 relative">
      <h3 className="text-md font-medium text-gray-700">Knowledge Base Content ({totalCount} items)</h3>
      
      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <p className="ml-2 text-gray-600">Loading content...</p>
        </div>
      )}

      {error && (
        <div className="flex items-start p-3 rounded-md border bg-red-50 border-red-300">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-end gap-3 mb-4">
         {/* Cleanup Button */} 
         <button 
           onClick={handleCleanupKb}
           disabled={!kbId || isCleaning || isLoading}
           className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-transparent rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
           title="Clean up redundant/conflicting entries in this KB"
         >
           <Trash2 className={`h-4 w-4 mr-2 ${isCleaning ? 'animate-spin' : ''}`} />
           {isCleaning ? 'Cleaning Up...' : 'Cleanup KB'}
         </button>

        {/* Add Knowledge Button */} 
        <button 
          onClick={handleOpenKbDrawer}
          disabled={!kbId} // Disable if no KB is selected
         className="px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-100 border border-transparent rounded-md hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
         title="Add new knowledge to this KB"
       >
         <BookPlus className="h-4 w-4 mr-2" />
         Add New Knowledge
       </button>
      </div>

      {/* Cleanup Feedback Messages */} 
      {cleanupError && (
          <div className="flex items-start p-3 rounded-md border bg-red-50 border-red-300 mb-4">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-700">Cleanup Error: {cleanupError}</p>
          </div>
      )}
      {showCleanupSuccess && (
          <div className="flex items-center p-3 rounded-md border bg-green-50 border-green-300 mb-4">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
              <p className="text-sm text-green-700">Knowledge base cleanup successful!</p>
          </div>
      )}

      {!isLoading && !error && content.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-gray-300 rounded-lg">
           <Database className="h-8 w-8 text-gray-400 mb-2" />
           <p className="text-gray-500">Knowledge base is empty.</p>
        </div>
      )}

      {!isLoading && !error && content.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {content.map((item) => (
              <li key={item.id} className="p-4 bg-white hover:bg-gray-50 transition-colors">
                <p className="text-xs font-mono text-gray-500 mb-1">ID: {item.id}</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                  {item.document}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AddKbDrawer
        isOpen={isKbDrawerOpen}
        onClose={handleCloseKbDrawer}
        kbId={kbId}
        backendUrl={backendUrl}
      />
    </div>
  );
};

export default KnowledgeBaseViewer; 