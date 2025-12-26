'use client';

import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  // 서버에서는 항상 false, 클라이언트에서만 실제 값 사용
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  // 마운트 전에는 false 반환 (hydration 일치)
  if (!mounted) return false;
  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 1023px)');
}

export function useIsKeyboardOpen(): boolean {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const initialHeight = window.visualViewport?.height || window.innerHeight;

    const handleResize = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      setIsKeyboardOpen(initialHeight - currentHeight > 150);
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return isKeyboardOpen;
}
