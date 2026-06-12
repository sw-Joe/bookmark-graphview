import React from 'react';
import './App.css';
import BookmarkGraph from './components/BookmarkGraph';
import Search from './components/Search';

const App: React.FC = () => {
  return (
    <main className="app-shell">
      <div className="app-glow" />
      <header className="app-header">
        <h1 className="app-title">Graphview Dashboard</h1>
      </header>
      <div className="app-search">
        <Search />
      </div>
      <div className="app-content animate-fade-in-up">
        <div className="app-graph-frame">
          <BookmarkGraph />
        </div>
      </div>
    </main>
  );
};

export default App;
