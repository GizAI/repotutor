'use client';

import React, { useState, ReactNode } from 'react';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  children: ReactNode;
  content?: string | ReactNode;
  position?: TooltipPosition;
  className?: string;
  delay?: number;
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  className = '',
  delay = 500
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case 'top':
        return 'top-full left-1/2 transform -translate-x-1/2';
      case 'bottom':
        return 'bottom-full left-1/2 transform -translate-x-1/2';
      case 'left':
        return 'left-full top-1/2 transform -translate-y-1/2';
      case 'right':
        return 'right-full top-1/2 transform -translate-y-1/2';
      default:
        return 'top-full left-1/2 transform -translate-x-1/2';
    }
  };

  const getArrowBorder = () => {
    const borderWidth = '4px';
    const borderColor = 'var(--bg-tertiary)';

    switch (position) {
      case 'top':
        return { borderTop: `${borderWidth} solid ${borderColor}`, borderLeft: `${borderWidth} solid transparent`, borderRight: `${borderWidth} solid transparent` };
      case 'bottom':
        return { borderBottom: `${borderWidth} solid ${borderColor}`, borderLeft: `${borderWidth} solid transparent`, borderRight: `${borderWidth} solid transparent` };
      case 'left':
        return { borderLeft: `${borderWidth} solid ${borderColor}`, borderTop: `${borderWidth} solid transparent`, borderBottom: `${borderWidth} solid transparent` };
      case 'right':
        return { borderRight: `${borderWidth} solid ${borderColor}`, borderTop: `${borderWidth} solid transparent`, borderBottom: `${borderWidth} solid transparent` };
      default:
        return { borderTop: `${borderWidth} solid ${borderColor}`, borderLeft: `${borderWidth} solid transparent`, borderRight: `${borderWidth} solid transparent` };
    }
  };

  if (!content) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {isVisible && (
        <div
          className={`absolute z-50 px-2 py-1 text-xs font-medium rounded shadow-lg whitespace-nowrap pointer-events-none transition-opacity duration-200 ${getPositionClasses()} ${className}`}
          style={{
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            opacity: 1,
          }}
        >
          {content}

          <div
            className={`absolute w-0 h-0 ${getArrowClasses()}`}
            style={getArrowBorder()}
          />
        </div>
      )}
    </div>
  );
};

export default Tooltip;
