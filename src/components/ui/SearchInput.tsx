import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'بحث...',
  className = '',
  ...props
}) => {
  return (
    <div className={`relative flex items-center w-full max-w-xs ${className}`}>
      <Search size={18} className="absolute right-3 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pr-10 pl-8 py-2 bg-white border border-slate-200 text-sm rounded-lg placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-150"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            if (onClear) onClear();
          }}
          className="absolute left-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          aria-label="مسح البحث"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default SearchInput;
