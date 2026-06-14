import { Search as SearchIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import './Search.css';

const Search: React.FC = () => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedQuery = query.trim();
        if (!trimmedQuery) return;
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(trimmedQuery)}`;
    };

    return (
        <form className="search-container" onSubmit={handleSubmit}>
            <input
                ref={inputRef}
                type="text"
                className="search-input"
                placeholder="Search the web..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <SearchIcon className="search-icon" size={18} />
        </form>
    );
};

export default Search;