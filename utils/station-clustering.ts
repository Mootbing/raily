/**
 * Station clustering utility
 * Groups nearby stations when zoomed out
 */

export interface Station {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface StationCluster {
  id: string;
  lat: number;
  lon: number;
  stations: Station[];
  isCluster: boolean;
}

/**
 * Cluster stations based on zoom level
 * @param stations - Array of stations to cluster
 * @param latitudeDelta - Current map zoom level (larger = more zoomed out)
 * @returns Array of clusters or individual stations
 */
export function clusterStations(
  stations: Station[],
  latitudeDelta: number
): StationCluster[] {
  // If zoomed in enough (< 3.0 degrees), show individual stations
  if (latitudeDelta < 5.0) {
    return stations.map(station => ({
      id: station.id,
      lat: station.lat,
      lon: station.lon,
      stations: [station],
      isCluster: false,
    }));
  }

  // Calculate cluster distance based on zoom level
  // More zoomed out = larger cluster radius
  const clusterDistance = latitudeDelta * 0.1;

  const clusters: StationCluster[] = [];
  const processed = new Set<string>();

  for (const station of stations) {
    if (processed.has(station.id)) continue;

    // Find all nearby stations
    const nearbyStations = stations.filter(other => {
      if (processed.has(other.id)) return false;
      const distance = Math.sqrt(
        Math.pow(station.lat - other.lat, 2) +
        Math.pow(station.lon - other.lon, 2)
      );
      return distance <= clusterDistance;
    });

    // Mark all as processed
    nearbyStations.forEach(s => processed.add(s.id));

    // Calculate cluster center (average position)
    const avgLat = nearbyStations.reduce((sum, s) => sum + s.lat, 0) / nearbyStations.length;
    const avgLon = nearbyStations.reduce((sum, s) => sum + s.lon, 0) / nearbyStations.length;

    clusters.push({
      id: nearbyStations.length === 1
        ? nearbyStations[0].id
        : `cluster-${avgLat}-${avgLon}`,
      lat: avgLat,
      lon: avgLon,
      stations: nearbyStations,
      isCluster: nearbyStations.length > 1,
    });
  }

  return clusters;
}

/**
 * Get station abbreviation (first 3 letters or custom abbreviation)
 */
export function getStationAbbreviation(stationId: string, stationName: string): string {
  // Use the station code if it's short enough
  if (stationId.length <= 3) {
    return stationId.toUpperCase();
  }

  // Otherwise, take first 3 letters of the name
  const words = stationName.split(' ');
  if (words.length === 1) {
    return words[0].substring(0, 3).toUpperCase();
  }

  // For multi-word names, try to use initials
  if (words.length >= 2) {
    const initials = words.map(w => w[0]).join('').substring(0, 3).toUpperCase();
    if (initials.length === 3) return initials;
  }

  // Fallback to first 3 letters
  return stationName.replace(/\s/g, '').substring(0, 3).toUpperCase();
}
