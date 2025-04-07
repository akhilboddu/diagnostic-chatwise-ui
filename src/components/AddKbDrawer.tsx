import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, BookPlus } from 'lucide-react';

interface AddKbDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  kbId: string | null; // KB ID to add knowledge to
  backendUrl: string;
  initialText?: string | null; // Optional text to pre-fill
}

const AddKbDrawer: React.FC<AddKbDrawerProps> = ({
  isOpen,
  onClose,
  kbId,
  backendUrl,
  initialText = '', // Default to empty string
}) => {
  const [kbEditText, setKbEditText] = useState<string>('');
  const [isSavingToKb, setIsSavingToKb] = useState<boolean>(false);
  const [kbSaveError, setKbSaveError] = useState<string | null>(null);
  const [showKbSaveSuccess, setShowKbSaveSuccess] = useState<boolean>(false);

  // Reset form when initialText changes (e.g., opening drawer with new message)
  useEffect(() => {
    setKbEditText(initialText || '');
    setKbSaveError(null);
    setShowKbSaveSuccess(false);
    // Don't reset isSavingToKb here, as it might be triggered by an external button
  }, [initialText, isOpen]); // Depend on isOpen to reset when drawer opens

  const handleSaveToKb = async () => {
    if (!kbId || !kbEditText.trim()) {
      setKbSaveError('KB ID is missing or text cannot be empty.');
      return;
    }

    setIsSavingToKb(true);
    setKbSaveError(null);
    setShowKbSaveSuccess(false);

    try {
      const payload = {
        knowledge_text: kbEditText.trim(),
      };

      const response = await fetch(`${backendUrl}/agents/${kbId}/human-knowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}. ${errorText || 'Failed to save to KB'}`);
      }
      
      setShowKbSaveSuccess(true);
      setTimeout(() => {
        setShowKbSaveSuccess(false); // Reset success message
        onClose(); // Close drawer via callback
      }, 1500);

    } catch (err: any) {
      setKbSaveError(err.message || 'An unknown error occurred while saving.');
      console.error("Save to KB error:", err);
    } finally {
      setIsSavingToKb(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed top-0 right-0 bottom-0 w-96 bg-white shadow-lg z-50 border-l border-gray-200 flex flex-col"
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
          // Prevent clicks inside drawer from closing it unintentionally if overlay was present
          onClick={(e) => e.stopPropagation()} 
        >
          {/* Drawer Header */}
          <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <BookPlus className="h-5 w-5 mr-2 text-indigo-600"/>
              Add to Knowledge Base
            </h3>
            <button 
              onClick={onClose} // Use callback to close
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              aria-label="Close drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {initialText && ( // Only show original if provided
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Original Message:</label>
                <p className="text-sm p-3 bg-gray-50 border border-gray-200 rounded-md text-gray-700 whitespace-pre-wrap">
                  {initialText}
                </p>
              </div>
            )}
            <div>
              <label htmlFor="kb-edit-text" className="block text-sm font-medium text-gray-600 mb-1">
                {initialText ? 'Knowledge Base Text (edit if needed):' : 'Knowledge Base Text:'}
              </label>
              <textarea
                id="kb-edit-text"
                value={kbEditText}
                onChange={(e) => setKbEditText(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[100px] text-sm"
                rows={initialText ? 5 : 8} // More rows if no original text
                disabled={isSavingToKb}
                placeholder="Enter the text to add to the knowledge base..."
              />
            </div>
            {kbSaveError && (
               <div className="text-sm text-red-600">Error: {kbSaveError}</div>
            )}
            {showKbSaveSuccess && (
               <div className="text-sm text-green-600 flex items-center">
                 <CheckCircle className="h-4 w-4 mr-1.5" /> 
                 Saved successfully!
               </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-gray-200 flex justify-end space-x-3 flex-shrink-0">
            <button 
              onClick={onClose} // Use callback to close
              disabled={isSavingToKb}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveToKb}
              disabled={!kbEditText.trim() || isSavingToKb || !kbId} // Also disable if no kbId
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
            >
              {isSavingToKb ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
               ) : (
                 'Save to KB'
               )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AddKbDrawer; 