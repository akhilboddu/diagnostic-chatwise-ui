import React, { useState, useEffect, useCallback } from 'react';
import { UploadCloud, AlertCircle, CheckCircle, Loader2, RefreshCw, Database, Copy, Check } from 'lucide-react';

interface JSONUploadProps {
  kbId: string;
  backendUrl: string;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';
type StatusMessage = { type: 'success' | 'error'; text: string } | null;

const JSONUpload: React.FC<JSONUploadProps> = ({ kbId, backendUrl }) => {
  const [jsonData, setJsonData] = useState<string>('');
  const [isValidJson, setIsValidJson] = useState<boolean>(true);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadMessage, setUploadMessage] = useState<StatusMessage>(null);

  const [existingJsonContent, setExistingJsonContent] = useState<any[]>([]);
  const [isFetchingJson, setIsFetchingJson] = useState<boolean>(false);
  const [fetchJsonError, setFetchJsonError] = useState<string | null>(null);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fetchExistingJson = useCallback(async () => {
    if (!kbId) return;
    setIsFetchingJson(true);
    setFetchJsonError(null);
    try {
      const response = await fetch(`${backendUrl}/agents/${kbId}/json`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setExistingJsonContent(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setFetchJsonError(`Failed to fetch existing JSON: ${err.message}`);
      console.error("Fetch existing JSON error:", err);
      setExistingJsonContent([]);
    } finally {
      setIsFetchingJson(false);
    }
  }, [kbId, backendUrl]);

  useEffect(() => {
    fetchExistingJson();
  }, [fetchExistingJson]);

  const handleJsonChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const data = event.target.value;
    setJsonData(data);
    setUploadMessage(null);
    setUploadStatus('idle');

    if (data.trim() === '') {
      setIsValidJson(true);
      return;
    }

    try {
      JSON.parse(data);
      setIsValidJson(true);
    } catch (error) {
      setIsValidJson(false);
    }
  };

  const handleUpload = async () => {
    if (!isValidJson || jsonData.trim() === '' || uploadStatus === 'uploading') {
      if (!isValidJson) {
          setUploadMessage({ type: 'error', text: 'Input is not valid JSON.' });
      } else if (jsonData.trim() === '') {
          setUploadMessage({ type: 'error', text: 'JSON input cannot be empty.' });
      }
      return;
    }

    setUploadStatus('uploading');
    setUploadMessage(null);

    try {
        const parsedJson = JSON.parse(jsonData);
        const response = await fetch(`${backendUrl}/agents/${kbId}/json`, {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json',
            },
            body: JSON.stringify({ json_data: parsedJson }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Failed to upload JSON data.');
        }

        setUploadStatus('success');
        setUploadMessage({ type: 'success', text: result.message || 'JSON data uploaded successfully.' });
        setJsonData('');
        fetchExistingJson();

    } catch (error: any) {
        console.error("JSON Upload error:", error);
        setUploadStatus('error');
        const message = error.message || 'An unexpected error occurred.';
        if (message.includes('valid JSON')) {
             setUploadMessage({ type: 'error', text: 'Failed to upload: Invalid JSON format.' });
        } else {
             setUploadMessage({ type: 'error', text: `Failed to upload: ${message}` });
        }
    } finally {
        if (uploadStatus !== 'success' && uploadStatus !== 'error') {
             setUploadStatus('idle');
        }
    }
  };

  const handleCopyJsonObject = (jsonObject: any, index: number) => {
    try {
      const jsonString = JSON.stringify(jsonObject, null, 2);
      navigator.clipboard.writeText(jsonString)
        .then(() => {
          setCopiedIndex(index);
          setTimeout(() => setCopiedIndex(null), 1500);
        })
        .catch(err => {
          console.error('Failed to copy JSON object: ', err);
        });
    } catch (error) {
       console.error('Failed to stringify JSON object for copying: ', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-md font-medium text-gray-700">Upload JSON Data</h3>
        <p className="text-sm text-gray-500">
          Paste your JSON data below to populate the knowledge base for agent <strong>{kbId}</strong>.
        </p>
        
        <textarea
          value={jsonData}
          onChange={handleJsonChange}
          placeholder='{
    "key": "value",
    "items": [
      { "id": 1, "name": "Example 1" },
      { "id": 2, "name": "Example 2" }
    ]
  }'
          rows={10}
          className={`w-full p-3 border rounded-md font-mono text-sm focus:outline-none focus:ring-2 ${
            isValidJson
              ? 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              : 'border-red-500 focus:ring-red-500 focus:border-red-500'
          }`}
          disabled={uploadStatus === 'uploading'}
        />
        {!isValidJson && jsonData.trim() !== '' && (
          <p className="text-xs text-red-600">Invalid JSON format.</p>
        )}

        <button
          onClick={handleUpload}
          disabled={!isValidJson || jsonData.trim() === '' || uploadStatus === 'uploading'}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          {uploadStatus === 'uploading' ? (
            <>
              <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
              Uploading...
            </>
          ) : (
            <>
              <UploadCloud className="-ml-1 mr-2 h-4 w-4" />
              Upload JSON
            </>
          )}
        </button>

        {uploadMessage && (
          <div className={`flex items-start p-3 rounded-md border ${
              uploadMessage.type === 'success' ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
            }`}
          >
            {uploadMessage.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
            )}
            <p className={`text-sm ${
                uploadMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {uploadMessage.text}
            </p>
          </div>
        )}
      </div>

      <hr className="border-gray-200" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-md font-medium text-gray-700">
              Existing JSON Content ({existingJsonContent.length} {existingJsonContent.length === 1 ? 'object' : 'objects'})
            </h3>
            <button 
              onClick={fetchExistingJson}
              disabled={isFetchingJson}
              className="p-1 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 transition-colors"
              title="Refresh JSON Content"
            >
              <RefreshCw className={`h-4 w-4 ${isFetchingJson ? 'animate-spin' : ''}`} />
            </button>
        </div>

        {isFetchingJson && (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <p className="ml-2 text-sm text-gray-600">Loading existing JSON...</p>
          </div>
        )}

        {fetchJsonError && (
            <div className="flex items-start p-3 rounded-md border bg-red-50 border-red-300">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
            <p className="text-sm text-red-700">{fetchJsonError}</p>
            </div>
        )}

        {!isFetchingJson && !fetchJsonError && (
          existingJsonContent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 border border-dashed border-gray-300 rounded-lg">
              <Database className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">No existing JSON content found for this agent.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[30rem] overflow-auto pr-2">
              {existingJsonContent.map((jsonObject, index) => (
                <div key={index} className="border border-gray-200 rounded-lg bg-gray-50 p-3 relative group">
                  <button
                    onClick={() => handleCopyJsonObject(jsonObject, index)}
                    className="absolute top-1 right-1 p-1 bg-gray-200 rounded text-gray-600 hover:bg-gray-300 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Copy JSON Object"
                  >
                    {copiedIndex === index ? 
                       <Check className="h-3.5 w-3.5 text-green-600" /> : 
                       <Copy className="h-3.5 w-3.5" />
                    }
                  </button>
                  <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap break-words max-h-60 overflow-auto">
                    {JSON.stringify(jsonObject, null, 2)} 
                  </pre>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default JSONUpload; 