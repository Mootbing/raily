import { useMemo } from 'react';
import { shapeLoader } from '../services/shape-loader';

export function useShapes() {
  const allShapes = useMemo(() => shapeLoader.getAllShapes(), []);
  return { visibleShapes: allShapes };
}
