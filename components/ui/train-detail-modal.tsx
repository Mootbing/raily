import React from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppColors, Spacing } from '../../constants/theme';
import { formatTimeWithDayOffset } from '../../services/api';

import { useTrainContext } from '../../context/TrainContext';
import type { Train } from '../../types/train';
import { haversineDistance } from '../../utils/distance';
import { gtfsParser } from '../../utils/gtfs-parser';
import { getCountdownForTrain } from '../TrainList';
import { SlideUpModalContext } from './slide-up-modal';
import TimeDisplay from './TimeDisplay';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = AppColors;
const FONTS = {
  family: 'System',
};


interface TrainDetailModalProps {
  train?: Train;
  onClose: () => void;
  onStationSelect?: (stationCode: string, lat: number, lon: number) => void;
  onTrainSelect?: (train: Train) => void;
}

/**
 * Format 24-hour GTFS time to 12-hour AM/PM format with day offset
 * Handles times like "13:12:00" -> { time: "1:12 PM", dayOffset: 0 }
 * Handles times like "25:30:00" -> { time: "1:30 AM", dayOffset: 1 }
 */
function formatTime24to12(time24: string): { time: string; dayOffset: number } {
  return formatTimeWithDayOffset(time24);
}

/**
 * Add delay minutes to a time string and return the new time
 * @param timeStr - Time in "h:mm AM/PM" format
 * @param delayMinutes - Number of minutes to add
 * @param baseDayOffset - The original day offset
 * @returns New time string and updated day offset
 */
function addDelayToTime(timeStr: string, delayMinutes: number, baseDayOffset: number = 0): { time: string; dayOffset: number } {
  const minutes = timeToMinutes(timeStr);
  let newMinutes = minutes + delayMinutes;
  let dayOffset = baseDayOffset;

  // Handle day rollover
  while (newMinutes >= 24 * 60) {
    newMinutes -= 24 * 60;
    dayOffset += 1;
  }

  const hours = Math.floor(newMinutes / 60);
  const mins = newMinutes % 60;
  const isPM = hours >= 12;
  let displayHours = hours % 12;
  if (displayHours === 0) displayHours = 12;

  return {
    time: `${displayHours}:${mins.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`,
    dayOffset,
  };
}

/**
 * Calculate number of nights for a journey based on day offsets
 */
function calculateNights(departDayOffset: number, arriveDayOffset: number): number {
  return Math.max(0, (arriveDayOffset || 0) - (departDayOffset || 0));
}

/**
 * Pluralize a word based on count
 * @param count - The number to check
 * @param singular - Singular form of the word
 * @param plural - Plural form (defaults to singular + 's')
 */
function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || `${singular}s`);
}

// Helper function to parse time string (HH:MM AM/PM) and return minutes since midnight
const timeToMinutes = (timeStr: string): number => {
  // Extract just the time part (before AM/PM)
  const timePart = timeStr.split(' ')[0];
  const [hoursStr, minutesStr] = timePart.split(':');
  const hours = parseInt(hoursStr);
  const minutes = parseInt(minutesStr);
  const isPM = timeStr.includes('PM');
  
  let totalHours = hours;
  if (isPM && hours !== 12) {
    totalHours = hours + 12;
  } else if (!isPM && hours === 12) {
    totalHours = 0;
  }
  
  return totalHours * 60 + minutes;
};

function calculateDuration(startTime: string, endTime: string): string {
  const startMinutes = timeToMinutes(startTime);
  let endMinutes = timeToMinutes(endTime);
  // If end time is earlier than start time, assume it's the next day
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  const duration = endMinutes - startMinutes;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  return `${hours}h ${minutes}m`;
}


import { Alert } from 'react-native';

