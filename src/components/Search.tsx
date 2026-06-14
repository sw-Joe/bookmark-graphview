import { Search as SearchIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import './Search.css';

interface SearchProps {
    onSearchChange: (query: string) => void;
}

// [교보재 최적화] React.memo 적용을 통해 App의 리렌더링으로부터 컴포넌트 보호
const Search: React.FC<SearchProps> = React.memo(({ onSearchChange }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        onSearchChange(val); // 실시간으로 부모에게 상태 전파
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

// React.memo 디버깅용 네임 명시
Search.displayName = 'Search';

export default Search;