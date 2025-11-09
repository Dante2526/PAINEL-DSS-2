import React from 'react';
import { ZoomIcon } from './icons';

interface ZoomIndicatorProps {
  level: number;
  isVisible: boolean;
}

const ZoomIndicator: React.FC<ZoomIndicatorProps> = ({ level, isVisible }) => {
  return (
    <div className={`zoom-indicator ${isVisible ? 'visible' : ''}`} aria-live="polite" aria-atomic="true">
      <ZoomIcon className="w-5 h-5" />
      <span>{level}%</span>
    </div>
  );
};

export default ZoomIndicator;
