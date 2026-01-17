import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { ensureFreshGTFS, hasCachedGTFS, isCacheStale } from '../services/gtfs-sync';

export const unstable_settings = {
  anchor: '/',
};

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  const [needsFetch, setNeedsFetch] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Determine if we need to show loading (no cache or stale)
      const hasCache = await hasCachedGTFS();
      const stale = await isCacheStale();
      setNeedsFetch(!hasCache || stale);
      const { usedCache } = await ensureFreshGTFS();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  if (loading && needsFetch) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingTitle}>Fetching Latest Schedules</Text>
          <Text style={styles.loadingSubtitle}>
            Downloading fresh Amtrak GTFS data with all routes, stations, and real-time trip schedules
          </Text>
          <Text style={styles.loadingNote}>This happens once per week to keep your data current</Text>
        </View>
        <StatusBar style="auto" />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginTop: 8,
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingNote: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
});
