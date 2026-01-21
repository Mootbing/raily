/**
 * Train-related utility functions
 * Consolidated from services/api.ts and services/realtime.ts
 */

import { gtfsParser } from './gtfs-parser';

/**
 * Extract the actual train number from a tripId
 * Uses GTFS trips.txt trip_short_name as source of truth
 * Falls back to parsing trip_id if trips data not available
 * @param tripId - GTFS trip identifier
 * @returns Train number string
 * @example
 * extractTrainNumber("Amtrak-43-20240104") // "43"
 * extractTrainNumber("2151") // "2151"
 */
export function extractTrainNumber(tripId: string): string {
  // Try to get from trips data first (source of truth)
  const trainNumber = gtfsParser.getTrainNumber(tripId);

  // If we got something different than the tripId, use it
  if (trainNumber && trainNumber !== tripId) {
    return trainNumber;
  }

  // Fallback: Try to extract numeric train number from trip ID
  const match = tripId.match(/\d+/);
  return match ? match[0] : tripId;
}

/**
 * Normalize train number for comparison
 * Removes leading zeros and standardizes format
 * @param trainNumber - Train number to normalize
 * @returns Normalized train number
 * @example
 * normalizeTrainNumber("043") // "43"
 * normalizeTrainNumber("2151") // "2151"
 */
export function normalizeTrainNumber(trainNumber: string): string {
  return parseInt(trainNumber, 10).toString();
}

/**
 * Check if two train numbers match
 * Handles cases where train numbers may have leading zeros
 * @param trainNumber1 - First train number
 * @param trainNumber2 - Second train number
 * @returns True if train numbers match
 * @example
 * matchTrainNumber("43", "043") // true
 * matchTrainNumber("2151", "2151") // true
 */
export function matchTrainNumber(trainNumber1: string, trainNumber2: string): boolean {
  return normalizeTrainNumber(trainNumber1) === normalizeTrainNumber(trainNumber2);
}

/**
 * Format train number for display
 * Ensures consistent formatting across the app
 * @param trainNumber - Train number to format
 * @returns Formatted train number
 */
export function formatTrainNumber(trainNumber: string): string {
  // Remove leading zeros for display
  return normalizeTrainNumber(trainNumber);
}
