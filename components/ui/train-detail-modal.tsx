import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useContext } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { AppColors, Spacing } from '../../constants/theme';
import type { Train } from '../../types/train';
import { SlideUpModalContext } from './slide-up-modal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = AppColors;
const FONTS = {
  family: 'System',
};

interface TrainDetailModalProps {
  train: Train;
  onClose: () => void;
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

// Helper function to calculate duration between two times
const calculateDuration = (startTime: string, endTime: string): string => {
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
};

export default function TrainDetailModal({ train, onClose }: TrainDetailModalProps) {
  const { panGesture, isFullscreen, isCollapsed, scrollOffset } = useContext(SlideUpModalContext);
  
  // Calculate journey duration from departure to arrival
  const duration = calculateDuration(train.departTime, train.arriveTime);
  
  // Estimate mileage based on number of stops (rough estimate: ~40-50 miles per stop segment)
  const estimatedMiles = Math.round(((train.intermediateStops?.length || 0) + 1) * 45);
  
  return (
    <GestureDetector gesture={panGesture}>
      <ScrollView 
        style={styles.modalContent} 
        scrollEnabled={isFullscreen} 
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          scrollOffset.value = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <View style={[styles.header, isCollapsed && styles.headerCollapsed]}>
          <View style={styles.headerContent}>
            <Image
              source={require('../../assets/images/amtrak.png')}
              style={styles.headerLogo}
              fadeDuration={0}
            />
            <View style={styles.headerTextContainer}>
              <View style={styles.headerTop}>
                <Text style={styles.headerTitle}>
                  {train.airline} {train.flightNumber} • {train.date}
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.6}>
                  <Ionicons name="close" size={24} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.routeTitle}>
                {train.from} to {train.to}
              </Text>
            </View>
          </View>
        </View>

        {/* Collapsed: only header visible */}
        {!isCollapsed && (
          <>
            {/* Departs in */}
            <View style={styles.departsSection}>
              <Text style={styles.departsText}>Departs in {train.daysAway} days</Text>
            </View>
            <View style={styles.fullWidthLine} />

            {/* Departure Info */}
            <View style={styles.infoSection}>
              <View style={styles.infoHeader}>
                <MaterialCommunityIcons name="arrow-top-right" size={16} color={COLORS.primary} />
                <Text style={styles.locationCode}>{train.fromCode}</Text>
                <Text style={styles.locationName}> • {train.from} Intl.</Text>
              </View>
              <Text style={styles.timeText}>{train.departTime}</Text>
              <View style={styles.durationLineRow}>
                <View style={styles.durationContent}>
                  <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.secondary} />
                  <Text style={styles.durationText}>{duration}</Text>
                </View>
                <View style={styles.horizontalLine} />
              </View>
            </View>

            {/* Intermediate Stops with Timeline */}
            {train.intermediateStops && train.intermediateStops.length > 0 && (
              <View style={styles.timelineContainer}>
                <View style={styles.dashedLineWrapper}>
                  <View style={styles.dashedLine} />
                </View>
                
                {train.intermediateStops.map((stop, index) => (
                  <View key={index} style={styles.stopSection}>
                    <Text style={styles.stopTime}>{stop.time}</Text>
                    <Text style={styles.stopStation}>{stop.name}</Text>
                    <Text style={styles.stopCode}>{stop.code}</Text>
                  </View>
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
                <Text style={styles.locationCode}>{train.toCode}</Text>
                <Text style={styles.locationName}> • {train.to} Intl.</Text>
              </View>
              <Text style={styles.timeText}>
                {train.arriveTime}
                {train.arriveNext ? ' +1' : ''}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </GestureDetector>
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
    paddingBottom: Spacing.xxl,
    marginHorizontal: -Spacing.xl,
  },
  header: {
    padding: Spacing.xl,
    paddingTop: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.tertiary,
  },
  headerCollapsed: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
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
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
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
  routeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: FONTS.family,
    color: COLORS.primary
  },
  departsSection: {
    paddingTop: 16,
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
    height: 1,
    backgroundColor: COLORS.tertiary,
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
  locationCode: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FONTS.family,
    color: COLORS.primary,
    marginLeft: 8,
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
  stopStation: {
    fontSize: 14,
    fontFamily: FONTS.family,
    color: COLORS.primary,
    marginBottom: 4,
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
    backgroundColor: '#0A84FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FONTS.family,
    color: COLORS.primary,
    marginTop: 8,
  },
});
