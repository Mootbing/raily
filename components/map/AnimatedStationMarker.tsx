import React, { useEffect, useRef, useState } from 'react';
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

export function AnimatedStationMarker({ cluster, showFullName, displayName, onPress }: AnimatedStationMarkerProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const [currentDisplay, setCurrentDisplay] = useState(displayName);
  const [currentIsCluster, setCurrentIsCluster] = useState(cluster.isCluster);

  // Fade in on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  // Animate when display name or cluster state changes
  useEffect(() => {
    if (displayName !== currentDisplay || cluster.isCluster !== currentIsCluster) {
      // Quick fade out, update, fade in
      Animated.sequence([
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.9,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(10), // Small delay for state update
      ]).start(() => {
        setCurrentDisplay(displayName);
        setCurrentIsCluster(cluster.isCluster);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 8,
            tension: 100,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [displayName, cluster.isCluster, currentDisplay, currentIsCluster, fadeAnim, scaleAnim]);

  return (
    <Marker
      key={cluster.id}
      coordinate={{ latitude: cluster.lat, longitude: cluster.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }}
      >
        <Ionicons
          name="location"
          size={24}
          color={AppColors.primary}
          style={{
            textShadowColor: 'rgba(0, 0, 0, 0.75)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
        />
        <Text
          style={{
            color: AppColors.primary,
            fontSize: currentIsCluster ? 10 : 9,
            fontWeight: '600',
            marginTop: 0,
            textAlign: 'center',
            textShadowColor: 'rgba(0, 0, 0, 0.75)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
          numberOfLines={1}
        >
          {currentDisplay}
        </Text>
      </Animated.View>
    </Marker>
  );
}
