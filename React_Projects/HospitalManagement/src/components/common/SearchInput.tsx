import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { cn } from '@/utils/cn';

/** Imperative API exposed with useImperativeHandle: parents can focus/clear the box without owning its state. */
export interface SearchInputHandle {
  focus: () => void;
  clear: () => void;
}

interface Props {
  value?: string;
  onSearch: (q: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
  'aria-label'?: string;
}

/**
 * Debounced search box (forwardRef + useImperativeHandle). The input is locally controlled for instant typing,
 * `onSearch` fires only after the user pauses (debouncing), and "/" focuses the box (ref usage).
 */
export const SearchInput = forwardRef<SearchInputHandle, Props>(function SearchInput({ value = '', onSearch, placeholder = 'Search…', delay = 350, className, ...rest }, ref) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebouncedValue(text, delay);
  const first = useRef(true);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus(), clear: () => setText('') }), []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onSearch(debounced.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={cn('relative w-full max-w-sm', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={rest['aria-label'] ?? placeholder}
        className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-8 text-sm text-fg placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button type="button" aria-label="Clear search" onClick={() => setText('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-fg">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});
