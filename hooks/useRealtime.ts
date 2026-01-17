import { useEffect } from 'react';
import { TrainAPIService } from '../services/api';
import type { Train } from '../types/train';

export function useRealtime(trains: Train[], setTrains: (t: Train[]) => void, intervalMs: number = 20000) {
  useEffect(() => {
    let mounted = true;
    let timer: any;
    const refresh = async () => {
      const updated = await Promise.all(trains.map(t => TrainAPIService.refreshRealtimeData(t)));
      if (mounted) setTrains(updated);
    };
    timer = setInterval(refresh, intervalMs);
    return () => { mounted = false; clearInterval(timer); };
  }, [trains, intervalMs]);
}
