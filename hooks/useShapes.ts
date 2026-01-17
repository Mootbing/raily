import { useEffect, useMemo, useState } from 'react';
import { shapeLoader } from '../services/shape-loader';
import { gtfsParser } from '../utils/gtfs-parser';

export function useShapes() {
  const [gtfsLoaded, setGtfsLoaded] = useState(gtfsParser.isLoaded);

  // Poll for GTFS loaded state
  useEffect(() => {
    if (gtfsLoaded) return;

    const interval = setInterval(() => {
      if (gtfsParser.isLoaded) {
        setGtfsLoaded(true);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [gtfsLoaded]);

  const allShapes = useMemo(() => {
    if (!gtfsLoaded) return [];
    return shapeLoader.getAllShapes();
  }, [gtfsLoaded]);

  return { visibleShapes: allShapes };
}
