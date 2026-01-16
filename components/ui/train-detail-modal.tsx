import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useContext } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { AppColors, Spacing } from '../../constants/theme';
import { SlideUpModalContext } from './slide-up-modal';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Train {
  id: number;
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  fromCode: string;
  toCode: string;
  departTime: string;
  arriveTime: string;
  date: string;
  daysAway: number;
  arriveNext?: boolean;
}

interface TrainDetailModalProps {
  train: Train;
  onClose: () => void;
}

const COLORS = AppColors;

const FONTS = {
  family: 'System',
};

export default function TrainDetailModal({ train, onClose }: TrainDetailModalProps) {
  const { panGesture } = useContext(SlideUpModalContext);
  
  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.modalContent}>
        {/* Header */}
        <View style={styles.header}>
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
              <Text style={styles.durationText}>6h 28m • 2,516 mi</Text>
            </View>
            <View style={styles.horizontalLine} />
          </View>
        </View>

        {/* Intermediate Stops with Timeline */}
        <View style={styles.timelineContainer}>
          <View style={styles.dashedLineWrapper}>
            <View style={styles.dashedLine} />
          </View>
          
          <View style={styles.stopSection}>
            <Text style={styles.stopTime}>5:45 PM</Text>
            <Text style={styles.stopStation}>Harrisburg • HAR</Text>
            <Text style={styles.stopMetrics}>1h 52m from {train.from} • 1h 52m after Philadelphia</Text>
          </View>

          <View style={styles.stopSection}>
            <Text style={styles.stopTime}>7:12 PM</Text>
            <Text style={styles.stopStation}>Pittsburgh • PIT</Text>
            <Text style={styles.stopMetrics}>3h 19m from {train.from} • 1h 27m after Harrisburg</Text>
          </View>

          <View style={styles.stopSection}>
            <Text style={styles.stopTime}>9:30 PM</Text>
            <Text style={styles.stopStation}>Chicago • CHI</Text>
            <Text style={styles.stopMetrics}>5h 37m from {train.from} • 2h 18m after Pittsburgh</Text>
          </View>

          <View style={styles.endLineRow}>
            <View style={styles.horizontalLine} />
          </View>
        </View>

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
      </View>
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
