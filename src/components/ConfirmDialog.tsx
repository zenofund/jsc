import React from 'react';
import { X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-[1px] transition-opacity" 
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-sm mx-4 overflow-hidden bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-gray-100 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
        {/* Header - Only show if title exists */}
        {title && (
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h3>
          </div>
        )}

        {/* Body */}
        <div className={`px-5 ${title ? 'py-2' : 'pt-6 pb-4'}`}>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex justify-end gap-3 bg-gray-50/50 dark:bg-slate-800/50">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-slate-500 shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 dark:focus:ring-offset-slate-800"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
