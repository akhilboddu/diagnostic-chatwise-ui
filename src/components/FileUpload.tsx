import React, { useState, useCallback, useRef } from 'react';
import { FileUp, X, Check, FileText, Loader2 } from 'lucide-react';

// Define the props interface
interface FileUploadProps {
  kbId: string;
  backendUrl: string;
}

// Use the props interface in the component definition
const FileUpload: React.FC<FileUploadProps> = ({ kbId, backendUrl }) => {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{type: 'success' | 'error' | 'none', message: string}>({ 
    type: 'none', 
    message: '' 
  });
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
    setUploadStatus({ type: 'none', message: '' });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFiles(e.dataTransfer.files);
      setUploadStatus({ type: 'none', message: '' });
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleUpload = useCallback(async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setUploadStatus({ 
        type: 'error', 
        message: 'Please select files first.' 
      });
      return;
    }

    setUploading(true);
    setUploadStatus({ type: 'none', message: '' });
    
    const formData = new FormData();
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append('file', selectedFiles[i]);
    }

    try {
      const response = await fetch(`${backendUrl}/agents/${kbId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Upload failed with status: ' + response.status }));
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result = await response.json();
      setUploadStatus({ 
        type: 'success', 
        message: result.message || 'Files uploaded successfully.' 
      });
      setSelectedFiles(null);
      
      // Clear file input
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadStatus({ 
        type: 'error', 
        message: `Upload failed: ${error.message}` 
      });
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  }, [selectedFiles, kbId, backendUrl]);

  const clearSelectedFiles = () => {
    setSelectedFiles(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadStatus({ type: 'none', message: '' });
  };

  const renderUploadStatusMessage = () => {
    if (uploadStatus.type === 'none') return null;
    
    return (
      <div className={`mt-4 rounded-md p-3 ${
        uploadStatus.type === 'success' 
          ? 'bg-green-50 text-green-800 border border-green-200' 
          : 'bg-red-50 text-red-800 border border-red-200'
      }`}>
        <div className="flex items-center">
          {uploadStatus.type === 'success' ? (
            <Check className="h-5 w-5 mr-2 text-green-500" />
          ) : (
            <X className="h-5 w-5 mr-2 text-red-500" />
          )}
          <p className="text-sm">{uploadStatus.message}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div 
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          id="fileInput"
          type="file"
          multiple
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
        
        <FileUp className="h-10 w-10 mx-auto text-gray-400 mb-3" />
        
        <p className="text-sm text-gray-600 mb-2">
          Drag and drop files here, or <span className="text-blue-500 cursor-pointer" onClick={() => fileInputRef.current?.click()}>browse</span>
        </p>
        <p className="text-xs text-gray-500">Supports documents, PDFs, text files (max 10MB)</p>
      </div>

      {/* Selected Files List */}
      {selectedFiles && selectedFiles.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium text-gray-700">Selected Files</h3>
            <button 
              onClick={clearSelectedFiles}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
            >
              <X className="h-3 w-3 mr-1" />
              Clear all
            </button>
          </div>
          
          <div className="border rounded-md divide-y">
            {Array.from(selectedFiles).map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-3">
                <div className="flex items-center">
                  <FileText className="h-4 w-4 text-gray-400 mr-2" />
                  <div>
                    <p className="text-sm text-gray-700 truncate max-w-xs">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                {uploadProgress[file.name] && !uploading ? (
                  <span className="text-xs text-gray-500">{uploadProgress[file.name]}%</span>
                ) : null}
              </div>
            ))}
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className={`flex items-center px-4 py-2 rounded-md text-white text-sm font-medium ${
                uploading 
                  ? 'bg-blue-400 cursor-not-allowed' 
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4 mr-2" />
                  Upload Files
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {renderUploadStatusMessage()}
    </div>
  );
};

export default FileUpload; 