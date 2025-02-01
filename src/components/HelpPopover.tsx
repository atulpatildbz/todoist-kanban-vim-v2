import React from 'react';

interface HelpPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpPopover: React.FC<HelpPopoverProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-800 text-gray-200 p-6 rounded-lg shadow-lg max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">Navigation</h3>
            <ul className="space-y-2">
              <li><kbd className="px-2 py-1 bg-gray-700 rounded">h</kbd> Move task left</li>
              <li><kbd className="px-2 py-1 bg-gray-700 rounded">l</kbd> Move task right</li>
              <li><kbd className="px-2 py-1 bg-gray-700 rounded">gd</kbd> View subtasks</li>
              <li><kbd className="px-2 py-1 bg-gray-700 rounded">Esc</kbd> Go back to parent</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Actions</h3>
            <ul className="space-y-2">
              <li><kbd className="px-2 py-1 bg-gray-700 rounded">o</kbd> Create task</li>
              <li><kbd className="px-2 py-1 bg-gray-700 rounded">d</kbd> Delete task</li>
              <li><kbd className="px-2 py-1 bg-gray-700 rounded">c</kbd> Complete task</li>
              <li><kbd className="px-2 py-1 bg-gray-700 rounded">gf</kbd> Open filters</li>
            </ul>
          </div>
          <div className="col-span-2">
            <h3 className="font-semibold mb-2">Search</h3>
            <ul className="space-y-2">
              <li><kbd className="px-2 py-1 bg-gray-700 rounded">/</kbd> Start search</li>
              <li><kbd className="px-2 py-1 bg-gray-700 rounded">n</kbd> Next match</li>
              <li><kbd className="px-2 py-1 bg-gray-700 rounded">N</kbd> Previous match</li>
              <li><kbd className="px-2 py-1 bg-gray-700 rounded">Enter</kbd> Lock search</li>
              <li><kbd className="px-2 py-1 bg-gray-700 rounded">Esc</kbd> Clear search</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-400">
          Press <kbd className="px-2 py-1 bg-gray-700 rounded">?</kbd> to toggle this help menu
        </div>
      </div>
    </div>
  );
}; 