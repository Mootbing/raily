import { useEffect, useMemo, useState } from 'react';
import { shapeLoader, type ViewportBounds } from '../services/shape-loader';
import { gtfsParser } from '../utils/gtfs-parser';

export function useShapes(bounds?: ViewportBounds) {
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

  const visibleShapes = useMemo(() => {
    if (!gtfsLoaded) return [];

    // If bounds provided, filter to viewport; otherwise return all
    if (bounds) {
      // Use larger padding for shapes since routes span larger areas
      return shapeLoader.getVisibleShapes(bounds, 0.5);
    }
    return shapeLoader.getAllShapes();
  }, [gtfsLoaded, bounds?.minLat, bounds?.maxLat, bounds?.minLon, bounds?.maxLon]);

  return { visibleShapes };
}
