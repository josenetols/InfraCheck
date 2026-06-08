import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin } from 'lucide-react';
import { PREDEFINED_LOCATIONS } from '../utils/constants';

interface AutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const Autocomplete: React.FC<AutocompleteProps> = ({ label, value, onChange, placeholder }) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load custom locations from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('infracheck_custom_locations');
    if (saved) {
      try {
        setCustomLocations(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar locais salvos", e);
      }
    }
  }, []);

  // Filter logic
  useEffect(() => {
    if (!value) {
        setSuggestions([]);
        return;
    }
    
    // Combine lists, unique items only
    const predefinedNames = PREDEFINED_LOCATIONS.map(loc => typeof loc === 'string' ? loc : loc.name);
    const allLocations = Array.from(new Set([...predefinedNames, ...customLocations]));
    
    const filtered = allLocations.filter(loc => 
      loc.toLowerCase().includes(value.toLowerCase())
    );
    
    // Sort: Matches starting with value first, then alphabetical
    filtered.sort((a, b) => {
       const aStarts = a.toLowerCase().startsWith(value.toLowerCase());
       const bStarts = b.toLowerCase().startsWith(value.toLowerCase());
       if (aStarts && !bStarts) return -1;
       if (!aStarts && bStarts) return 1;
       return a.localeCompare(b);
    });

    setSuggestions(filtered);
  }, [value, customLocations]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setShowSuggestions(false);
  };

  const handleBlur = () => {
      // Save new location if it's not empty, not in list, and longer than 1 char
      if (value && value.trim().length > 1) {
          const trimmed = value.trim();
          const predefinedNames = PREDEFINED_LOCATIONS.map(loc => typeof loc === 'string' ? loc : loc.name);
          const allLocations = new Set([...predefinedNames, ...customLocations]);
          if (!allLocations.has(trimmed)) {
              const newCustom = [...customLocations, trimmed];
              setCustomLocations(newCustom);
              localStorage.setItem('infracheck_custom_locations', JSON.stringify(newCustom));
          }
      }
  };

  return (
    <div className="w-full relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type="text"
          className="w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border pl-10"
          value={value}
          onChange={(e) => {
              onChange(e.target.value);
              setShowSuggestions(true);
          }}
          onFocus={() => {
              if (value) setShowSuggestions(true);
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoComplete="off"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto mt-1 text-left">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 flex items-center gap-2 border-b border-slate-50 last:border-0"
              onMouseDown={() => handleSelect(suggestion)}
            >
              <MapPin size={14} className="text-slate-400 shrink-0" />
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};


