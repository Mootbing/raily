import React from 'react';
import { Dimensions, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import { AppColors } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PILL_WIDTH = 48;
const PILL_HEIGHT = 104; // Two buttons (48 each) + 8px gap
const STRIP_WIDTH = SCREEN_WIDTH - 32;
const STRIP_HEIGHT = 56;

const SPRING_CONFIG = {
  damping: 28,
  stiffness: 400,
  overshootClamping: false,
};

export type RouteMode = 'hidden' | 'visible';
export type StationMode = 'hidden' | 'auto' | 'all';
export type TrainMode = 'hidden' | 'saved' | 'all';
export type MapType = 'standard' | 'satellite';

interface MapSettingsPillProps {
  top: number;
  routeMode: RouteMode;
  setRouteMode: (mode: RouteMode) => void;
  stationMode: StationMode;
  setStationMode: (mode: StationMode) => void;
  mapType: MapType;
  setMapType: (type: MapType) => void;
  trainMode: TrainMode;
  setTrainMode: (mode: TrainMode) => void;
  onRecenter: () => void;
}

function getNextRouteMode(current: RouteMode): RouteMode {
  return current === 'hidden' ? 'visible' : 'hidden';
}

function getNextStationMode(current: StationMode): StationMode {
  if (current === 'hidden') return 'auto';
  if (current === 'auto') return 'all';
  return 'hidden';
}

function getNextTrainMode(current: TrainMode): TrainMode {
  if (current === 'hidden') return 'saved';
  if (current === 'saved') return 'all';
  return 'hidden';
}

function getRouteModeLabel(mode: RouteMode): string {
  return mode === 'hidden' ? 'Off' : 'On';
}

function getStationModeLabel(mode: StationMode): string {
  if (mode === 'hidden') return 'Off';
  if (mode === 'auto') return 'Compact';
  return 'All';
}

function getTrainModeLabel(mode: TrainMode): string {
  if (mode === 'hidden') return 'Off';
  if (mode === 'saved') return 'Saved';
  return 'All';
}

function getModeColor(mode: string): string {
  if (mode === 'hidden') return AppColors.tertiary;
  if (mode === 'visible' || mode === 'auto' || mode === 'saved' || mode === 'standard') return AppColors.primary;
  return AppColors.accentBlue;
}

export default function MapSettingsPill({
  top,
  routeMode,
  setRouteMode,
  stationMode,
  setStationMode,
  mapType,
  setMapType,
  trainMode,
  setTrainMode,
  onRecenter,
}: MapSettingsPillProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const expandProgress = useSharedValue(0);

  const handleSettingsPress = () => {
    setIsExpanded(true);
    expandProgress.value = withSpring(1, SPRING_CONFIG);
  };

  const handleClose = () => {
    expandProgress.value = withSpring(0, SPRING_CONFIG, () => {
      runOnJS(setIsExpanded)(false);
    });
  };

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      width: interpolate(expandProgress.value, [0, 1], [PILL_WIDTH, STRIP_WIDTH]),
      height: interpolate(expandProgress.value, [0, 1], [PILL_HEIGHT, STRIP_HEIGHT]),
      borderRadius: interpolate(expandProgress.value, [0, 1], [24, 16]),
    };
  });

  const collapsedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(expandProgress.value, [0, 0.3], [1, 0]),
      transform: [{ scale: interpolate(expandProgress.value, [0, 0.3], [1, 0.8]) }],
    };
  });

  const expandedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(expandProgress.value, [0.7, 1], [0, 1]),
      transform: [{ scale: interpolate(expandProgress.value, [0.7, 1], [0.8, 1]) }],
    };
  });

  return (
    <Animated.View style={[styles.container, { top }, animatedContainerStyle]}>
      {/* Collapsed Content - Settings + Recenter buttons */}
      <Animated.View style={[styles.collapsedContent, collapsedContentStyle]} pointerEvents={isExpanded ? 'none' : 'auto'}>
        <TouchableOpacity
          style={styles.pillButton}
          onPress={handleSettingsPress}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={24} color={AppColors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.pillButton}
          onPress={onRecenter}
          activeOpacity={0.7}
        >
          <FontAwesome name="location-arrow" size={22} color={AppColors.primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Expanded Content - Settings strip */}
      <Animated.View style={[styles.expandedContent, expandedContentStyle]} pointerEvents={isExpanded ? 'auto' : 'none'}>
        {/* Routes */}
        <TouchableOpacity
          style={styles.settingOption}
          onPress={() => setRouteMode(getNextRouteMode(routeMode))}
          activeOpacity={0.7}
        >
          <MaterialIcons name="route" size={20} color={getModeColor(routeMode)} />
          <Text style={[styles.settingLabel, { color: getModeColor(routeMode) }]}>
            {getRouteModeLabel(routeMode)}
          </Text>
        </TouchableOpacity>

        {/* Stations */}
        <TouchableOpacity
          style={styles.settingOption}
          onPress={() => setStationMode(getNextStationMode(stationMode))}
          activeOpacity={0.7}
        >
          <Ionicons
            name={stationMode === 'all' ? 'location' : 'location-outline'}
            size={20}
            color={stationMode === 'hidden' ? AppColors.tertiary : AppColors.primary}
          />
          <Text style={[styles.settingLabel, { color: stationMode === 'hidden' ? AppColors.tertiary : AppColors.primary }]}>
            {getStationModeLabel(stationMode)}
          </Text>
        </TouchableOpacity>

        {/* Map Type */}
        <TouchableOpacity
          style={styles.settingOption}
          onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
          activeOpacity={0.7}
        >
          {mapType === 'standard' ? (
            <Ionicons name="map" size={20} color={AppColors.primary} />
          ) : (
            <MaterialIcons name="satellite-alt" size={20} color={AppColors.primary} />
          )}
          <Text style={[styles.settingLabel, { color: AppColors.primary }]}>
            {mapType === 'standard' ? 'Std' : 'Sat'}
          </Text>
        </TouchableOpacity>

        {/* Trains */}
        <TouchableOpacity
          style={styles.settingOption}
          onPress={() => setTrainMode(getNextTrainMode(trainMode))}
          activeOpacity={0.7}
        >
          <Ionicons name="train" size={20} color={getModeColor(trainMode)} />
          <Text style={[styles.settingLabel, { color: getModeColor(trainMode) }]}>
            {getTrainModeLabel(trainMode)}
          </Text>
        </TouchableOpacity>

        {/* Close */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color={AppColors.primary} />
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    backgroundColor: AppColors.background.primary,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: AppColors.border.primary,
    overflow: 'hidden',
  },
  collapsedContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 0,
  },
  pillButton: {
    width: PILL_WIDTH,
    height: PILL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  settingOption: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    minWidth: 50,
  },
  settingLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: AppColors.background.secondary,
  },
});
