import React, { useState, useEffect, useRef } from 'react';
import { sendRequest } from '../../services/api';
import clsx from 'clsx';
import { MapPin, Loader2 } from 'lucide-react';

interface CityAutocompleteProps {
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    onBlur?: () => void;
}

// Simple debounce hook if not exists
function useDebounceValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export default function CityAutocomplete({
    value = '',
    onChange,
    placeholder,
    disabled = false,
    className,
    onBlur
}: CityAutocompleteProps) {
    const [inputValue, setInputValue] = useState(value);
    const [suggestions, setSuggestions] = useState<{ name: string }[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Sync internal state with prop value if it changes externally
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    const debouncedQuery = useDebounceValue(inputValue, 300);

    useEffect(() => {
        // Only search if user is typing and dropdown should be open
        // If query matches exactly one suggestion or empty, maybe don't search?
        // Actually, always search if query length > 1
        if (debouncedQuery.length > 1 && isOpen) {
            setLoading(true);
            sendRequest('searchCity', { query: debouncedQuery })
                .then(res => {
                    if (res.status === 'success' && res.data) {
                        setSuggestions(res.data);
                    } else {
                        setSuggestions([]);
                    }
                })
                .catch(err => {
                    console.error(err);
                    setSuggestions([]);
                })
                .finally(() => setLoading(false));
        } else {
            setSuggestions([]);
        }
    }, [debouncedQuery, isOpen]);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        onChange(val);
        setIsOpen(true);
    };

    const handleSelect = (name: string) => {
        setInputValue(name);
        onChange(name);
        setIsOpen(false);
        setSuggestions([]);
    };

    const handleFocus = () => {
        // Option: Search immediately on focus? Or just open if there is text?
        if (inputValue.length > 0) setIsOpen(true);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={onBlur} // pass onBlur for react-hook-form touch
                    disabled={disabled}
                    placeholder={placeholder}
                    className={clsx(
                        "mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100",
                        className
                    )}
                    autoComplete="off" // Disable browser default autocomplete
                />
                {loading && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="animate-spin text-gray-400" size={16} />
                    </div>
                )}
            </div>

            {isOpen && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg max-h-60 overflow-auto">
                    {suggestions.map((city, index) => (
                        <div
                            key={index}
                            className="px-4 py-2 hover:bg-slate-700 cursor-pointer text-white flex items-center gap-2"
                            onClick={() => handleSelect(city.name)}
                        >
                            <span className="text-slate-400"><MapPin size={14} /></span>
                            <span>{city.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
