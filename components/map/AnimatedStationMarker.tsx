import React, { useEffect, useRef } from 'react';
import { Animated, Text } from 'react-native';
import { Marker } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppColors } from '../../constants/theme';

interface StationCluster {
  id: string;
  lat: number;
  lon: number;
  isCluster: boolean;
  stations: Array<{ id: string; name: string; lat: number; lon: number }>;
}

interface AnimatedStationMarkerProps {
  cluster: StationCluster;
  showFullName: boolean;
  displayName: string;
  onPress: () => void;
}

export function AnimatedStationMarker({
  cluster,
  showFullName,
  displayName,
  onPress,
}: AnimatedStationMarkerProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in on mount
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Marker
      key={cluster.id}
      coordinate={{ latitude: cluster.lat, longitude: cluster.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <Animated.View style={{ alignItems: 'center', opacity: fadeAnim }}>
        <Ionicons
          name="location"
          size={24}
          color={AppColors.primary}
        />
        <Text
          style={{
            color: AppColors.primary,
            fontSize: cluster.isCluster ? 10 : 9,
            fontWeight: '600',
            marginTop: -4,
            textAlign: 'center',
          }}
          numberOfLines={1}
        >
          {displayName}
        </Text>
      </Animated.View>
    </Marker>
  );
}
