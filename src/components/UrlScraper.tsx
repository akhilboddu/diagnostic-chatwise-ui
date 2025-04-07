import React, { useState, useCallback, useEffect } from 'react';
import { Loader2, AlertCircle, CheckCircle, Link2 } from 'lucide-react';

// Interface for the component props
interface UrlScraperProps {
  kbId: string;
  backendUrl: string;
}

// Interface for the expected success response from the API
interface ScrapeResponse {
    kb_id: string;
    status: string; // e.g., "processing"
    message: string;
    submitted_url: string;
}

// Interface for the scraping status response
interface ScrapeStatus {
    kb_id: string;
    status: string;
    submitted_url: string;
    pages_scraped?: number;
    total_pages?: number;
    progress?: {
        chars_added: number;
        profile_keys: string[];
    };
    last_update: string;
}

const UrlScraper: React.FC<UrlScraperProps> = ({ kbId, backendUrl }) => {
  const [url, setUrl] = useState<string>('');
  const [maxPages, setMaxPages] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Function to fetch scraping status
  const fetchScrapeStatus = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/agents/${kbId}/scrape-status`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.detail || `Failed to fetch status: ${response.status}`);
      }

      setScrapeStatus(data);
      
      // Continue polling if still processing
      if (data.status === "processing") {
        return true;
      } else {
        setIsPolling(false);
        if (data.status === "completed") {
          setSuccessMessage(`Scraping completed! Added ${data.progress?.chars_added || 0} characters of content.`);
          setTimeout(() => {
            setSuccessMessage(null);
            setScrapeStatus(null);
          }, 5000);
        } else if (data.status === "failed") {
          setError("Scraping failed. Please try again.");
          setTimeout(() => setScrapeStatus(null), 5000);
        }
        return false;
      }
    } catch (err: any) {
      console.error("Error fetching scrape status:", err);
      setError(err.message);
      setIsPolling(false);
      return false;
    }
  }, [backendUrl, kbId]);

  // Set up polling when scraping starts
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const pollStatus = async () => {
      if (isPolling) {
        const shouldContinue = await fetchScrapeStatus();
        if (shouldContinue) {
          timeoutId = setTimeout(pollStatus, 2000); // Poll every 2 seconds
        }
      }
    };

    if (isPolling) {
      pollStatus();
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isPolling, fetchScrapeStatus]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!kbId || !url || !isValidUrl(url) || maxPages < 1) {
      setError('Please enter a valid URL (starting with http:// or https://) and set max pages to at least 1.');
      setSuccessMessage(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setScrapeStatus(null);

    try {
      const payload = {
        url: url,
        max_pages: maxPages,
      };

      const response = await fetch(`${backendUrl}/agents/${kbId}/scrape-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || responseData.detail || `Scraping request failed: status ${response.status}`);
      }

      const successData = responseData as ScrapeResponse;
      setSuccessMessage(successData.message || `Starting scrape for ${successData.submitted_url}`);
      setUrl('');
      setMaxPages(1);
      setIsPolling(true); // Start polling for status

    } catch (err: any) {
      setError(err.message || 'An unknown error occurred while submitting the URL.');
      console.error("URL Scrape error:", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [kbId, backendUrl, url, maxPages]);

  // Basic URL validation (can be improved)
  const isValidUrl = (urlString: string): boolean => {
    try {
      new URL(urlString);
      return urlString.startsWith('http://') || urlString.startsWith('https://');
    } catch (_) {
      return false;
    }
  };

  // Format the last update time
  const formatLastUpdate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium text-gray-900">Scrape URL into Knowledge Base</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* URL Input */}
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
            Website URL
          </label>
          <input
            type="url"
            id="url"
            name="url"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-50"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={isSubmitting || isPolling}
          />
          <p className="mt-1 text-xs text-gray-500">Enter the full URL (including http:// or https://) of the website to scrape.</p>
        </div>

        {/* Max Pages Input */}
        <div>
          <label htmlFor="max_pages" className="block text-sm font-medium text-gray-700 mb-1">
            Max Pages to Scrape
          </label>
          <input
            type="number"
            id="max_pages"
            name="max_pages"
            min="1"
            step="1"
            className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:bg-gray-50"
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value))}
            required
            disabled={isSubmitting || isPolling}
          />
          <p className="mt-1 text-xs text-gray-500">Maximum number of pages to crawl starting from the URL (must be at least 1).</p>
        </div>

        {/* Progress Display */}
        {scrapeStatus && scrapeStatus.status === "processing" && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Loader2 className="animate-spin h-4 w-4 text-blue-500 mr-2" />
                <span className="text-sm font-medium text-blue-700">
                  Scraping in progress...
                </span>
              </div>
              {scrapeStatus.last_update && (
                <span className="text-xs text-blue-600">
                  Last update: {formatLastUpdate(scrapeStatus.last_update)}
                </span>
              )}
            </div>
            
            {scrapeStatus.pages_scraped !== undefined && scrapeStatus.total_pages !== undefined && scrapeStatus.total_pages > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-blue-600">
                  <span>Pages processed: {scrapeStatus.pages_scraped} / {scrapeStatus.total_pages}</span>
                  <span>{Math.round((scrapeStatus.pages_scraped / scrapeStatus.total_pages) * 100)}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(scrapeStatus.pages_scraped / scrapeStatus.total_pages) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {scrapeStatus.progress && (
              <div className="text-sm text-blue-600">
                {scrapeStatus.progress.chars_added !== undefined && scrapeStatus.progress.chars_added !== null && (
                  <p>Characters added: {scrapeStatus.progress.chars_added.toLocaleString()}</p>
                )}
                {scrapeStatus.progress.profile_keys && scrapeStatus.progress.profile_keys.length > 0 && (
                  <p>Found profile data: {scrapeStatus.progress.profile_keys.join(", ")}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-start p-3 rounded-md border bg-red-50 border-red-300">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="flex items-center p-3 rounded-md border bg-green-50 border-green-300">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
            <p className="text-sm text-green-700">{successMessage}</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || isPolling || !url || !isValidUrl(url) || maxPages < 1}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                Starting Scrape...
              </>
            ) : (
              <>
                <Link2 className="-ml-1 mr-2 h-4 w-4" />
                Scrape URL
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UrlScraper; 