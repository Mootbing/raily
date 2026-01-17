import { useEffect, useState } from 'react';
import { TrainAPIService } from '../services/api';

export interface FrequentlyUsedItem {
  id: string;
  name: string;
  code: string;
  subtitle: string;
  type: 'train' | 'station';
}

export function useFrequentlyUsed() {
  const [items, setItems] = useState<FrequentlyUsedItem[]>([]);

  const loadFrequentlyUsed = async () => {
    const routes = await TrainAPIService.getRoutes();
    const stops = await TrainAPIService.getStops();
    setItems([
      ...routes.slice(0, 3).map((route, index) => ({
        id: `freq-route-${index}`,
        name: route.route_long_name,
        code: route.route_short_name || route.route_id.substring(0, 3),
        subtitle: `AMT${route.route_id}`,
        type: 'train' as const,
      })),
      ...stops.slice(0, 2).map((stop, index) => ({
        id: `freq-stop-${index}`,
        name: stop.stop_name,
        code: stop.stop_id,
        subtitle: stop.stop_id,
        type: 'station' as const,
      })),
    ]);
  };

  useEffect(() => {
    loadFrequentlyUsed();
  }, []);

  const refresh = async () => {
    await loadFrequentlyUsed();
  };

  return { items, refresh };
}
