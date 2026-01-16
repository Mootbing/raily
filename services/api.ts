/**
 * API service for fetching train data
 * Provides abstraction layer for GTFS data access and future real-time API integration
 */

import type { EnrichedStopTime, Route, SearchResult, Stop, Train } from '../types/train';
import { gtfsParser } from '../utils/gtfs-parser';

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

      return {
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
        intermediateStops: stopTimes.slice(1, -1).map(stop => ({
          time: formatTime(stop.departure_time),
          name: stop.stop_name,
          code: stop.stop_id,
        })),
      };
    } catch (error) {
      console.error('Error fetching train details:', error);
      return null;
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
}
