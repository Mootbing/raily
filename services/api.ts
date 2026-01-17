/**
 * API service for fetching train data
 * Provides abstraction layer for GTFS data access and future real-time API integration
 */

import type { EnrichedStopTime, Route, SearchResult, Stop, Train } from '../types/train';
import { gtfsParser } from '../utils/gtfs-parser';
import { RealtimeService } from './realtime';

/**
 * Format 24-hour time to 12-hour AM/PM format
 */
export function formatTime(time24: string): string {
  const [hours, minutes] = time24.substring(0, 5).split(':');
  let h = parseInt(hours);
  const m = minutes;
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export class TrainAPIService {
  /**
   * Search for trains, routes, and stations
   */
  static async search(query: string): Promise<SearchResult[]> {
    try {
      // In a real app, this would be an API call
      // For now, use the local GTFS parser
      return gtfsParser.search(query);
    } catch (error) {
      console.error('Error searching:', error);
      return [];
    }
  }

  /**
   * Get all available routes
   */
  static async getRoutes(): Promise<Route[]> {
    try {
      return gtfsParser.getAllRoutes();
    } catch (error) {
      console.error('Error fetching routes:', error);
      return [];
    }
  }

  /**
   * Get all available stops/stations
   */
  static async getStops(): Promise<Stop[]> {
    try {
      return gtfsParser.getAllStops();
    } catch (error) {
      console.error('Error fetching stops:', error);
      return [];
    }
  }

  /**
   * Get train details for a specific trip
   */
  static async getTrainDetails(tripId: string): Promise<Train | null> {
    try {
      const stopTimes = gtfsParser.getStopTimesForTrip(tripId);
      
      if (stopTimes.length === 0) {
        return null;
      }

      const firstStop = stopTimes[0];
      const lastStop = stopTimes[stopTimes.length - 1];

      const train: Train = {
        id: parseInt(tripId),
        airline: 'AMTK',
        flightNumber: tripId,
        from: firstStop.stop_name,
        to: lastStop.stop_name,
        fromCode: firstStop.stop_id,
        toCode: lastStop.stop_id,
        departTime: formatTime(firstStop.departure_time),
        arriveTime: formatTime(lastStop.arrival_time),
        date: 'Today',
        daysAway: 0,
        routeName: `Train ${tripId}`,
        tripId: tripId,
        intermediateStops: stopTimes.slice(1, -1).map(stop => ({
          time: formatTime(stop.departure_time),
          name: stop.stop_name,
          code: stop.stop_id,
        })),
      };

      // Fetch real-time data - try both trip ID and extracted train number
      await this.enrichWithRealtimeData(train);

      return train;
    } catch (error) {
      console.error('Error fetching train details:', error);
      return null;
    }
  }
  
  /**
   * Enrich a train object with real-time position and delay data
   */
  private static async enrichWithRealtimeData(train: Train): Promise<void> {
    try {
      const position = await RealtimeService.getPositionForTrip(train.tripId || train.flightNumber);
      const delay = await RealtimeService.getDelayForStop(train.tripId || train.flightNumber, train.fromCode);
      
      train.realtime = {
        position: position ? { lat: position.latitude, lon: position.longitude } : undefined,
        delay: delay ?? undefined,
        status: RealtimeService.formatDelay(delay),
        lastUpdated: position?.timestamp,
      };
    } catch (realtimeError) {
      console.warn('Could not fetch real-time data:', realtimeError);
    }
  }

  /**
   * Get trains for a specific station
   */
  static async getTrainsForStation(stopId: string): Promise<Train[]> {
    try {
      const tripIds = gtfsParser.getTripsForStop(stopId);
      const trains = await Promise.all(
        tripIds.map(tripId => this.getTrainDetails(tripId))
      );
      return trains.filter((train): train is Train => train !== null);
    } catch (error) {
      console.error('Error fetching trains for station:', error);
      return [];
    }
  }

  /**
   * Get stop times for a specific trip
   */
  static async getStopTimesForTrip(tripId: string): Promise<EnrichedStopTime[]> {
    try {
      return gtfsParser.getStopTimesForTrip(tripId);
    } catch (error) {
      console.error('Error fetching stop times:', error);
      return [];
    }
  }

  /**
   * Refresh real-time data for a train
   */
  static async refreshRealtimeData(train: Train): Promise<Train> {
    if (!train.tripId && !train.flightNumber) return train;

    const updatedTrain = { ...train };
    await this.enrichWithRealtimeData(updatedTrain);
    return updatedTrain;
  }
  
  /**
   * Get all trains currently active with real-time positions
   * Useful for displaying live trains on a map
   */
  static async getActiveTrains(): Promise<Train[]> {
    try {
      const activeTrains = await RealtimeService.getAllActiveTrains();
      const trains: Train[] = [];
      
      for (const { trainNumber, position } of activeTrains) {
        // Try to get train details from GTFS
        let train = await this.getTrainDetails(trainNumber);
        
        // If not found in GTFS, create a minimal train object
        if (!train) {
          train = {
            id: parseInt(trainNumber) || 0,
            airline: 'AMTK',
            flightNumber: trainNumber,
            from: 'Unknown',
            to: 'Unknown',
            fromCode: '',
            toCode: '',
            departTime: '',
            arriveTime: '',
            date: 'Today',
            daysAway: 0,
            routeName: `Train ${trainNumber}`,
            tripId: position.trip_id,
            realtime: {
              position: { lat: position.latitude, lon: position.longitude },
              lastUpdated: position.timestamp,
              status: 'Live',
            },
          };
        }
        
        trains.push(train);
      }
      
      return trains;
    } catch (error) {
      console.error('Error fetching active trains:', error);
      return [];
    }
  }
}
