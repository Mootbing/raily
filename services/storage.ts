/**
 * Storage service for persisting train data
 * Stores lightweight train references (tripId + optional segment info)
 * Full train data is reconstructed from GTFS on load
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedTrainRef, Train } from '../types/train';
import { TrainAPIService } from './api';

const STORAGE_KEYS = {
  SAVED_TRAINS: 'savedTrainRefs',
  USER_PREFERENCES: 'userPreferences',
} as const;

/**
 * Format 24-hour time to 12-hour AM/PM format
 */
function formatTime(time24: string): string {
  const [hours, minutes] = time24.substring(0, 5).split(':');
  let h = parseInt(hours);
  const m = minutes;
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Format date for display (e.g., "Jan 4")
 */
function formatDateForDisplay(timestamp: number): string {
  const date = new Date(timestamp);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Calculate days away from a travel date
 */
function calculateDaysAway(travelDate: number): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const travel = new Date(travelDate);
  travel.setHours(0, 0, 0, 0);
  const diffTime = travel.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export class TrainStorageService {
  /**
   * Get all saved train references
   */
  static async getSavedTrainRefs(): Promise<SavedTrainRef[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_TRAINS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading saved train refs:', error);
      return [];
    }
  }

  /**
   * Get all saved trains (reconstructed from GTFS data)
   * This fetches full train data from GTFS based on stored references
   */
  static async getSavedTrains(): Promise<Train[]> {
    try {
      const refs = await this.getSavedTrainRefs();
      const trains: Train[] = [];

      for (const ref of refs) {
        const train = await TrainAPIService.getTrainDetails(ref.tripId);
        if (train) {
          // If user saved a segmented trip, update from/to based on their segment
          if (ref.fromCode || ref.toCode) {
            const stopTimes = await TrainAPIService.getStopTimesForTrip(ref.tripId);

            if (ref.fromCode) {
              const fromStop = stopTimes.find(s => s.stop_id === ref.fromCode);
              if (fromStop) {
                train.from = fromStop.stop_name;
                train.fromCode = fromStop.stop_id;
                train.departTime = formatTime(fromStop.departure_time);
              }
            }

            if (ref.toCode) {
              const toStop = stopTimes.find(s => s.stop_id === ref.toCode);
              if (toStop) {
                train.to = toStop.stop_name;
                train.toCode = toStop.stop_id;
                train.arriveTime = formatTime(toStop.arrival_time);
              }
            }

            // Filter intermediate stops to only those between from and to
            if (ref.fromCode && ref.toCode && train.intermediateStops) {
              const fromIdx = stopTimes.findIndex(s => s.stop_id === ref.fromCode);
              const toIdx = stopTimes.findIndex(s => s.stop_id === ref.toCode);
              if (fromIdx !== -1 && toIdx !== -1) {
                const segmentStops = stopTimes.slice(fromIdx + 1, toIdx);
                train.intermediateStops = segmentStops.map(s => ({
                  time: formatTime(s.departure_time),
                  name: s.stop_name,
                  code: s.stop_id,
                }));
              }
            }
          }

          // Update date and daysAway based on travel date
          if (ref.travelDate) {
            train.date = formatDateForDisplay(ref.travelDate);
            train.daysAway = calculateDaysAway(ref.travelDate);
          }

          trains.push(train);
        }
      }

      return trains;
    } catch (error) {
      console.error('Error loading saved trains:', error);
      return [];
    }
  }

  /**
   * Save a train reference to the list
   */
  static async saveTrainRef(ref: SavedTrainRef): Promise<boolean> {
    try {
      const refs = await this.getSavedTrainRefs();

      // Check if train already exists (same tripId, segment, and travel date)
      const exists = refs.some(r =>
        r.tripId === ref.tripId &&
        r.fromCode === ref.fromCode &&
        r.toCode === ref.toCode &&
        r.travelDate === ref.travelDate
      );
      if (exists) {
        return false;
      }

      const updatedRefs = [...refs, ref];
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_TRAINS, JSON.stringify(updatedRefs));
      return true;
    } catch (error) {
      console.error('Error saving train ref:', error);
      return false;
    }
  }

  /**
   * Save a train (creates a reference from the full train object)
   */
  static async saveTrain(train: Train): Promise<boolean> {
    if (!train.tripId) {
      console.error('Cannot save train without tripId');
      return false;
    }

    const ref: SavedTrainRef = {
      tripId: train.tripId,
      fromCode: train.fromCode || undefined,
      toCode: train.toCode || undefined,
      savedAt: Date.now(),
    };

    return this.saveTrainRef(ref);
  }

  /**
   * Delete a train by tripId (and optional segment)
   */
  static async deleteTrainByTripId(tripId: string, fromCode?: string, toCode?: string): Promise<boolean> {
    try {
      const refs = await this.getSavedTrainRefs();
      const updatedRefs = refs.filter(r => {
        if (r.tripId !== tripId) return true;
        // If segment codes provided, only delete matching segment
        if (fromCode !== undefined || toCode !== undefined) {
          return r.fromCode !== fromCode || r.toCode !== toCode;
        }
        return false;
      });
      await AsyncStorage.setItem(STORAGE_KEYS.SAVED_TRAINS, JSON.stringify(updatedRefs));
      return true;
    } catch (error) {
      console.error('Error deleting train:', error);
      return false;
    }
  }

  /**
   * Delete a train by numeric ID (for backwards compatibility)
   */
  static async deleteTrain(trainId: number): Promise<boolean> {
    return this.deleteTrainByTripId(String(trainId));
  }

  /**
   * Clear all saved trains
   */
  static async clearAllTrains(): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.SAVED_TRAINS);
      return true;
    } catch (error) {
      console.error('Error clearing trains:', error);
      return false;
    }
  }
}
