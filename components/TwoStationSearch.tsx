import React, { useEffect, useState, useRef } from 'react';
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { gtfsParser } from '../utils/gtfs-parser';
import type { Stop, EnrichedStopTime } from '../types/train';
import { AppColors, BorderRadius, FontSizes, Spacing } from '../constants/theme';

interface TripResult {
  tripId: string;
  fromStop: EnrichedStopTime;
  toStop: EnrichedStopTime;
  intermediateStops: EnrichedStopTime[];
}

interface TwoStationSearchProps {
  onSelectTrip: (tripId: string, fromCode: string, toCode: string) => void;
  onClose: () => void;
}

/**
 * Format 24-hour time to 12-hour AM/PM format
 */
function formatTime(time24: string): string {
  const [hours, minutes] = time24.substring(0, 5).split(':');
  let h = parseInt(hours);
  // Handle times > 24:00 (next day)
  if (h >= 24) h -= 24;
  const m = minutes;
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export function TwoStationSearch({ onSelectTrip, onClose }: TwoStationSearchProps) {
  const [fromStation, setFromStation] = useState<Stop | null>(null);
  const [toStation, setToStation] = useState<Stop | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stationResults, setStationResults] = useState<Stop[]>([]);
  const [tripResults, setTripResults] = useState<TripResult[]>([]);
  const [activeField, setActiveField] = useState<'from' | 'to'>('from');
  const [isDataLoaded, setIsDataLoaded] = useState(gtfsParser.isLoaded);
  const searchInputRef = useRef<TextInput>(null);

  // Check if GTFS data is loaded
  useEffect(() => {
    const checkLoaded = () => {
      if (gtfsParser.isLoaded && !isDataLoaded) {
        setIsDataLoaded(true);
      }
    };
    // Check immediately and then poll briefly in case data loads async
    checkLoaded();
    const interval = setInterval(checkLoaded, 500);
    return () => clearInterval(interval);
  }, [isDataLoaded]);

  // Search stations when query changes
  useEffect(() => {
    if (searchQuery.length > 0 && isDataLoaded) {
      const results = gtfsParser.searchStations(searchQuery);
      setStationResults(results);
    } else {
      setStationResults([]);
    }
  }, [searchQuery, isDataLoaded]);

  // Find trips when both stations are selected
  useEffect(() => {
    if (fromStation && toStation) {
      const trips = gtfsParser.findTripsWithStops(fromStation.stop_id, toStation.stop_id);
      setTripResults(trips);
    } else {
      setTripResults([]);
    }
  }, [fromStation, toStation]);

  const handleSelectStation = (station: Stop) => {
    if (activeField === 'from') {
      setFromStation(station);
      setActiveField('to');
      setSearchQuery('');
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setToStation(station);
      setSearchQuery('');
    }
  };

  const handleClearFrom = () => {
    setFromStation(null);
    setToStation(null);
    setTripResults([]);
    setActiveField('from');
    setSearchQuery('');
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleClearTo = () => {
    setToStation(null);
    setTripResults([]);
    setActiveField('to');
    setSearchQuery('');
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const showingResults = fromStation && toStation;
  const showingStationSearch = !showingResults && searchQuery.length > 0;

  // Before first station is selected - show original search bar style
  if (!fromStation) {
    return (
      <View style={styles.container}>
        {/* Original style search bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={AppColors.secondary} />
          <TextInput
            ref={searchInputRef}
            style={styles.fullSearchInput}
            placeholder="Train name, station name/code, or route"
            placeholderTextColor={AppColors.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close-circle" size={20} color={AppColors.secondary} />
          </TouchableOpacity>
        </View>

        {/* Station Search Results */}
        {showingStationSearch && (
          <View style={styles.resultsContainer}>
            <Text style={styles.sectionLabel}>SELECT DEPARTURE STATION</Text>
            {!isDataLoaded ? (
              <Text style={styles.noResults}>Loading station data...</Text>
            ) : stationResults.length === 0 ? (
              <Text style={styles.noResults}>No stations found</Text>
            ) : (
              stationResults.map((station) => (
                <TouchableOpacity
                  key={station.stop_id}
                  style={styles.stationItem}
                  onPress={() => handleSelectStation(station)}
                >
                  <View style={styles.stationIcon}>
                    <Ionicons name="location" size={20} color={AppColors.primary} />
                  </View>
                  <View style={styles.stationInfo}>
                    <Text style={styles.stationName}>{station.stop_name}</Text>
                    <Text style={styles.stationCode}>{station.stop_id}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </View>
    );
  }

  // After first station is selected - show split view with pill
  return (
    <View style={styles.container}>
      {/* Split Station Input Row */}
      <View style={styles.inputRow}>
        {/* From Station Pill */}
        <TouchableOpacity style={styles.stationPill} onPress={handleClearFrom}>
          <Text style={styles.stationPillText}>{fromStation.stop_id}</Text>
          <Ionicons name="close" size={14} color={AppColors.primary} />
        </TouchableOpacity>

        {/* Arrow between stations */}
        <Ionicons name="arrow-forward" size={16} color={AppColors.secondary} style={styles.arrow} />

        {/* To Station Pill/Input */}
        {toStation ? (
          <TouchableOpacity style={styles.stationPill} onPress={handleClearTo}>
            <Text style={styles.stationPillText}>{toStation.stop_id}</Text>
            <Ionicons name="close" size={14} color={AppColors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.activeInputContainer}>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Arrival station"
              placeholderTextColor={AppColors.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
        )}

        {/* Close button */}
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close-circle" size={20} color={AppColors.secondary} />
        </TouchableOpacity>
      </View>

      {/* Station Search Results (for arrival) */}
      {showingStationSearch && (
        <View style={styles.resultsContainer}>
          <Text style={styles.sectionLabel}>SELECT ARRIVAL STATION</Text>
          {!isDataLoaded ? (
            <Text style={styles.noResults}>Loading station data...</Text>
          ) : stationResults.length === 0 ? (
            <Text style={styles.noResults}>No stations found</Text>
          ) : (
            stationResults.map((station) => (
              <TouchableOpacity
                key={station.stop_id}
                style={styles.stationItem}
                onPress={() => handleSelectStation(station)}
              >
                <View style={styles.stationIcon}>
                  <Ionicons name="location" size={20} color={AppColors.primary} />
                </View>
                <View style={styles.stationInfo}>
                  <Text style={styles.stationName}>{station.stop_name}</Text>
                  <Text style={styles.stationCode}>{station.stop_id}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* Trip Results */}
      {showingResults && (
        <View style={styles.resultsContainer}>
          <Text style={styles.sectionLabel}>
            {tripResults.length} TRAIN{tripResults.length !== 1 ? 'S' : ''} FOUND
          </Text>
          {tripResults.length === 0 ? (
            <Text style={styles.noResults}>No direct trains between these stations</Text>
          ) : (
            tripResults.map((trip) => (
              <TouchableOpacity
                key={trip.tripId}
                style={styles.tripItem}
                onPress={() => onSelectTrip(trip.tripId, fromStation.stop_id, toStation.stop_id)}
              >
                <View style={styles.tripIcon}>
                  <Ionicons name="train" size={20} color={AppColors.primary} />
                </View>
                <View style={styles.tripInfo}>
                  <Text style={styles.tripName}>Train {trip.tripId}</Text>
                  <View style={styles.tripTimes}>
                    <Text style={styles.tripTime}>
                      {formatTime(trip.fromStop.departure_time)}
                    </Text>
                    <Ionicons name="arrow-forward" size={12} color={AppColors.secondary} />
                    <Text style={styles.tripTime}>
                      {formatTime(trip.toStop.arrival_time)}
                    </Text>
                  </View>
                  {trip.intermediateStops.length > 0 && (
                    <Text style={styles.tripStops}>
                      {trip.intermediateStops.length} stop{trip.intermediateStops.length !== 1 ? 's' : ''}
                    </Text>
                  )}
                </View>
                <Ionicons name="add-circle" size={24} color={AppColors.accentBlue} />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {/* Hint when from is selected but no to search */}
      {!showingStationSearch && !showingResults && searchQuery.length === 0 && (
        <View style={styles.hintContainer}>
          <Ionicons name="information-circle-outline" size={20} color={AppColors.secondary} />
          <Text style={styles.hintText}>
            Now enter your arrival station
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Original search bar style (before first station selected)
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.background.secondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: AppColors.border.secondary,
  },
  fullSearchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    color: AppColors.primary,
    fontSize: FontSizes.searchLabel,
  },
  // Split input row (after first station selected)
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.background.secondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: AppColors.border.secondary,
    gap: Spacing.sm,
  },
  stationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.background.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderColor: AppColors.border.primary,
    gap: 4,
  },
  stationPillText: {
    color: AppColors.primary,
    fontSize: FontSizes.searchLabel,
    fontWeight: '600',
  },
  activeInputContainer: {
    flex: 1,
  },
  searchInput: {
    color: AppColors.primary,
    fontSize: FontSizes.searchLabel,
    paddingVertical: Spacing.xs,
  },
  arrow: {
    marginHorizontal: 2,
  },
  closeButton: {
    marginLeft: 'auto',
    padding: 4,
  },
  resultsContainer: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: FontSizes.timeLabel,
    color: AppColors.secondary,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  noResults: {
    color: AppColors.secondary,
    fontSize: FontSizes.flightDate,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  stationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.background.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: AppColors.border.primary,
  },
  stationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  stationInfo: {
    flex: 1,
  },
  stationName: {
    fontSize: FontSizes.searchLabel,
    color: AppColors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  stationCode: {
    fontSize: FontSizes.daysLabel,
    color: AppColors.secondary,
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.background.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: AppColors.border.primary,
  },
  tripIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  tripInfo: {
    flex: 1,
  },
  tripName: {
    fontSize: FontSizes.searchLabel,
    color: AppColors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  tripTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripTime: {
    fontSize: FontSizes.daysLabel,
    color: AppColors.secondary,
    fontWeight: '500',
  },
  tripStops: {
    fontSize: FontSizes.daysLabel,
    color: AppColors.secondary,
    marginTop: 2,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  hintText: {
    color: AppColors.secondary,
    fontSize: FontSizes.flightDate,
  },
});
