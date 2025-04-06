import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Database } from 'lucide-react';

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

  useEffect(() => {
    const fetchContent = async () => {
      if (!kbId) return;

      setIsLoading(true);
      setError(null);
      setContent([]);
      setTotalCount(0);

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
    };

    fetchContent();
  }, [kbId, backendUrl]);

  return (
    <div className="space-y-4">
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
    </div>
  );
};

export default KnowledgeBaseViewer; 