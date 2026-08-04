import React from 'react';
import Card from '../../../components/ui/Card';

export const TransferTableSkeleton: React.FC = () => {
  return (
    <Card className="border-slate-200/60 p-6 shadow-xs font-arabic">
      <div className="space-y-4 animate-pulse">
        {/* Table Header Skeleton */}
        <div className="h-10 bg-slate-100 rounded-xl w-full"></div>
        {/* Table Rows Skeleton */}
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl">
            <div className="h-4 bg-slate-200 rounded w-16"></div>
            <div className="h-4 bg-slate-200 rounded w-28"></div>
            <div className="h-4 bg-slate-200 rounded w-36"></div>
            <div className="h-4 bg-slate-200 rounded w-36"></div>
            <div className="h-4 bg-slate-200 rounded w-20"></div>
            <div className="h-6 bg-slate-200 rounded-full w-24"></div>
            <div className="h-8 bg-slate-200 rounded-lg w-24"></div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export const TransferDetailsSkeleton: React.FC = () => {
  return (
    <div className="space-y-5 animate-pulse p-4 font-arabic">
      <div className="h-16 bg-slate-100 rounded-xl w-full"></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 bg-slate-50 rounded-xl"></div>
        <div className="h-24 bg-slate-50 rounded-xl"></div>
      </div>
      <div className="h-48 bg-slate-100 rounded-xl w-full"></div>
    </div>
  );
};
