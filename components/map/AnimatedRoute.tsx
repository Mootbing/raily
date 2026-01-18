import React, { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { Polyline } from 'react-native-maps';

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface AnimatedRouteProps {
  id: string;
  coordinates: Coordinate[];
  strokeColor: string;
  strokeWidth: number;
  zoomOpacity?: number; // Additional opacity modifier based on zoom level (0-1)
}

// Parse color string to extract RGB components
function parseColor(color: string): { r: number; g: number; b: number; a: number } {
  // Handle rgba format
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  // Handle hex format
  const hexMatch = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
      a: 1,
    };
  }

  // Handle short hex format
  const shortHexMatch = color.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
  if (shortHexMatch) {
    return {
      r: parseInt(shortHexMatch[1] + shortHexMatch[1], 16),
      g: parseInt(shortHexMatch[2] + shortHexMatch[2], 16),
      b: parseInt(shortHexMatch[3] + shortHexMatch[3], 16),
      a: 1,
    };
  }

  // Default fallback
  return { r: 128, g: 128, b: 128, a: 1 };
}

export function AnimatedRoute({
  id,
  coordinates,
  strokeColor,
  strokeWidth,
  zoomOpacity = 1,
}: AnimatedRouteProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [opacity, setOpacity] = useState(0);
  const baseColor = useRef(parseColor(strokeColor));

  useEffect(() => {
    baseColor.current = parseColor(strokeColor);
  }, [strokeColor]);

  useEffect(() => {
    // Animate opacity from 0 to 1
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false, // Can't use native driver for color interpolation
    }).start();

    // Listen to animated value changes
    const listenerId = fadeAnim.addListener(({ value }) => {
      setOpacity(value);
    });

    return () => {
      fadeAnim.removeListener(listenerId);
    };
  }, [fadeAnim]);

  // Compute animated stroke color with opacity (apply both fade-in and zoom opacity)
  const { r, g, b, a } = baseColor.current;
  const finalOpacity = a * opacity * zoomOpacity;
  const animatedColor = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;

  return (
    <Polyline
      key={id}
      coordinates={coordinates}
      strokeColor={animatedColor}
      strokeWidth={strokeWidth}
      lineCap="round"
      lineJoin="round"
      geodesic={true}
    />
  );
}
