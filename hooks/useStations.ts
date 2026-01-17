import { useEffect, useState } from 'react';
import type { ViewportBounds, VisibleStation } from '../services/station-loader';
import { stationLoader } from '../services/station-loader';
import { gtfsParser } from '../utils/gtfs-parser';

export function useStations(bounds?: ViewportBounds) {
  const [stations, setStations] = useState<VisibleStation[]>([]);

  useEffect(() => {
    const stops = gtfsParser.getAllStops();
    stationLoader.initialize(stops);
    const all = bounds ? stationLoader.getVisibleStations(bounds) : stops.map(s => ({
      id: s.stop_id,
      name: s.stop_name,
      lat: s.stop_lat,
      lon: s.stop_lon,
    }));
    setStations(all as any);
  }, []);

  useEffect(() => {
    if (bounds) {
      setStations(stationLoader.getVisibleStations(bounds));
    }
  }, [bounds?.minLat, bounds?.maxLat, bounds?.minLon, bounds?.maxLon]);

  return stations;
}
