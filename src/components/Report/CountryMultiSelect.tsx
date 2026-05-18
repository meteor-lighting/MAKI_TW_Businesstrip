import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { Loader2, Globe, X, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CountryMultiSelectProps {
    value?: string[]; // Array of names
    onChange: (value: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    type?: 'city' | 'country'; // Optional prop to switch API
}

import { getAllCities, getAllCountries } from '../../services/api';

// Global cache to avoid refetching during the session
let cachedCities: { name: string; isTop?: boolean }[] | null = null;
let cachedCountries: { name: string; isTop?: boolean }[] | null = null;

const TOP_COUNTRIES = [
    'Taiwan', 'United States', 'China', 'Japan', 'South Korea', 'Vietnam', 'Thailand', 'Germany', 'United Kingdom', 'Taipei', 'Hsinchu'
];

export default function CountryMultiSelect({
    value = [],
    onChange,
    placeholder,
    disabled = false,
    className,
    type = 'city'
}: CountryMultiSelectProps) {
    const { t } = useTranslation();
    const [inputValue, setInputValue] = useState('');
    const initialCache = type === 'country' ? cachedCountries : cachedCities;
    const [allItems, setAllItems] = useState<{ name: string; isTop?: boolean }[]>(initialCache || []);
    const [suggestions, setSuggestions] = useState<{ name: string; isTop?: boolean }[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Fetch items on mount if not cached
    useEffect(() => {
        const cache = type === 'country' ? cachedCountries : cachedCities;
        if (cache && cache.length > 0) {
            setAllItems(cache);
            return;
        }

        let isMounted = true;
        setLoading(true);

        const fetcher = type === 'country' ? getAllCountries : getAllCities;

        fetcher()
            .then(res => {
                if (!isMounted) return;
                
                if (res.status === 'success' && Array.isArray(res.data)) {
                    const rawNames = res.data;
                    
                    // Deduplicate, assign top status
                    const topItems = TOP_COUNTRIES.filter(tc => rawNames.includes(tc)).map(name => ({ name, isTop: true }));
                    const otherItems = rawNames
                        .filter(name => !TOP_COUNTRIES.includes(name))
                        .sort((a, b) => a.localeCompare(b))
                        .map(name => ({ name, isTop: false }));
                    
                    const combined = [...topItems, ...otherItems];
                    if (type === 'country') cachedCountries = combined;
                    else cachedCities = combined;
                    setAllItems(combined);
                }
            })
            .catch(err => {
                console.error('Failed to fetch items:', err);
                // Fallback to top countries
                const fallback = TOP_COUNTRIES.map(name => ({ name, isTop: true }));
                if (type === 'country') cachedCountries = fallback;
                else cachedCities = fallback;
                if (isMounted) setAllItems(fallback);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, []);

    // Filter logic
    useEffect(() => {
        if (!isOpen) return;
        
        let available = allItems.filter(c => !value.includes(c.name));

        if (inputValue.trim()) {
            const query = inputValue.toLowerCase();
            available = available.filter(c => c.name.toLowerCase().includes(query));
        }

        setSuggestions(available.slice(0, 50)); // cap at 50 to prevent DOM lag
    }, [inputValue, isOpen, allItems, value]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setInputValue('');
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (name: string) => {
        onChange([...value, name]);
        setInputValue('');
        setIsOpen(true); // keep open for multiple selections
        inputRef.current?.focus();
    };

    const handleRemove = (nameToRemove: string, e: React.MouseEvent) => {
        e.stopPropagation(); // prevent opening dropdown
        onChange(value.filter(n => n !== nameToRemove));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
            const newValue = [...value];
            newValue.pop();
            onChange(newValue);
        }
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div 
                className={clsx(
                    "flex flex-wrap items-center gap-1.5 p-1 border border-gray-300 rounded bg-white min-h-[34px] focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500",
                    disabled ? "bg-gray-100 cursor-not-allowed" : "cursor-text",
                    className
                )}
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(true);
                        inputRef.current?.focus();
                    }
                }}
            >
                {/* Selected Pills */}
                {value.map((countryName) => (
                    <div 
                        key={countryName} 
                        className="flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded"
                    >
                        <span>{countryName}</span>
                        {!disabled && (
                            <button
                                type="button"
                                onClick={(e) => handleRemove(countryName, e)}
                                className="text-blue-600 hover:text-blue-900 rounded-full hover:bg-blue-200 p-0.5 focus:outline-none"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                ))}

                {/* Input Field */}
                {!disabled && (
                    <div className="relative flex-1 min-w-[120px]">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onFocus={() => setIsOpen(true)}
                            onKeyDown={handleKeyDown}
                            placeholder={value.length === 0 ? (placeholder || t('search_country', 'Search Country...')) : ''}
                            className="w-full bg-transparent outline-none text-sm p-1"
                            autoComplete="off"
                        />
                        {loading && (
                            <div className="absolute right-1 top-1/2 transform -translate-y-1/2">
                                <Loader2 className="animate-spin text-gray-400" size={14} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Dropdown Options */}
            {isOpen && suggestions.length > 0 && !disabled && (
                <div className="absolute top-full left-0 z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg max-h-60 overflow-auto">
                    {/* Render top countries separator if there are top items in suggestions */}
                    {suggestions.map((country, index) => {
                        const isFirstOfRegular = !country.isTop && (index === 0 || suggestions[index - 1].isTop);
                        return (
                            <React.Fragment key={country.name}>
                                {isFirstOfRegular && index !== 0 && (
                                    <div className="h-px bg-slate-600 mx-2 my-1" />
                                )}
                                <div
                                    className="px-4 py-2 hover:bg-slate-700 cursor-pointer text-white flex items-center gap-2"
                                    onMouseDown={(e) => {
                                        // use onMouseDown instead of onClick to prevent onBlur of input before select fires
                                        e.preventDefault(); 
                                        handleSelect(country.name);
                                    }}
                                >
                                    <span className={clsx(country.isTop ? "text-amber-400" : "text-slate-400")}>
                                        {country.isTop ? <MapPin size={14} /> : <Globe size={14} />}
                                    </span>
                                    <span className="text-sm">{country.name}</span>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            )}
            
            {isOpen && !loading && inputValue.trim() && suggestions.length === 0 && !disabled && (
                <div className="absolute top-full left-0 z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg p-3 text-center text-slate-400 text-sm">
                    No matching countries found
                </div>
            )}
        </div>
    );
}
