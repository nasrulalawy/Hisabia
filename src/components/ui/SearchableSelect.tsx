import { useState, useRef, useEffect } from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  id?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  emptyLabel = "— Tanpa —",
  className = "",
  id,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected ? selected.label : value ? "" : emptyLabel;

  const filtered =
    query.trim() === ""
      ? options
      : options.filter((o) =>
          o.label.toLowerCase().includes(query.trim().toLowerCase())
        );

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id ? `${id}-listbox` : undefined}
        id={id}
        onClick={() => !open && setOpen(true)}
        className="flex h-10 w-full cursor-pointer items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-left text-sm text-[var(--foreground)] focus-within:ring-2 focus-within:ring-[var(--primary)]"
      >
        {open ? (
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                setOpen(false);
                return;
              }
              if (e.key === "Enter" && filtered[0]) {
                onChange(filtered[0].value);
                setOpen(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent focus:outline-none"
          />
        ) : (
          <>
            <span className={selected ? "" : "text-[var(--muted-foreground)]"}>
              {displayLabel || placeholder}
            </span>
            <svg className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </div>
      {open && (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--background)] py-1 shadow-lg"
        >
          <li
            role="option"
            aria-selected={value === ""}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="cursor-pointer px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          >
            {emptyLabel}
          </li>
          {filtered.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={value === opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`cursor-pointer px-3 py-2 text-sm hover:bg-[var(--muted)] ${
                value === opt.value ? "bg-[var(--primary)]/10 font-medium text-[var(--primary)]" : "text-[var(--foreground)]"
              }`}
            >
              {opt.label}
            </li>
          ))}
          {filtered.length === 0 && query.trim() && (
            <li className="px-3 py-2 text-sm text-[var(--muted-foreground)]">Tidak ada hasil</li>
          )}
        </ul>
      )}
    </div>
  );
}
