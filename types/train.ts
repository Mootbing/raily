/**
 * Core type definitions for the Raily train tracking app
 */


export interface Train {
  id: number;
  operator: string;
  trainNumber: string;
  from: string;
  to: string;
  fromCode: string;
  toCode: string;
  departTime: string;
  arriveTime: string;
  date: string;
  daysAway: number;
  routeName: string;
  arriveNext?: boolean;
  intermediateStops?: IntermediateStop[];
  // Real-time data
  tripId?: string;
  realtime?: {
    position?: { lat: number; lon: number };
    delay?: number; // minutes
    status?: string;
    lastUpdated?: number;
  };
}

export interface IntermediateStop {
  time: string;
  name: string;
  code: string;
}

export interface Route {
  route_id: string;
  agency_id?: string;
  route_short_name?: string;
  route_long_name: string;
  route_type?: string;
  route_url?: string;
  route_color?: string;
  route_text_color?: string;
}

export interface Stop {
  stop_id: string;
  stop_name: string;
  stop_url?: string;
  stop_timezone?: string;
  stop_lat: number;
  stop_lon: number;
}

export interface StopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: number;
  pickup_type?: number;
  drop_off_type?: number;
  timepoint?: number;
}

export interface EnrichedStopTime extends StopTime {
  stop_name: string;
  stop_code: string;
}

export interface Trip {
  route_id: string;
  trip_id: string;
  trip_short_name?: string;
  trip_headsign?: string;
}

export interface Shape {
  shape_id: string;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
}

export type SearchResultType = 'station' | 'train' | 'route';

export interface SearchResult {
  id: string;
  name: string;
  subtitle: string;
  type: SearchResultType;
  data: Stop | Trip | Route | { trip_id: string; stop_id?: string; stop_name?: string };
}

export interface FrequentlyUsedItem {
  id: string;
  name: string;
  code: string;
  subtitle: string;
  type: 'train' | 'station';
}

/**
 * Lightweight saved train reference for local storage.
 * Contains only the essential IDs needed to reconstruct the full train data.
 */
export interface SavedTrainRef {
  tripId: string;           // Primary identifier for the train trip
  fromCode?: string;        // Optional: user's boarding station (for segmented trips)
  toCode?: string;          // Optional: user's destination station (for segmented trips)
  savedAt: number;          // Timestamp when saved
}
