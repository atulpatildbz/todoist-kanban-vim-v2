import React from 'react';

export const LoadingIndicator: React.FC = () => {
  return (
    <div className="fixed top-4 right-4 bg-gray-800 text-gray-200 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span>Syncing...</span>
    </div>
  );
}; 