import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchAddressSuggestions,
  type AddressSuggestResponse,
} from "@/lib/api/properties";
import type { PropertyDetailDto } from "@shared/comparables/types";
import { cn } from "@/lib/utils";

interface AddressSuggestInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function AddressSuggestInput({
  id: idProp,
  value,
  onChange,
  disabled,
  placeholder = "e.g. 507 Hammack Dr, Austin",
}: AddressSuggestInputProps) {
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const listboxId = `${inputId}-suggestions`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PropertyDetailDto[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      fetchAddressSuggestions(trimmed, { limit: 8, signal: controller.signal })
        .then((data: AddressSuggestResponse) => {
          setSuggestions(data.suggestions);
          setOpen(data.suggestions.length > 0);
          setActiveIndex(-1);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setSuggestions([]);
          setOpen(false);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [value]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function selectSuggestion(suggestion: PropertyDetailDto) {
    onChange(suggestion.address);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]!);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const showDropdown = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative space-y-2">
      <Label htmlFor={inputId}>Address</Label>
      <Input
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="font-mono text-sm"
        disabled={disabled}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={showDropdown ? listboxId : undefined}
        aria-autocomplete="list"
        autoComplete="off"
      />

      {loading && value.trim().length >= 2 && (
        <p className="text-xs text-muted-foreground">Searching addresses…</p>
      )}

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 top-full mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-border bg-card shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.listingKey}
              role="option"
              aria-selected={index === activeIndex}
            >
              <button
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2.5 text-sm font-mono transition-colors",
                  index === activeIndex
                    ? "bg-amber-400/15 text-foreground"
                    : "hover:bg-secondary/60 text-foreground",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="block truncate">{suggestion.address}</span>
                {suggestion.bedrooms != null && suggestion.bathrooms != null && (
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    {suggestion.bedrooms} bed / {suggestion.bathrooms} bath
                    {suggestion.livingAreaSqft != null &&
                      ` · ${suggestion.livingAreaSqft.toLocaleString()} sqft`}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
