/**
 * Train clustering utility
 * Groups nearby trains when zoomed out
 */

import { ClusteringConfig } from './clustering-config';

export interface LiveTrainData {
  tripId: string;
  trainNumber: string;
  routeName: string | null;
  position: {
    lat: number;
    lon: number;
    bearing?: number;
  };
  isSaved?: boolean;
}

export interface TrainCluster {
  id: string;
  lat: number;
  lon: number;
  trains: LiveTrainData[];
  isCluster: boolean;
  // For single train, keep original data
  trainNumber?: string;
  routeName?: string | null;
  tripId?: string;
  isSaved?: boolean;
}

/**
 * Cluster trains based on zoom level
 * @param trains - Array of trains to cluster
 * @param latitudeDelta - Current map zoom level (larger = more zoomed out)
 * @returns Array of clusters or individual trains
 */
export function clusterTrains(trains: LiveTrainData[], latitudeDelta: number): TrainCluster[] {
  // If zoomed in enough, show individual trains
  if (latitudeDelta < ClusteringConfig.trainClusterThreshold) {
    return trains.map(train => ({
      id: train.tripId,
      lat: train.position.lat,
      lon: train.position.lon,
      trains: [train],
      isCluster: false,
      trainNumber: train.trainNumber,
      routeName: train.routeName,
      tripId: train.tripId,
      isSaved: train.isSaved,
    }));
  }

  // Calculate cluster distance based on zoom level
  const clusterDistance = latitudeDelta * ClusteringConfig.clusterDistanceMultiplier;

  const clusters: TrainCluster[] = [];
  const processed = new Set<string>();

  for (const train of trains) {
    if (processed.has(train.tripId)) continue;

    // Find all nearby trains
    const nearbyTrains = trains.filter(other => {
      if (processed.has(other.tripId)) return false;
      const distance = Math.sqrt(
        Math.pow(train.position.lat - other.position.lat, 2) + Math.pow(train.position.lon - other.position.lon, 2)
      );
      return distance <= clusterDistance;
    });

    // Mark all as processed
    nearbyTrains.forEach(t => processed.add(t.tripId));

    // Calculate cluster center (average position)
    const avgLat = nearbyTrains.reduce((sum, t) => sum + t.position.lat, 0) / nearbyTrains.length;
    const avgLon = nearbyTrains.reduce((sum, t) => sum + t.position.lon, 0) / nearbyTrains.length;

    // Check if any train in cluster is saved
    const hasSavedTrain = nearbyTrains.some(t => t.isSaved);

    if (nearbyTrains.length === 1) {
      clusters.push({
        id: nearbyTrains[0].tripId,
        lat: avgLat,
        lon: avgLon,
        trains: nearbyTrains,
        isCluster: false,
        trainNumber: nearbyTrains[0].trainNumber,
        routeName: nearbyTrains[0].routeName,
        tripId: nearbyTrains[0].tripId,
        isSaved: nearbyTrains[0].isSaved,
      });
    } else {
      clusters.push({
        id: `train-cluster-${avgLat}-${avgLon}`,
        lat: avgLat,
        lon: avgLon,
        trains: nearbyTrains,
        isCluster: true,
        isSaved: hasSavedTrain,
      });
    }
  }

  return clusters;
}
