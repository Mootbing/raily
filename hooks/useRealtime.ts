import { useEffect, useRef } from 'react';
import { TrainAPIService } from '../services/api';
import type { Train } from '../types/train';

export function useRealtime(trains: Train[], setTrains: (t: Train[]) => void, intervalMs: number = 20000) {
  // Use ref to avoid resetting interval when trains change
  const trainsRef = useRef(trains);
  trainsRef.current = trains;

  const setTrainsRef = useRef(setTrains);
  setTrainsRef.current = setTrains;

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      if (trainsRef.current.length === 0) return;
      const updated = await Promise.all(
        trainsRef.current.map(t => TrainAPIService.refreshRealtimeData(t))
      );
      if (mounted) setTrainsRef.current(updated);
    };

    const timer = setInterval(refresh, intervalMs);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [intervalMs]); // Only depend on intervalMs, not trains
}
