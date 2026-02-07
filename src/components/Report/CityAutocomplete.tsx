import React, { useState, useEffect, useRef } from 'react';
import { sendRequest } from '../../services/api';
import clsx from 'clsx';
import { MapPin, Loader2, History } from 'lucide-react';

interface CityAutocompleteProps {
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    onBlur?: () => void;
}

// Popular cities fallback in case backend is empty or for default suggestions
const POPULAR_CITIES = [
    'Taipei', 'New Taipei City', 'Taoyuan', 'Taichung', 'Tainan', 'Kaohsiung', 'Hsinchu',
    'Hong Kong', 'Macau',
    'Tokyo', 'Osaka', 'Kyoto', 'Seoul', 'Busan',
    'Shanghai', 'Beijing', 'Shenzhen', 'Guangzhou',
    'Singapore', 'Bangkok', 'Ho Chi Minh City', 'Hanoi',
    'Manila', 'Jakarta', 'Kuala Lumpur',
    'New York', 'Los Angeles', 'San Francisco', 'Seattle', 'Chicago',
    'London', 'Paris', 'Berlin', 'Munich', 'Frankfurt', 'Amsterdam',
    'Sydney', 'Melbourne'
].sort();

// Simple debounce hook
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
    const [suggestions, setSuggestions] = useState<{ name: string; isHistory?: boolean }[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [history, setHistory] = useState<string[]>([]);

    // Load history from local storage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('city_history');
            if (saved) {
                setHistory(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to load history', e);
        }
    }, []);

    // Sync internal state with prop value
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    const debouncedQuery = useDebounceValue(inputValue, 300);

    // Get default suggestions (History + Popular)
    const getDefaultSuggestions = () => {
        const historyItems = history.map(name => ({ name, isHistory: true }));
        const popularItems = POPULAR_CITIES
            .filter(city => !history.includes(city)) // Deduplicate
            .slice(0, 10 - historyItems.length)
            .map(name => ({ name, isHistory: false }));
        return [...historyItems, ...popularItems];
    };

    useEffect(() => {
        if (!isOpen) return;

        // If input is empty, show defaults
        if (debouncedQuery.trim().length === 0) {
            setSuggestions(getDefaultSuggestions());
            return;
        }

        // Search logic
        setLoading(true);

        // 1. Backend Search
        sendRequest('searchCity', { query: debouncedQuery })
            .then(res => {
                let backendResults: { name: string }[] = [];
                if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
                    backendResults = res.data;
                }

                // 2. Client-side Fallback Filter (if backend Empty or few results)
                const clientMatches = POPULAR_CITIES.filter(city =>
                    city.toLowerCase().includes(debouncedQuery.toLowerCase())
                ).map(name => ({ name }));

                // Merge: Backend first, then client matches (deduplicated)
                const combined = [...backendResults];
                clientMatches.forEach(match => {
                    if (!combined.some(item => item.name === match.name)) {
                        combined.push(match);
                    }
                });

                setSuggestions(combined.slice(0, 10)); // Limit to 10
            })
            .catch(err => {
                console.error(err);
                // Fallback to client filter on error
                const clientMatches = POPULAR_CITIES.filter(city =>
                    city.toLowerCase().includes(debouncedQuery.toLowerCase())
                ).map(name => ({ name }));
                setSuggestions(clientMatches.slice(0, 10));
            })
            .finally(() => setLoading(false));

    }, [debouncedQuery, isOpen, history]); // Depend on history to update defaults if history changes

    // Close on click outside
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

        // Update History
        const newHistory = [name, ...history.filter(h => h !== name)].slice(0, 5); // Keep top 5
        setHistory(newHistory);
        localStorage.setItem('city_history', JSON.stringify(newHistory));
    };

    // Show suggestions on focus
    const handleFocus = () => {
        setIsOpen(true);
        if (inputValue.trim().length === 0) {
            setSuggestions(getDefaultSuggestions());
        }
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={onBlur}
                    disabled={disabled}
                    placeholder={placeholder || "Select or type a city..."}
                    className={clsx(
                        "mt-1 block w-full rounded border-gray-300 shadow-sm p-2 disabled:bg-gray-100",
                        className
                    )}
                    autoComplete="off"
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
                            key={`${city.name}-${index}`}
                            className="px-4 py-2 hover:bg-slate-700 cursor-pointer text-white flex items-center gap-2"
                            onClick={() => handleSelect(city.name)}
                        >
                            <span className="text-slate-400">
                                {city.isHistory ? <History size={14} /> : <MapPin size={14} />}
                            </span>
                            <span>{city.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
