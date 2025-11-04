import React from 'react';

interface DarkModeToggleProps {
  isDarkMode: boolean;
  onToggle: () => void;
}

const DarkModeToggle: React.FC<DarkModeToggleProps> = ({ isDarkMode, onToggle }) => {
  return (
    <label className="bb8-toggle" htmlFor="darkModeToggle" aria-label="Alternar modo escuro">
        <input 
            className="bb8-toggle__checkbox" 
            type="checkbox" 
            id="darkModeToggle"
            checked={isDarkMode}
            onChange={onToggle}
        />
        <div className="bb8-toggle__container">
            <div className="bb8-toggle__scenery">
                <div className="bb8-toggle__star"></div>
                <div className="bb8-toggle__star"></div>
                <div className="bb8-toggle__star"></div>
                <div className="bb8-toggle__star"></div>
                <div className="bb8-toggle__star"></div>
                <div className="bb8-toggle__star"></div>
                <div className="bb8-toggle__star"></div>
                <div className="tatto-1" aria-hidden="true"></div>
                <div className="tatto-2" aria-hidden="true"></div>
                <div className="gomrassen"></div>
                <div className="hermes"></div>
                <div className="chenini"></div>
                <div className="bb8-toggle__cloud"></div>
                <div className="bb8-toggle__cloud"></div>
                <div className="bb8-toggle__cloud"></div>
            </div>
            <div className="bb8">
                <div className="bb8__head-container">
                    <div className="bb8__antenna"></div>
                    <div className="bb8__antenna"></div>
                    <div className="bb8__head"></div>
                </div>
                <div className="bb8__body"></div>
            </div>
            <div className="artificial__hidden" aria-hidden="true">
                <div className="bb8__shadow"></div>
            </div>
        </div>
    </label>
  );
};

export default DarkModeToggle;