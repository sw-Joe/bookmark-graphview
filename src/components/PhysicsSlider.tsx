import React from 'react';

interface PhysicsSliderProps {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
}

export const PhysicsSlider: React.FC<PhysicsSliderProps> = React.memo(({
    label,
    min,
    max,
    step,
    value,
    onChange
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(Number(e.target.value));
    };

    return (
        <div className="control-group" style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>
                {label}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={handleChange}
                    style={{ flex: 1, cursor: 'pointer' }}
                />
                <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={handleChange}
                    style={{                      
                        width: '65px',
                        background: '#222',
                        border: '1px solid #444',
                        color: '#fff',
                        textAlign: 'center',
                        borderRadius: '4px',
                        fontSize: '13px',
                        padding: '4px 0'
                    }}
                />
            </div>
        </div>
    );
});

PhysicsSlider.displayName = 'PhysicsSlider';
export default PhysicsSlider;