export default function TrainDetailModal({ train, onClose, onStationSelect, onTrainSelect }: TrainDetailModalProps) {
  // Use context if train is not provided
  const { selectedTrain } = useTrainContext();
  const trainData = train || selectedTrain;
  const [intermediateStops, setIntermediateStops] = React.useState<
    { time: string; dayOffset: number; name: string; code: string }[]
  >([]);
  const [error, setError] = React.useState<string | null>(null);

  // For live trains: track past stops, next stop, and future stops
  const [allStops, setAllStops] = React.useState<
    { time: string; dayOffset: number; name: string; code: string }[]
  >([]);
  const [isRouteExpanded, setIsRouteExpanded] = React.useState(false);
  const [isHeaderExpanded, setIsHeaderExpanded] = React.useState(false);

  // Check if train is currently live (has realtime position)
  const isLiveTrain = trainData?.realtime?.position !== undefined;

  React.useEffect(() => {
    if (!trainData) return;
    if (trainData.tripId) {
      try {
        const stops = gtfsParser.getStopTimesForTrip(trainData.tripId);
        if (stops && stops.length > 0) {
          // Store all stops for the full route (for live trains)
          const allFormattedStops = stops.map(stop => {
            const formatted = stop.departure_time ? formatTime24to12(stop.departure_time) : { time: '', dayOffset: 0 };
            return {
              time: formatted.time,
              dayOffset: formatted.dayOffset,
              name: stop.stop_name,
              code: stop.stop_id,
            };
          });
          setAllStops(allFormattedStops);

          // Find the indices of the user's selected segment
          const fromIdx = stops.findIndex(s => s.stop_id === trainData.fromCode);
          const toIdx = stops.findIndex(s => s.stop_id === trainData.toCode);

          if (fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx) {
            // Only show stops between from and to (exclusive of endpoints)
            const segmentStops = stops.slice(fromIdx + 1, toIdx);
            setIntermediateStops(
              segmentStops.map(stop => {
                const formatted = stop.departure_time ? formatTime24to12(stop.departure_time) : { time: '', dayOffset: 0 };
                return {
                  time: formatted.time,
                  dayOffset: formatted.dayOffset,
                  name: stop.stop_name,
                  code: stop.stop_id,
                };
              })
            );
          } else {
            // Fallback: show all intermediate stops if segment not found
            setIntermediateStops(
              stops.slice(1, -1).map(stop => {
                const formatted = stop.departure_time ? formatTime24to12(stop.departure_time) : { time: '', dayOffset: 0 };
                return {
                  time: formatted.time,
                  dayOffset: formatted.dayOffset,
                  name: stop.stop_name,
                  code: stop.stop_id,
                };
              })
            );
          }
        } else {
          setError('No intermediate stops found in GTFS data for this train.');
        }
      } catch (e) {
        setError('Failed to load stops from GTFS data.');
      }
    } else {
      setError('No trip ID available for this train.');
    }
  }, [trainData]);

  React.useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [
        { text: 'OK', onPress: onClose }
      ]);
    }
  }, [error, onClose]);

  // Use context from SlideUpModal for proper scroll/gesture coordination
  const { isCollapsed, isFullscreen, scrollOffset } = React.useContext(SlideUpModalContext);
  const [isScrolled, setIsScrolled] = React.useState(false);

  // Check if modal is at half height (not collapsed and not fullscreen)
  const isHalfHeight = !isCollapsed && !isFullscreen;
  // Calculate journey duration from departure to arrival
  const duration = trainData ? calculateDuration(trainData.departTime, trainData.arriveTime) : '';

  // Calculate distance using station coordinates
  let distanceMiles: number | null = null;
  if (trainData) {
    try {
      const fromStop = gtfsParser.getStop(trainData.fromCode);
      const toStop = gtfsParser.getStop(trainData.toCode);
      distanceMiles = haversineDistance(fromStop.stop_lat, fromStop.stop_lon, toStop.stop_lat, toStop.stop_lon);
    } catch {}
  }

  // Countdown logic (shared with TrainList)
  const countdown = trainData ? getCountdownForTrain(trainData) : null;
  const unitLabel = countdown ? `${countdown.unit}${countdown.past ? ' AGO' : ''}` : '';

  // For live trains: find the next stop based on current time
  const { pastStops, nextStop, futureStops, originStop } = React.useMemo(() => {
    if (!isLiveTrain || allStops.length === 0) {
      return { pastStops: [], nextStop: null, futureStops: [], originStop: null };
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Find the first stop that hasn't happened yet
    let nextStopIndex = -1;
    for (let i = 0; i < allStops.length; i++) {
      const stopMinutes = timeToMinutes(allStops[i].time);
      // Account for day offset - if stop is next day, add 24 hours
      const adjustedStopMinutes = stopMinutes + (allStops[i].dayOffset * 24 * 60);
      const adjustedCurrentMinutes = currentMinutes;

      if (adjustedStopMinutes > adjustedCurrentMinutes) {
        nextStopIndex = i;
        break;
      }
    }

    // If no future stop found, train has completed its journey
    if (nextStopIndex === -1) {
      return {
        pastStops: allStops.slice(0, -1),
        nextStop: allStops[allStops.length - 1],
        futureStops: [],
        originStop: allStops[0],
      };
    }

    return {
      pastStops: allStops.slice(0, nextStopIndex),
      nextStop: allStops[nextStopIndex],
      futureStops: allStops.slice(nextStopIndex + 1),
      originStop: allStops[0],
    };
  }, [isLiveTrain, allStops]);

  // For live trains: calculate remaining stops count
  const remainingStopsCount = futureStops.length;
  const pastStopsCount = pastStops.length;

  // For live trains: calculate remaining duration and distance (from next stop to final destination)
  const { remainingDuration, remainingDistanceMiles } = React.useMemo(() => {
    if (!isLiveTrain || !nextStop || allStops.length === 0) {
      return { remainingDuration: duration, remainingDistanceMiles: distanceMiles };
    }

    const finalStop = allStops[allStops.length - 1];

    // Calculate remaining duration from next stop to final destination
    const remDuration = calculateDuration(nextStop.time, finalStop.time);

    // Calculate remaining distance from next stop to final destination
    let remDistance: number | null = null;
    try {
      const nextStopData = gtfsParser.getStop(nextStop.code);
      const finalStopData = gtfsParser.getStop(finalStop.code);
      if (nextStopData && finalStopData) {
        remDistance = haversineDistance(
          nextStopData.stop_lat, nextStopData.stop_lon,
          finalStopData.stop_lat, finalStopData.stop_lon
        );
      }
    } catch {}

    return { remainingDuration: remDuration, remainingDistanceMiles: remDistance };
  }, [isLiveTrain, nextStop, allStops, duration, distanceMiles]);

  // Check if the saved route is a segment (user's from/to don't match full route origin/destination)
  const isSegment = React.useMemo(() => {
    if (allStops.length < 2 || !trainData) return false;
    const fullRouteOrigin = allStops[0].code;
    const fullRouteDestination = allStops[allStops.length - 1].code;
    return trainData.fromCode !== fullRouteOrigin || trainData.toCode !== fullRouteDestination;
  }, [allStops, trainData]);

  // Calculate full route duration and distance (for segments)
  const { fullRouteDuration, fullRouteDistanceMiles } = React.useMemo(() => {
    if (allStops.length < 2) {
      return { fullRouteDuration: duration, fullRouteDistanceMiles: distanceMiles };
    }

    const originStop = allStops[0];
    const finalStop = allStops[allStops.length - 1];

    // Calculate full route duration
    const fullDuration = calculateDuration(originStop.time, finalStop.time);

    // Calculate full route distance
    let fullDistance: number | null = null;
    try {
      const originStopData = gtfsParser.getStop(originStop.code);
      const finalStopData = gtfsParser.getStop(finalStop.code);
      if (originStopData && finalStopData) {
        fullDistance = haversineDistance(
          originStopData.stop_lat, originStopData.stop_lon,
          finalStopData.stop_lat, finalStopData.stop_lon
        );
      }
    } catch {}

    return { fullRouteDuration: fullDuration, fullRouteDistanceMiles: fullDistance };
  }, [allStops, duration, distanceMiles]);

  // Handle station selection - get coordinates and call callback
  const handleStationPress = (stationCode: string) => {
    if (!onStationSelect) return;
    try {
      const stop = gtfsParser.getStop(stationCode);
      if (stop) {
        onStationSelect(stationCode, stop.stop_lat, stop.stop_lon);
      }
    } catch (e) {
      console.error('Failed to get station coordinates:', e);
    }
  };

  // Instead of returning early, render null or error in JSX
  if (!trainData || error) {
    return <></>;
  }

  return (
    <View style={styles.modalContent}>
      {/* Header - Fixed outside ScrollView */}
      <View style={[styles.header, isScrolled && styles.headerScrolled]}>
        <View style={styles.headerContent}>
          <Image
            source={require('../../assets/images/amtrak.png')}
            style={styles.headerLogo}
            fadeDuration={0}
          />
          <View style={styles.headerTextContainer}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {(trainData.routeName ? trainData.routeName : trainData.operator)} {trainData.trainNumber} • {trainData.date}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => !isCollapsed && setIsHeaderExpanded(!isHeaderExpanded)}
              activeOpacity={isCollapsed ? 1 : 0.7}
            >
              {isCollapsed ? (
                // When modal is collapsed, always show short format
                <Text style={styles.routeTitle} numberOfLines={1}>
                  {isRouteExpanded && allStops.length >= 2
                    ? `${allStops[0].code} → ${allStops[allStops.length - 1].code}`
                    : `${trainData.fromCode} → ${trainData.toCode}`}
                </Text>
              ) : isHeaderExpanded ? (
                <>
                  <Text style={styles.routeTitle}>
                    {isRouteExpanded && allStops.length >= 2 ? allStops[0].name : trainData.from}
                  </Text>
                  <Text style={styles.routeTitle}>
                    to {isRouteExpanded && allStops.length >= 2 ? allStops[allStops.length - 1].name : trainData.to}
                  </Text>
                </>
              ) : (
                <Text style={styles.routeTitle} numberOfLines={1}>
                  {isRouteExpanded && allStops.length >= 2
                    ? `${allStops[0].code} → ${allStops[allStops.length - 1].code}`
                    : `${trainData.fromCode} → ${trainData.toCode}`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
        {/* Absolutely positioned close button */}
        <TouchableOpacity onPress={onClose} style={styles.absoluteCloseButton} activeOpacity={0.6}>
          <Ionicons name="close" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Collapsed: only header visible */}
      {!isCollapsed && (
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: isHalfHeight ? SCREEN_HEIGHT * 0.5 : 100 }}
          showsVerticalScrollIndicator={true}
          onScroll={(e) => {
            const offsetY = e.nativeEvent.contentOffset.y;
            if (scrollOffset) scrollOffset.value = offsetY;
            setIsScrolled(offsetY > 0);
          }}
          scrollEventThrottle={16}
          bounces={true}
          nestedScrollEnabled={true}
        >
          {/* Departs in (granular, like card) */}
          {countdown && <View style={styles.fullWidthLine} />}
          {countdown && (
            <View style={styles.departsSection}>
              <Text style={[styles.departsText, { color: COLORS.secondary }]}>
                {countdown.past ? 'Departed ' : 'Departs in '}
                <Text style={{ fontWeight: 'bold', color: COLORS.primary }}>{countdown.value}</Text>
                {' '}
                <Text style={{ color: COLORS.secondary }}>{unitLabel.toLowerCase()}</Text>
              </Text>
            </View>
          )}
          <View style={styles.fullWidthLine} />

          {/* LIVE TRAIN VIEW: Show next stop as primary, elapsed stops in duration row */}
          {isLiveTrain && nextStop && !isRouteExpanded ? (
            <>
              {/* Next Stop (Primary) - only show if there are more stops after this one */}
              {remainingStopsCount > 0 && (
                <>
                  <View style={styles.infoSection}>
                    <View style={styles.infoHeader}>
                      <MaterialCommunityIcons name="arrow-top-right" size={16} color={COLORS.primary} />
                      <TouchableOpacity
                        style={styles.stationTouchable}
                        onPress={() => handleStationPress(nextStop.code)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.locationCode}>{nextStop.code}</Text>
                        <Text style={styles.locationName}> • {nextStop.name}</Text>
                      </TouchableOpacity>
                    </View>
                    <TimeDisplay
                      time={nextStop.time}
                      dayOffset={nextStop.dayOffset}
                      style={styles.timeText}
                      superscriptStyle={styles.timeSuperscript}
                    />
                    <View style={styles.durationLineRow}>
                      <View style={styles.durationContentRow}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.secondary} style={{ marginRight: 6 }} />
                        <Text style={styles.durationText}>{remainingDuration}</Text>
                        {remainingDistanceMiles !== null && (
                          <Text style={[styles.durationText, { marginLeft: 0 }]}> • {remainingDistanceMiles.toFixed(0)} mi</Text>
                        )}
                        <Text style={[styles.durationText, { marginLeft: 0 }]}> • {remainingStopsCount} {pluralize(remainingStopsCount, 'stop')} left</Text>
                        <TouchableOpacity
                          style={styles.elapsedStopsButton}
                          onPress={() => setIsRouteExpanded(true)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.elapsedStopsText}> • show route</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.horizontalLine} />
                    </View>
                  </View>

                  {/* Future Stops */}
                  {futureStops.length > 0 && (
                    <View style={styles.timelineContainer}>
                      <View style={styles.dashedLineWrapper}>
                        <View style={styles.dashedLine} />
                      </View>
                      {futureStops.map((stop, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.stopSection}
                          onPress={() => handleStationPress(stop.code)}
                          activeOpacity={0.7}
                        >
                          <TimeDisplay
                            time={stop.time}
                            dayOffset={stop.dayOffset}
                            style={styles.stopTime}
                            superscriptStyle={styles.stopTimeSuperscript}
                          />
                          <Text style={styles.stopStation}>{stop.name}</Text>
                          <Text style={styles.stopCode}>{stop.code}</Text>
                        </TouchableOpacity>
                      ))}
                      <View style={styles.endLineRow}>
                        <View style={styles.horizontalLine} />
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* Final Destination */}
              <View style={styles.infoSection}>
                <View style={styles.infoHeader}>
                  <MaterialCommunityIcons name="arrow-bottom-left" size={16} color={COLORS.primary} />
                  <TouchableOpacity
                    style={styles.stationTouchable}
                    onPress={() => handleStationPress(allStops[allStops.length - 1]?.code || trainData.toCode)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.locationCode}>{allStops[allStops.length - 1]?.code || trainData.toCode}</Text>
                    <Text style={styles.locationName}> • {allStops[allStops.length - 1]?.name || gtfsParser.getStopName(trainData.toCode)}</Text>
                  </TouchableOpacity>
                </View>
                <TimeDisplay
                  time={allStops[allStops.length - 1]?.time || trainData.arriveTime}
                  dayOffset={allStops[allStops.length - 1]?.dayOffset || trainData.arriveDayOffset}
                  style={styles.timeText}
                  superscriptStyle={styles.timeSuperscript}
                />
                {/* Show "show full route" link when at final stop */}
                {remainingStopsCount === 0 && (
                  <View style={styles.durationLineRow}>
                    <View style={styles.durationContentRow}>
                      <TouchableOpacity
                        style={styles.elapsedStopsButton}
                        onPress={() => setIsRouteExpanded(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.elapsedStopsText}>show route</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              {/* STANDARD VIEW: Show full route (non-live trains or expanded view) */}
              {/* EXPANDED LIVE TRAIN VIEW: Show all stops with elapsed ones in secondary color */}
              {isLiveTrain && isRouteExpanded && allStops.length > 0 ? (
                <>
                  {/* Origin Stop */}
                  <View style={styles.infoSection}>
                    <View style={styles.infoHeader}>
                      <MaterialCommunityIcons name="arrow-top-right" size={16} color={pastStopsCount > 0 ? COLORS.secondary : COLORS.primary} />
                      <TouchableOpacity
                        style={styles.stationTouchable}
                        onPress={() => handleStationPress(allStops[0].code)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.locationCode, pastStopsCount > 0 && styles.elapsedText]}>{allStops[0].code}</Text>
                        <Text style={[styles.locationName, pastStopsCount > 0 && styles.elapsedText]}> • {allStops[0].name}</Text>
                      </TouchableOpacity>
                    </View>
                    <TimeDisplay
                      time={allStops[0].time}
                      dayOffset={allStops[0].dayOffset}
                      style={[styles.timeText, pastStopsCount > 0 && styles.elapsedText]}
                      superscriptStyle={[styles.timeSuperscript, pastStopsCount > 0 && styles.elapsedText]}
                    />
                    <View style={styles.durationLineRow}>
                      <View style={styles.durationContentRow}>
                        <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.secondary} style={{ marginRight: 6 }} />
                        <Text style={styles.durationText}>{duration}</Text>
                        {distanceMiles !== null && (
                          <Text style={[styles.durationText, { marginLeft: 0 }]}> • {distanceMiles.toFixed(0)} mi</Text>
                        )}
                        <Text style={[styles.durationText, { marginLeft: 0 }]}> • {allStops.length - 1} {pluralize(allStops.length - 1, 'stop')}</Text>
                        <TouchableOpacity
                          style={styles.elapsedStopsButton}
                          onPress={() => setIsRouteExpanded(false)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.elapsedStopsText}> • show remaining</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.horizontalLine} />
                    </View>
                  </View>

                  {/* All Intermediate Stops with elapsed styling */}
                  {allStops.length > 2 && (
                    <View style={styles.timelineContainer}>
                      <View style={styles.dashedLineWrapper}>
                        <View style={styles.dashedLine} />
                      </View>
                      {allStops.slice(1, -1).map((stop, index) => {
                        // Check if this stop has elapsed (index + 1 because we sliced from 1)
                        const isElapsed = index + 1 < pastStopsCount;
                        return (
                          <TouchableOpacity
                            key={index}
                            style={styles.stopSection}
                            onPress={() => handleStationPress(stop.code)}
                            activeOpacity={0.7}
                          >
                            <TimeDisplay
                              time={stop.time}
                              dayOffset={stop.dayOffset}
                              style={[styles.stopTime, isElapsed && styles.elapsedText]}
                              superscriptStyle={[styles.stopTimeSuperscript, isElapsed && styles.elapsedText]}
                            />
                            <Text style={[styles.stopStation, isElapsed && styles.elapsedText]}>{stop.name}</Text>
                            <Text style={[styles.stopCode, isElapsed && styles.elapsedText]}>{stop.code}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      <View style={styles.endLineRow}>
                        <View style={styles.horizontalLine} />
                      </View>
                    </View>
                  )}

                  {/* Final Destination */}
                  <View style={styles.infoSection}>
                    <View style={styles.infoHeader}>
                      <MaterialCommunityIcons name="arrow-bottom-left" size={16} color={COLORS.primary} />
                      <TouchableOpacity
                        style={styles.stationTouchable}
                        onPress={() => handleStationPress(allStops[allStops.length - 1].code)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.locationCode}>{allStops[allStops.length - 1].code}</Text>
                        <Text style={styles.locationName}> • {allStops[allStops.length - 1].name}</Text>
                      </TouchableOpacity>
                    </View>
                    <TimeDisplay
                      time={allStops[allStops.length - 1].time}
                      dayOffset={allStops[allStops.length - 1].dayOffset}
                      style={styles.timeText}
                      superscriptStyle={styles.timeSuperscript}
                    />
                  </View>
                </>
              ) : (
                <>
                  {/* NON-LIVE TRAINS: Show segment or full route based on isRouteExpanded */}
                  {isSegment && isRouteExpanded && allStops.length > 0 ? (
                    <>
                      {/* FULL ROUTE VIEW for segments */}
                      {/* Origin Stop */}
                      {(() => {
                        // Check if origin is outside user's segment (before user's starting station)
                        const fromIdx = allStops.findIndex(s => s.code === trainData.fromCode);
                        const isOriginOutsideSegment = fromIdx > 0;
                        return (
                          <View style={styles.infoSection}>
                            <View style={styles.infoHeader}>
                              <MaterialCommunityIcons name="arrow-top-right" size={16} color={isOriginOutsideSegment ? COLORS.secondary : COLORS.primary} />
                              <TouchableOpacity
                                style={styles.stationTouchable}
                                onPress={() => handleStationPress(allStops[0].code)}
                                activeOpacity={0.7}
                              >
                                <Text style={[styles.locationCode, isOriginOutsideSegment && styles.elapsedText]}>{allStops[0].code}</Text>
                                <Text style={[styles.locationName, isOriginOutsideSegment && styles.elapsedText]}> • {allStops[0].name}</Text>
                              </TouchableOpacity>
                            </View>
                            <TimeDisplay
                              time={allStops[0].time}
                              dayOffset={allStops[0].dayOffset}
                              style={[styles.timeText, isOriginOutsideSegment && styles.elapsedText]}
                              superscriptStyle={[styles.timeSuperscript, isOriginOutsideSegment && styles.elapsedText]}
                            />
                            <View style={styles.durationLineRow}>
                              <View style={styles.durationContentRow}>
                                <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.secondary} style={{ marginRight: 6 }} />
                                <Text style={styles.durationText}>{fullRouteDuration}</Text>
                                {fullRouteDistanceMiles !== null && (
                                  <Text style={[styles.durationText, { marginLeft: 0 }]}> • {fullRouteDistanceMiles.toFixed(0)} mi</Text>
                                )}
                                <Text style={[styles.durationText, { marginLeft: 0 }]}> • {allStops.length - 1} {pluralize(allStops.length - 1, 'stop')}</Text>
                                <TouchableOpacity
                                  style={styles.elapsedStopsButton}
                                  onPress={() => setIsRouteExpanded(false)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.elapsedStopsText}> • show remaining</Text>
                                </TouchableOpacity>
                              </View>
                              <View style={styles.horizontalLine} />
                            </View>
                          </View>
                        );
                      })()}

                      {/* All Intermediate Stops - highlight user's segment */}
                      {allStops.length > 2 && (
                        <View style={styles.timelineContainer}>
                          <View style={styles.dashedLineWrapper}>
                            <View style={styles.dashedLine} />
                          </View>
                          {allStops.slice(1, -1).map((stop, index) => {
                            // Check if this stop is within user's segment
                            const fromIdx = allStops.findIndex(s => s.code === trainData.fromCode);
                            const toIdx = allStops.findIndex(s => s.code === trainData.toCode);
                            const currentIdx = index + 1; // +1 because we sliced from 1
                            const isOutsideSegment = currentIdx < fromIdx || currentIdx > toIdx;
                            return (
                              <TouchableOpacity
                                key={index}
                                style={styles.stopSection}
                                onPress={() => handleStationPress(stop.code)}
                                activeOpacity={0.7}
                              >
                                <TimeDisplay
                                  time={stop.time}
                                  dayOffset={stop.dayOffset}
                                  style={[styles.stopTime, isOutsideSegment && styles.elapsedText]}
                                  superscriptStyle={[styles.stopTimeSuperscript, isOutsideSegment && styles.elapsedText]}
                                />
                                <Text style={[styles.stopStation, isOutsideSegment && styles.elapsedText]}>{stop.name}</Text>
                                <Text style={[styles.stopCode, isOutsideSegment && styles.elapsedText]}>{stop.code}</Text>
                              </TouchableOpacity>
                            );
                          })}
                          <View style={styles.endLineRow}>
                            <View style={styles.horizontalLine} />
                          </View>
                        </View>
                      )}

                      {/* Final Destination */}
                      {(() => {
                        // Check if final destination is outside user's segment
                        const toIdx = allStops.findIndex(s => s.code === trainData.toCode);
                        const isDestinationOutsideSegment = toIdx !== -1 && toIdx < allStops.length - 1;
                        return (
                          <View style={styles.infoSection}>
                            <View style={styles.infoHeader}>
                              <MaterialCommunityIcons name="arrow-bottom-left" size={16} color={isDestinationOutsideSegment ? COLORS.secondary : COLORS.primary} />
                              <TouchableOpacity
                                style={styles.stationTouchable}
                                onPress={() => handleStationPress(allStops[allStops.length - 1].code)}
                                activeOpacity={0.7}
                              >
                                <Text style={[styles.locationCode, isDestinationOutsideSegment && styles.elapsedText]}>{allStops[allStops.length - 1].code}</Text>
                                <Text style={[styles.locationName, isDestinationOutsideSegment && styles.elapsedText]}> • {allStops[allStops.length - 1].name}</Text>
                              </TouchableOpacity>
                            </View>
                            <TimeDisplay
                              time={allStops[allStops.length - 1].time}
                              dayOffset={allStops[allStops.length - 1].dayOffset}
                              style={[styles.timeText, isDestinationOutsideSegment && styles.elapsedText]}
                              superscriptStyle={[styles.timeSuperscript, isDestinationOutsideSegment && styles.elapsedText]}
                            />
                          </View>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      {/* SEGMENT VIEW (or full route if not a segment) */}
                      {/* Departure Info */}
                      <View style={styles.infoSection}>
                        <View style={styles.infoHeader}>
                          <MaterialCommunityIcons name="arrow-top-right" size={16} color={COLORS.primary} />
                          <TouchableOpacity
                            style={styles.stationTouchable}
                            onPress={() => handleStationPress(trainData.fromCode)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.locationCode}>{trainData.fromCode}</Text>
                            <Text style={styles.locationName}> • {gtfsParser.getStopName(trainData.fromCode)}</Text>
                          </TouchableOpacity>
                        </View>
                        {(() => {
                          const delay = trainData.realtime?.delay;
                          if (delay && delay > 0) {
                            const delayed = addDelayToTime(trainData.departTime, delay, trainData.departDayOffset || 0);
                            return (
                              <TimeDisplay
                                time={trainData.departTime}
                                dayOffset={trainData.departDayOffset}
                                style={styles.timeText}
                                superscriptStyle={styles.timeSuperscript}
                                delayMinutes={delay}
                                delayedTime={delayed.time}
                                delayedDayOffset={delayed.dayOffset}
                              />
                            );
                          }
                          return (
                            <TimeDisplay
                              time={trainData.departTime}
                              dayOffset={trainData.departDayOffset}
                              style={styles.timeText}
                              superscriptStyle={styles.timeSuperscript}
                            />
                          );
                        })()}
                        <View style={styles.durationLineRow}>
                          <View style={styles.durationContentRow}>
                            <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.secondary} style={{ marginRight: 6 }} />
                            <Text style={styles.durationText}>{duration}</Text>
                            {distanceMiles !== null && (
                              <Text style={[styles.durationText, { marginLeft: 0 }]}> • {distanceMiles.toFixed(0)} mi</Text>
                            )}
                            {intermediateStops && (
                              <Text style={[styles.durationText, { marginLeft: 0 }]}> • {intermediateStops.length} {pluralize(intermediateStops.length, 'stop')}</Text>
                            )}
                            {isSegment && (
                              <TouchableOpacity
                                style={styles.elapsedStopsButton}
                                onPress={() => setIsRouteExpanded(true)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.elapsedStopsText}> • show route</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <View style={styles.horizontalLine} />
                        </View>
                      </View>

                      {/* Intermediate Stops with Timeline */}
                      {intermediateStops && intermediateStops.length > 0 && (
                        <View style={styles.timelineContainer}>
                          <View style={styles.dashedLineWrapper}>
                            <View style={styles.dashedLine} />
                          </View>
                          {intermediateStops.map((stop, index) => (
                            <TouchableOpacity
                              key={index}
                              style={styles.stopSection}
                              onPress={() => handleStationPress(stop.code)}
                              activeOpacity={0.7}
                            >
                              <TimeDisplay
                                time={stop.time}
                                dayOffset={stop.dayOffset}
                                style={styles.stopTime}
                                superscriptStyle={styles.stopTimeSuperscript}
                              />
                              <Text style={styles.stopStation}>{stop.name}</Text>
                              <Text style={styles.stopCode}>{stop.code}</Text>
                            </TouchableOpacity>
                          ))}
                          <View style={styles.endLineRow}>
                            <View style={styles.horizontalLine} />
                          </View>
                        </View>
                      )}

                      {/* Arrival Info */}
                      <View style={styles.infoSection}>
                        <View style={styles.infoHeader}>
                          <MaterialCommunityIcons name="arrow-bottom-left" size={16} color={COLORS.primary} />
                          <TouchableOpacity
                            style={styles.stationTouchable}
                            onPress={() => handleStationPress(trainData.toCode)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.locationCode}>{trainData.toCode}</Text>
                            <Text style={styles.locationName}> • {gtfsParser.getStopName(trainData.toCode)}</Text>
                          </TouchableOpacity>
                        </View>
                        {(() => {
                          const delay = trainData.realtime?.delay;
                          if (delay && delay > 0) {
                            const delayed = addDelayToTime(trainData.arriveTime, delay, trainData.arriveDayOffset || 0);
                            return (
                              <TimeDisplay
                                time={trainData.arriveTime}
                                dayOffset={trainData.arriveDayOffset}
                                style={styles.timeText}
                                superscriptStyle={styles.timeSuperscript}
                                delayMinutes={delay}
                                delayedTime={delayed.time}
                                delayedDayOffset={delayed.dayOffset}
                              />
                            );
                          }
                          return (
                            <TimeDisplay
                              time={trainData.arriveTime}
                              dayOffset={trainData.arriveDayOffset}
                              style={styles.timeText}
                              superscriptStyle={styles.timeSuperscript}
                            />
                          );
                        })()}
                      </View>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  blurOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  blurContainer: {
    overflow: 'hidden',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  modalContent: {
    flex: 1,
    marginHorizontal: -Spacing.xl,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 0,
    paddingBottom: Spacing.md,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerScrolled: {
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border.primary,
  },
  scrollContent: {
    flex: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 40,
    height: 50,
    resizeMode: 'contain',
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 48 + Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
  },
  closeButton: {
    padding: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  absoluteCloseButton: {
    position: 'absolute',
    top: 0,
    right: Spacing.xl,
    zIndex: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
  },
  routeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: FONTS.family,
    color: COLORS.primary,
  },
  departsSection: {
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  departsText: {
    fontSize: 16,
    fontFamily: FONTS.family,
    color: COLORS.primary,
  },
  fullWidthLine: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.tertiary,
    backgroundColor: 'transparent',
    marginBottom: 16,
  },
  infoSection: {
    padding: 20,
    paddingVertical: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stationTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  locationCode: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.family,
    color: COLORS.primary,
  },
  locationName: {
    fontSize: 16,
    fontFamily: FONTS.family,
    color: COLORS.primary,
  },
  timeText: {
    fontSize: 36,
    fontWeight: 'bold',
    fontFamily: FONTS.family,
    color: COLORS.primary,
    marginBottom: 16,
  },
  timeSuperscript: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondary,
    marginLeft: 4,
    marginTop: 0,
  },
  statusText: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
    marginTop: 8,
    marginBottom: 8,
  },
  durationLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  durationContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  endLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  horizontalLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.tertiary,
    marginLeft: 12,
  },
  statusDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  durationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationText: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
  },
  terminalText: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
  },
  timelineContainer: {
    position: 'relative',
    marginLeft: 8,
  },
  dashedLineWrapper: {
    position: 'absolute',
    left: 18,
    top: 0,
    bottom: 0,
    width: 2,
    height: '100%',
  },
  dashedLine: {
    flex: 1,
    width: 2,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.tertiary,
    borderStyle: 'dashed',
  },
  stopSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingLeft: 40,
    marginTop: -8,
  },
  stopTime: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: FONTS.family,
    color: COLORS.primary,
    marginBottom: 4,
  },
  stopTimeSuperscript: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.secondary,
    marginLeft: 2,
    marginTop: -2,
  },
  stopStation: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.primary,
  },
  stopCode: {
    fontSize: 12,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
    marginBottom: 6,
  },
  stopElapsed: {
    fontSize: 12,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
  },
  stopMetrics: {
    fontSize: 12,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
  },
  stopInfo: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.tertiary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.family,
    color: COLORS.primary,
    marginTop: 8,
  },
  actionSubtext: {
    fontSize: 11,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
    marginTop: 2,
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONTS.family,
    color: '#000000',
    marginTop: 8,
  },
  // Elapsed stops button (inline in duration row for live trains)
  elapsedStopsButton: {
    marginLeft: 0,
    paddingVertical: 4,
  },
  elapsedStopsText: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
    marginLeft: 0
  },
  // Elapsed stop text styling (secondary color for past stops)
  elapsedText: {
    color: COLORS.secondary,
  },
});
