/**
 * Live train marker component for map visualization
 * Displays train position with optional bearing indicator
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import { AppColors } from '../../constants/theme';
import { getColoredRouteColor } from '../../utils/route-colors';

interface LiveTrainMarkerProps {
  trainNumber: string;
  routeName: string | null;
  coordinate: {
    latitude: number;
    longitude: number;
  };
  bearing?: number;
  colored?: boolean;
  isSaved?: boolean;
  onPress?: () => void;
}

export function LiveTrainMarker({
  trainNumber,
  routeName,
  coordinate,
  bearing,
  colored = false,
  isSaved = false,
  onPress,
}: LiveTrainMarkerProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Get color based on route name if colored mode
  const markerColor = colored && routeName
    ? getColoredRouteColor(routeName).stroke
    : AppColors.primary;

  const title = routeName
    ? `${routeName} ${trainNumber}`
    : `Train ${trainNumber}`;

  // Determine icon color based on state
  const iconColor = isSaved ? AppColors.accentBlue : markerColor;

  return (
    <Marker
      coordinate={coordinate}
      title={title}
      description={isSaved ? 'Saved' : 'Live'}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
    >
      <Animated.View style={[styles.markerContainer, { opacity: fadeAnim }]}>
        <View style={styles.iconWrapper}>
          <FontAwesome6
            name="train"
            size={22}
            color={iconColor}
            solid
          />
        </View>
        {bearing !== undefined && (
          <View
            style={[
              styles.bearingIndicator,
              { transform: [{ rotate: `${bearing}deg` }] },
            ]}
          >
            <View style={[styles.bearingArrow, { borderBottomColor: iconColor }]} />
          </View>
        )}
      </Animated.View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  bearingIndicator: {
    position: 'absolute',
    top: 2,
    alignItems: 'center',
  },
  bearingArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: AppColors.primary,
  },
});
