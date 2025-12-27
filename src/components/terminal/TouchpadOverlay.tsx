'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface TouchpadOverlayProps {
  enabled: boolean;
  canvasWidth: number;
  canvasHeight: number;
  onMove: (x: number, y: number) => void;
  onClick: (x: number, y: number, button: number) => void;
  onDragStart?: (x: number, y: number) => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd?: (x: number, y: number) => void;
  sensitivity?: number;  // Movement multiplier (default: 1.5)
  showHint?: boolean;  // Whether to show the bottom hint (default: false)
}

// Constants for gesture detection
const LONG_TAP_DURATION = 500;  // ms for long tap (right-click)
const DOUBLE_TAP_INTERVAL = 300;  // ms between taps for double-tap
const TAP_MOVE_THRESHOLD = 10;  // pixels - max movement to still count as tap

export function TouchpadOverlay({
  enabled,
  canvasWidth,
  canvasHeight,
  onMove,
  onClick,
  onDragStart,
  onDragMove,
  onDragEnd,
  sensitivity = 1.5,
  showHint = false,
}: TouchpadOverlayProps) {
  // Measure actual overlay size
  const overlayRef = useRef<HTMLDivElement>(null);
  const [overlaySize, setOverlaySize] = useState({ width: canvasWidth, height: canvasHeight });

  // Track overlay size - runs when enabled changes or overlay mounts
  useEffect(() => {
    if (!enabled) return;

    const overlay = overlayRef.current;
    if (!overlay) return;

    const updateSize = () => {
      const rect = overlay.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setOverlaySize({ width: rect.width, height: rect.height });
      }
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(overlay);

    // Wait for layout then measure
    requestAnimationFrame(updateSize);

    return () => observer.disconnect();
  }, [enabled]);

  // Use overlay size for bounds, fallback to props
  const boundsWidth = overlaySize.width || canvasWidth;
  const boundsHeight = overlaySize.height || canvasHeight;

  // Virtual cursor position
  const [cursorX, setCursorX] = useState(boundsWidth / 2);
  const [cursorY, setCursorY] = useState(boundsHeight / 2);
  const cursorRef = useRef({ x: boundsWidth / 2, y: boundsHeight / 2 });

  // Touch tracking
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasMoved = useRef(false);

  // Long tap detection
  const longTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isLongTapActive, setIsLongTapActive] = useState(false);

  // Double tap + drag detection
  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartCursorRef = useRef<{ x: number; y: number } | null>(null);

  // Keep cursor ref in sync
  useEffect(() => {
    cursorRef.current = { x: cursorX, y: cursorY };
  }, [cursorX, cursorY]);

  // Reset cursor position when bounds change
  useEffect(() => {
    setCursorX(Math.min(cursorX, boundsWidth));
    setCursorY(Math.min(cursorY, boundsHeight));
  }, [boundsWidth, boundsHeight, cursorX, cursorY]);

  // Clear long tap timer
  const clearLongTapTimer = useCallback(() => {
    if (longTapTimerRef.current) {
      clearTimeout(longTapTimerRef.current);
      longTapTimerRef.current = null;
    }
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    const touchPos = { x: touch.clientX, y: touch.clientY };
    lastTouchRef.current = touchPos;
    touchStartTimeRef.current = Date.now();
    touchStartPosRef.current = touchPos;
    hasMoved.current = false;
    setIsLongTapActive(false);

    // Check for double-tap (for drag-and-drop)
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    const lastTapPos = lastTapPosRef.current;

    const isDoubleTap = timeSinceLastTap < DOUBLE_TAP_INTERVAL && lastTapPos &&
      Math.abs(touch.clientX - lastTapPos.x) < TAP_MOVE_THRESHOLD * 3 &&
      Math.abs(touch.clientY - lastTapPos.y) < TAP_MOVE_THRESHOLD * 3;

    if (isDoubleTap) {
      // Start drag mode
      setIsDragging(true);
      dragStartCursorRef.current = { ...cursorRef.current };
      onDragStart?.(cursorRef.current.x, cursorRef.current.y);
      // Clear refs to prevent triple-tap issues
      lastTapTimeRef.current = 0;
      lastTapPosRef.current = null;
      return;
    }

    // Start long tap timer (for right-click)
    clearLongTapTimer();
    longTapTimerRef.current = setTimeout(() => {
      if (!hasMoved.current && !isDragging) {
        // Long tap detected - trigger right click
        setIsLongTapActive(true);
        onClick(cursorRef.current.x, cursorRef.current.y, 2);
      }
    }, LONG_TAP_DURATION);
  }, [enabled, onClick, onDragStart, clearLongTapTimer, isDragging]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || !lastTouchRef.current) return;
    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    const deltaX = (touch.clientX - lastTouchRef.current.x) * sensitivity;
    const deltaY = (touch.clientY - lastTouchRef.current.y) * sensitivity;

    // Check if moved enough to cancel tap gestures
    if (touchStartPosRef.current) {
      const totalDelta = Math.abs(touch.clientX - touchStartPosRef.current.x) +
                         Math.abs(touch.clientY - touchStartPosRef.current.y);
      if (totalDelta > TAP_MOVE_THRESHOLD) {
        hasMoved.current = true;
        clearLongTapTimer();  // Cancel long tap if moved
      }
    }

    // Update cursor position
    let newX = cursorX;
    let newY = cursorY;

    setCursorX(prev => {
      newX = Math.max(0, Math.min(boundsWidth, prev + deltaX));
      return newX;
    });
    setCursorY(prev => {
      newY = Math.max(0, Math.min(boundsHeight, prev + deltaY));
      return newY;
    });

    lastTouchRef.current = { x: touch.clientX, y: touch.clientY };

    // If dragging, send drag move events
    if (isDragging) {
      onDragMove?.(newX, newY);
    }
  }, [enabled, sensitivity, boundsWidth, boundsHeight, cursorX, cursorY, clearLongTapTimer, isDragging, onDragMove]);

  // Handle touch end
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();

    clearLongTapTimer();

    const touchDuration = Date.now() - touchStartTimeRef.current;

    // If was dragging, end drag
    if (isDragging) {
      onDragEnd?.(cursorX, cursorY);
      setIsDragging(false);
      dragStartCursorRef.current = null;
      lastTouchRef.current = null;
      touchStartPosRef.current = null;
      return;
    }

    // If long tap was already handled, don't do anything else
    if (isLongTapActive) {
      setIsLongTapActive(false);
      lastTouchRef.current = null;
      touchStartPosRef.current = null;
      return;
    }

    // If it was a quick tap without much movement, treat as click
    if (!hasMoved.current && touchDuration < 300) {
      // Record for double-tap detection
      lastTapTimeRef.current = Date.now();
      lastTapPosRef.current = touchStartPosRef.current;

      // Left click
      onClick(cursorX, cursorY, 1);
    }

    lastTouchRef.current = null;
    touchStartPosRef.current = null;
  }, [enabled, cursorX, cursorY, onClick, clearLongTapTimer, isDragging, isLongTapActive, onDragEnd]);

  // Two-finger tap for right-click (alternative method)
  const handleTouchStartMulti = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    if (e.touches.length === 2) {
      e.preventDefault();
      clearLongTapTimer();
      touchStartTimeRef.current = Date.now();
      hasMoved.current = false;
    }
  }, [enabled, clearLongTapTimer]);

  const handleTouchEndMulti = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;
    // If two fingers were lifted quickly, it's a right-click
    if (e.changedTouches.length >= 2 && !hasMoved.current && Date.now() - touchStartTimeRef.current < 300) {
      onClick(cursorX, cursorY, 2);  // Right click
    }
  }, [enabled, cursorX, cursorY, onClick]);

  // Send move events when cursor moves (but not during drag - that's handled separately)
  useEffect(() => {
    if (enabled && !isDragging) {
      onMove(cursorX, cursorY);
    }
  }, [enabled, cursorX, cursorY, onMove, isDragging]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearLongTapTimer();
    };
  }, [clearLongTapTimer]);

  if (!enabled) return null;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-10"
      style={{ touchAction: 'none' }}
      onTouchStart={(e) => { handleTouchStart(e); handleTouchStartMulti(e); }}
      onTouchMove={handleTouchMove}
      onTouchEnd={(e) => { handleTouchEnd(e); handleTouchEndMulti(e); }}
    >
      {/* Virtual cursor indicator */}
      <div
        className="absolute pointer-events-none transition-transform duration-75"
        style={{
          left: cursorX - 12,
          top: cursorY - 12,
          width: 24,
          height: 24,
        }}
      >
        {/* Cursor circle - different style when dragging or long-tap */}
        <div
          className={`w-6 h-6 rounded-full border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.5)] transition-colors ${
            isDragging
              ? 'border-blue-400 bg-blue-400/30'
              : isLongTapActive
                ? 'border-orange-400 bg-orange-400/30'
                : 'border-white bg-white/20'
          }`}
        />
        {/* Center dot */}
        <div
          className={`absolute w-2 h-2 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.5)] ${
            isDragging ? 'bg-blue-400' : isLongTapActive ? 'bg-orange-400' : 'bg-white'
          }`}
          style={{ left: 8, top: 8 }}
        />
      </div>

      {/* Touch hint - only shown if explicitly enabled */}
      {showHint && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/60 rounded-full text-white text-xs whitespace-nowrap">
          Tap: click · Long-tap: right-click · Double-tap+drag: drag
        </div>
      )}
    </div>
  );
}
