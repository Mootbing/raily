import { useCallback, useRef, useState } from 'react';
import type { ViewportBounds } from '../services/shape-loader';
import { shapeLoader } from '../services/shape-loader';

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: any;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function useShapes(initialBounds: ViewportBounds) {
  const [visibleShapes, setVisibleShapes] = useState(shapeLoader.getVisibleShapes(initialBounds));
  const debouncedUpdate = useRef(debounce((bounds: ViewportBounds) => {
    const next = shapeLoader.getVisibleShapes(bounds);
    setVisibleShapes(next);
  }, 150));

  const updateBounds = useCallback((bounds: ViewportBounds) => {
    debouncedUpdate.current(bounds);
  }, []);

  return { visibleShapes, updateBounds };
}
