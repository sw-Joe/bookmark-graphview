import { Search as SearchIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import './Search.css';

interface SearchProps {
    onSearchChange: (query: string) => void;
}

const Search: React.FC<SearchProps> = React.memo(({ onSearchChange }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        onSearchChange(val);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedQuery = query.trim();
        if (!trimmedQuery) return;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(trimmedQuery)}`, '_blank', 'noopener,noreferrer');
    };

    return (
        <form className="search-container" onSubmit={handleSubmit}>
            <input
                ref={inputRef}
                type="text"
                className="search-input"
                placeholder="Search bookmarks or the web..."
                value={query}
                onChange={handleChange}
            />
            <SearchIcon className="search-icon" size={18} />
        </form>
    );
});

Search.displayName = 'Search';
export default Search;