import React, { useDeferredValue, useState } from 'react';
import './App.css';
import BookmarkGraph from './components/BookmarkGraph';
import PhysicsSlider from './components/PhysicsSlider';
import Search from './components/Search';

export interface PhysicsConfig {
  chargeStrength: number;
  linkDistance: number;
  linkStrength: number;
}

const INITIAL_PHYSICS_CONFIG: PhysicsConfig = {
  chargeStrength: -150,
  linkDistance: 40,
  linkStrength: 0.3
};

const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredQuery = useDeferredValue(searchQuery);

  const [physics, setPhysics] = useState<PhysicsConfig>({ ...INITIAL_PHYSICS_CONFIG });

  const handleConfigChange = (key: keyof PhysicsConfig, value: number) => {
    setPhysics(prev => ({ ...prev, [key]: value }));
  };

  const handleResetToDefault = () => {
    setPhysics({ ...INITIAL_PHYSICS_CONFIG });
  };

  return (
    <main className="app-shell">
      <div className="app-glow" />
      <header className="app-header">
        <h1 className="app-title">Graphview Dashboard</h1>
      </header>
      
      <div className="app-search">
        <Search onSearchChange={setSearchQuery} />
      </div>

      <div className="app-main-layout animate-fade-in-up">
        {/* 리팩토링된 클래스 기반 사이드바 */}
        <section className="physics-control-panel">
          <div>
            <h2 className="physics-panel-title">Physics Dashboard</h2>
            
            <div className="sliders-group-container">
              <PhysicsSlider
                label="노드간 반발력 (척력)"
                min={-1000}
                max={-10}
                step={10}
                value={physics.chargeStrength}
                onChange={(val) => handleConfigChange('chargeStrength', val)}
              />

              <PhysicsSlider
                label="연결선 목표 거리"
                min={10}
                max={200}
                step={5}
                value={physics.linkDistance}
                onChange={(val) => handleConfigChange('linkDistance', val)}
              />

              <PhysicsSlider
                label="연결선 장력 강도"
                min={0.05}
                max={1}
                step={0.05}
                value={physics.linkStrength}
                onChange={(val) => handleConfigChange('linkStrength', val)}
              />
            </div>
          </div>

          <button 
            type="button"
            className="reset-action-btn"
            onClick={handleResetToDefault}
            style={{
              width: '100%',
              padding: '10px',
              background: '#c92a2a',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px',
              transition: 'background 0.2s',
              marginTop: '10px'
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#e03131')}
            onMouseOut={(e) => (e.currentTarget.style.background = '#c92a2a')}
          >
            Reset to Default
          </button>
        </section>

        {/* 리팩토링된 클래스 기반 그래프 프레임 */}
        <div className="app-graph-frame">
          <BookmarkGraph searchQuery={deferredQuery} physicsConfig={physics} />
        </div>
      </div>
    </main>
  );
};

export default App;