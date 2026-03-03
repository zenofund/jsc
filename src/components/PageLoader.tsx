import React from 'react';
import { Skeleton } from './ui/skeleton';

interface PageSkeletonProps {
  /**
   * Type of content to simulate loading for.
   * 'table': A data table with headers and rows
   * 'grid': A grid of cards (e.g., dashboard stats or items)
   * 'detail': A form-like or detail view structure
   * Default is 'table'.
   */
  mode?: 'table' | 'grid' | 'detail';
}

export function PageSkeleton({ mode = 'table' }: PageSkeletonProps) {
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500">
      {/* Breadcrumb Area */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Controls Area (Tabs/Search/Filters) */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between pt-4">
        <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-64" />
      </div>

      {/* Main Content Area */}
      <div className="pt-2">
        {mode === 'table' && <TableSkeleton />}
        {mode === 'grid' && <GridSkeleton />}
        {mode === 'detail' && <DetailSkeleton />}
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="rounded-md border border-border bg-card">
      {/* Header Row */}
      <div className="border-b border-border p-4 bg-muted/40">
        <div className="flex gap-4">
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-6 w-1/4" />
        </div>
      </div>
      
      {/* Body Rows */}
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 flex gap-4 items-center">
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-5 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2 w-full">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="pt-4 space-y-2">
             <Skeleton className="h-4 w-full" />
             <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
    return (
        <div className="rounded-lg border border-border bg-card p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-24 w-full" />
            </div>
        </div>
    )
}
