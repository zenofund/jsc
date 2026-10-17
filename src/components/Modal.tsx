import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-2xl',
    lg: 'sm:max-w-4xl',
    xl: 'sm:max-w-6xl',
    full: 'sm:max-w-full sm:mx-4',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden sm:overflow-y-auto">
      <div className="flex min-h-dvh items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className={`relative flex max-h-[94dvh] w-full flex-col rounded-t-3xl bg-dialog text-dialog-foreground pb-[env(safe-area-inset-bottom)] sm:max-h-[90vh] sm:rounded-lg sm:pb-0 ${sizeClasses[size]}`}>
          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
            <h3 className="truncate pr-2 text-base font-semibold text-dialog-foreground sm:text-lg">{title}</h3>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 hover:bg-accent rounded-lg flex-shrink-0 transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="min-h-0 flex-auto overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex-shrink-0 bg-muted/30 px-4 py-3 sm:rounded-b-lg sm:px-6 sm:py-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
