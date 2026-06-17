import React from 'react';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  fullPage?: boolean;
}

export const Loader: React.FC<LoaderProps> = ({
  size = 'md',
  label = 'جاري التحميل...',
  fullPage = false,
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-14 h-14 border-4',
  };

  const loaderContent = (
    <div className="flex flex-col items-center justify-center p-8 gap-3">
      <div className={`border-slate-100 border-t-blue-600 rounded-full animate-spin ${sizeClasses[size]}`}></div>
      {label && <p className="text-sm text-slate-500 font-semibold">{label}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-slate-50/80 backdrop-blur-xs flex items-center justify-center z-50">
        {loaderContent}
      </div>
    );
  }

  return loaderContent;
};

export default Loader;
