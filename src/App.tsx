import React, { useDeferredValue, useState } from 'react';
import './App.css';
import BookmarkGraph from './components/BookmarkGraph';
import Search from './components/Search';

const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // 검색어 타이핑 반응 속도를 무력화하지 않도록 무거운 그래프 연산용 값을 비동기 지연 값으로 래핑
  const deferredQuery = useDeferredValue(searchQuery);

  return (
    <main className="app-shell">
      <div className="app-glow" />
      <header className="app-header">
        <h1 className="app-title">Graphview Dashboard</h1>
      </header>
      <div className="app-search">
        {/* 입력 제어권을 가진 컴포넌트 */}
        <Search onSearchChange={setSearchQuery} />
      </div>
      <div className="app-content animate-fade-in-up">
        <div className="app-graph-frame">
          {/* 지연된 검색 쿼리를 전달받아 무거운 렌더링 블로킹 방지 */}
          <BookmarkGraph searchQuery={deferredQuery} />
        </div>
      </div>
    </main>
  );
};

export default App;