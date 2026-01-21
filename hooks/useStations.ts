import { useEffect, useMemo, useState } from 'react';
import type { ViewportBounds, VisibleStation } from '../services/station-loader';
import { stationLoader } from '../services/station-loader';
import { gtfsParser } from '../utils/gtfs-parser';

export function useStations(bounds?: ViewportBounds) {
  const [gtfsLoaded, setGtfsLoaded] = useState(gtfsParser.isLoaded);
  const [initialized, setInitialized] = useState(false);

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

  // Initialize station loader once GTFS is loaded
  useEffect(() => {
    if (!gtfsLoaded || initialized) return;

    const stops = gtfsParser.getAllStops();
    stationLoader.initialize(stops);
    setInitialized(true);
  }, [gtfsLoaded, initialized]);

  // Get visible stations based on bounds
  const stations = useMemo<VisibleStation[]>(() => {
    if (!initialized) return [];

    if (bounds) {
      // Use padding for smoother panning
      return stationLoader.getVisibleStations(bounds, 0.2);
    }

    // No bounds - return all stations (fallback)
    const stops = gtfsParser.getAllStops();
    return stops.map(s => ({
      id: s.stop_id,
      name: s.stop_name,
      lat: s.stop_lat,
      lon: s.stop_lon,
    }));
  }, [initialized, bounds?.minLat, bounds?.maxLat, bounds?.minLon, bounds?.maxLon]);

  return stations;
}
