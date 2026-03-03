import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm mb-4 sm:mb-6 overflow-x-auto pb-2 sm:pb-0">
      <Home className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
      {items.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
          {item.path ? (
            <button className="text-blue-600 hover:text-blue-700 whitespace-nowrap">
              {item.label}
            </button>
          ) : (
            <span className="text-gray-600 whitespace-nowrap">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}