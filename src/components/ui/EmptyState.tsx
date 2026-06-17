import React from 'react';
import { Database } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'لا توجد بيانات',
  description = 'لا توجد عناصر متاحة للعرض في الوقت الحالي.',
  icon: Icon = Database,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-dashed border-slate-200 rounded-xl max-w-md mx-auto gap-3">
      <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center">
        <Icon size={28} />
      </div>
      <h3 className="text-base font-bold text-slate-800 mt-2">{title}</h3>
      <p className="text-xs text-slate-500 max-w-xs leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
