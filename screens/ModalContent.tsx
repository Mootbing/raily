import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { TrainList } from '../components/TrainList';
import { TwoStationSearch } from '../components/TwoStationSearch';
import { SlideUpModalContext } from '../components/ui/slide-up-modal';
import { useTrainContext } from '../context/TrainContext';
import { useFrequentlyUsed } from '../hooks/useFrequentlyUsed';
import { ensureFreshGTFS, hasCachedGTFS, isCacheStale, loadCachedGTFS } from '../services/gtfs-sync';
import { TrainStorageService } from '../services/storage';
import type { SavedTrainRef, Train } from '../types/train';
import { COLORS, styles } from './styles';

export function ModalContent({ onTrainSelect }: { onTrainSelect?: (train: Train) => void }) {
  const { isFullscreen, isCollapsed, scrollOffset, panGesture, snapToPoint, setGestureEnabled } = useContext(SlideUpModalContext);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { savedTrains, setSavedTrains, setSelectedTrain } = useTrainContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingCache, setIsLoadingCache] = useState(true); // Start true - loading on mount
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshStep, setRefreshStep] = useState('');
  const [refreshPhases, setRefreshPhases] = useState<string[]>([]);
  const { refresh: refreshFrequentlyUsed } = useFrequentlyUsed();

  // Refs to avoid stale closures in useEffect
  const refreshFrequentlyUsedRef = useRef(refreshFrequentlyUsed);
  refreshFrequentlyUsedRef.current = refreshFrequentlyUsed;
  const snapToPointRef = useRef(snapToPoint);
  snapToPointRef.current = snapToPoint;

  // Combined loading state for UI
  const isLoading = isRefreshing || isLoadingCache;

  // Track if initialization has run
  const hasInitialized = useRef(false);

  // Load saved trains from storage service (after GTFS is loaded)
  useEffect(() => {
    // Only load trains after GTFS data is ready
    if (isLoading) return;

    const loadSavedTrains = async () => {
      const trains = await TrainStorageService.getSavedTrains();
      setSavedTrains(trains);
    };
    loadSavedTrains();
  }, [setSavedTrains, isLoading]);

  // Disable modal resizing when loading or refreshing GTFS data
  useEffect(() => {
    setGestureEnabled?.(!isLoading);
  }, [isLoading, setGestureEnabled]);

  // Load cached GTFS and check if refresh is needed on mount (runs once)
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initializeGTFS = async () => {
      setIsLoadingCache(true);
      setRefreshStep('Loading cached data...');
      setRefreshProgress(0.1);
      snapToPointRef.current?.('min');

      try {
        // First, try to load from cache
        const loaded = await loadCachedGTFS();

        if (loaded) {
          // Cache loaded successfully, check if it's stale
          const stale = await isCacheStale();
          if (stale) {
            // Cache is stale, need to refresh
            setIsLoadingCache(false);
            setIsRefreshing(true);
            setRefreshProgress(0.05);
            setRefreshStep('Checking GTFS cache');

            setRefreshPhases([]);
            await ensureFreshGTFS((update) => {
              setRefreshProgress(update.progress);
              setRefreshStep(update.step + (update.detail ? ` • ${update.detail}` : ''));
              setRefreshPhases(prev => {
                if (prev.length === 0 || prev[prev.length - 1] !== update.step) {
                  return [...prev, update.step];
                }
                return prev;
              });
            });
            await refreshFrequentlyUsedRef.current();
            setRefreshProgress(1);
            setRefreshStep('Refresh complete');
            setIsRefreshing(false);
          } else {
            // Cache is fresh, we're done
            setRefreshProgress(1);
            setRefreshStep('Ready');
            setIsLoadingCache(false);
          }
        } else {
          // No cache, need to fetch fresh data
          setIsLoadingCache(false);
          setIsRefreshing(true);
          setRefreshProgress(0.05);
          setRefreshStep('Downloading schedule data');

          setRefreshPhases([]);
          await ensureFreshGTFS((update) => {
            setRefreshProgress(update.progress);
            setRefreshStep(update.step + (update.detail ? ` • ${update.detail}` : ''));
            setRefreshPhases(prev => {
              if (prev.length === 0 || prev[prev.length - 1] !== update.step) {
                return [...prev, update.step];
              }
              return prev;
            });
          });
          await refreshFrequentlyUsedRef.current();
          setRefreshProgress(1);
          setRefreshStep('Refresh complete');
          setIsRefreshing(false);
        }
      } catch (error) {
        console.error('GTFS initialization failed:', error);
        setRefreshStep('Failed to load data');
        setIsLoadingCache(false);
        setIsRefreshing(false);
      }
    };

    initializeGTFS();
  }, []);

  // Save train with segmentation support
  const saveTrainWithSegment = async (tripId: string, fromCode: string, toCode: string, travelDate: Date) => {
    const ref: SavedTrainRef = {
      tripId,
      fromCode,
      toCode,
      travelDate: travelDate.getTime(),
      savedAt: Date.now(),
    };
    const saved = await TrainStorageService.saveTrainRef(ref);
    if (saved) {
      const updatedTrains = await TrainStorageService.getSavedTrains();
      setSavedTrains(updatedTrains);
    }
    return saved;
  };

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshProgress(0.05);
    setRefreshStep('Checking GTFS cache');
    setIsSearchFocused(false); // Hide search bar
    snapToPoint?.('min'); // Collapse to 35%
    try {
      setRefreshPhases([]);
      const result = await ensureFreshGTFS((update) => {
        setRefreshProgress(update.progress);
        setRefreshStep(update.step + (update.detail ? ` • ${update.detail}` : ''));
        setRefreshPhases(prev => {
          // Only add if not already present as last
          if (prev.length === 0 || prev[prev.length - 1] !== update.step) {
            return [...prev, update.step];
          }
          return prev;
        });
      });
      if (result.usedCache) {
        setIsRefreshing(false);
        Alert.alert(
          'Use Cached GTFS?',
          'Cached GTFS is being used. Do you want to force a full refresh and fetch the latest GTFS data?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Refresh Anyway', style: 'destructive', onPress: handleForceRefresh }
          ]
        );
        return;
      }
      await refreshFrequentlyUsed();
      setRefreshProgress(1);
      setRefreshStep('Refresh complete');
      setRefreshPhases(prev => prev[prev.length - 1] === 'Refresh complete' ? prev : [...prev, 'Refresh complete']);
      Alert.alert('Refresh Complete', 'GTFS data has been refreshed successfully.');
    } catch (error) {
      console.error('Manual refresh failed:', error);
      setRefreshStep('Refresh failed');
      setRefreshPhases(prev => prev[prev.length - 1] === 'Refresh failed' ? prev : [...prev, 'Refresh failed']);
      Alert.alert('Refresh Failed', 'An error occurred while refreshing GTFS data.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    setRefreshProgress(0.05);
    setRefreshStep('Forcing GTFS refresh');
    setIsSearchFocused(false);
    snapToPoint?.('min');
    try {
      setRefreshPhases([]);
      // Force refresh by clearing last fetch
      await AsyncStorage.removeItem('GTFS_LAST_FETCH');
      await ensureFreshGTFS((update) => {
        setRefreshProgress(update.progress);
        setRefreshStep(update.step + (update.detail ? ` • ${update.detail}` : ''));
        setRefreshPhases(prev => {
          if (prev.length === 0 || prev[prev.length - 1] !== update.step) {
            return [...prev, update.step];
          }
          return prev;
        });
      });
      await refreshFrequentlyUsed();
      setRefreshProgress(1);
      setRefreshStep('Refresh complete');
      setRefreshPhases(prev => prev[prev.length - 1] === 'Refresh complete' ? prev : [...prev, 'Refresh complete']);
      Alert.alert('Refresh Complete', 'GTFS data has been refreshed successfully.');
    } catch (error) {
      console.error('Manual refresh failed:', error);
      setRefreshStep('Refresh failed');
      setRefreshPhases(prev => prev[prev.length - 1] === 'Refresh failed' ? prev : [...prev, 'Refresh failed']);
      Alert.alert('Refresh Failed', 'An error occurred while refreshing GTFS data.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const flights = savedTrains;

  // Exit search mode when modal is collapsed
  useEffect(() => {
    if (isCollapsed && isSearchFocused) {
      setIsSearchFocused(false);
    }
  }, [isCollapsed, isSearchFocused]);

  const handleOpenSearch = () => {
    snapToPoint?.('max');
    setIsSearchFocused(true);
  };

  const handleCloseSearch = () => {
    setIsSearchFocused(false);
    snapToPoint?.('min');
  };

  const handleSelectTrip = async (tripId: string, fromCode: string, toCode: string, date: Date) => {
    await saveTrainWithSegment(tripId, fromCode, toCode, date);
    setIsSearchFocused(false);
    snapToPoint?.('min');
  };

  const handleDeleteTrain = async (train: Train) => {
    await TrainStorageService.deleteTrainByTripId(train.tripId || '', train.fromCode, train.toCode);
    const updatedTrains = await TrainStorageService.getSavedTrains();
    setSavedTrains(updatedTrains);
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Fixed Header */}
      <View>
        <View style={styles.titleRow}>
          <Text style={styles.title}>
            {isLoading ? (isLoadingCache ? 'Loading' : 'Fetching') : (isSearchFocused ? 'Add Train' : 'My Trains')}
          </Text>
        </View>
        {!isSearchFocused && !isLoading && (
          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.refreshButton}
            activeOpacity={0.7}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Refresh train schedules"
          >
            <Ionicons
              name="refresh"
              size={24}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        )}

        {isLoading && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
            <Ionicons name="train" size={48} color={COLORS.secondary} style={{ marginBottom: 16 }} />
            <View style={{ width: 240, alignItems: 'center' }}>
              <Text
                style={[styles.noTrainsText, { marginBottom: 8, fontSize: 14 }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {refreshStep || (isLoadingCache ? 'Loading cached data...' : 'Refreshing GTFS data...')}
              </Text>
              <View style={{ width: '100%', height: 6, backgroundColor: COLORS.border.secondary, borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                <View style={{ height: '100%', backgroundColor: COLORS.accentBlue, borderRadius: 999, width: `${Math.max(5, refreshProgress * 100)}%` }} />
              </View>
              <Text style={[styles.progressValue, { marginBottom: 12, fontSize: 13, fontWeight: '600' }]}>{Math.round(refreshProgress * 100)}%</Text>
              {!isLoadingCache && (
                <Text style={[styles.frequentlyUsedSubtitle, { fontSize: 11, textAlign: 'center', fontStyle: 'italic', marginTop: 4 }]}>
                  This happens once per week to keep schedules current
                </Text>
              )}
            </View>
          </View>
        )}

        {isSearchFocused && (
          <Text style={styles.subtitle}>Enter departure and arrival stations</Text>
        )}

        {/* Search Button (when not searching) */}
        {!isLoading && !isSearchFocused && (
          <TouchableOpacity
            style={styles.searchContainer}
            activeOpacity={0.7}
            onPress={handleOpenSearch}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Add a train"
          >
            <Ionicons name="search" size={20} color={COLORS.secondary} />
            <Text style={styles.searchButtonText}>Start your journey...</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={isFullscreen}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y;
          scrollOffset.value = offsetY;
        }}
        scrollEventThrottle={16}
        simultaneousHandlers={panGesture}
        keyboardShouldPersistTaps="handled"
      >
        {isSearchFocused && !isCollapsed && (
          <TwoStationSearch
            onSelectTrip={handleSelectTrip}
            onClose={handleCloseSearch}
          />
        )}
        {!isSearchFocused && !isLoading && (
          <TrainList
            flights={flights}
            onTrainSelect={(train) => {
              setSelectedTrain(train);
              if (typeof onTrainSelect === 'function') onTrainSelect(train);
            }}
            onDeleteTrain={handleDeleteTrain}
          />
        )}
      </ScrollView>
    </View>
  );
}

function parseTimeToDate(timeStr: string, baseDate: Date): Date {
  const [time, meridian] = timeStr.split(' ');
  const [hStr, mStr] = time.split(':');
  let hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  const isPM = (meridian || '').toUpperCase() === 'PM';
  if (isPM && hours !== 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function getCountdownForTrain(train: Train): { value: number; unit: 'DAYS' | 'HOURS' | 'MINUTES' | 'SECONDS'; past: boolean } {
  if (train.daysAway && train.daysAway > 0) {
    return { value: Math.round(train.daysAway), unit: 'DAYS', past: false };
  }
  const now = new Date();
  const baseDate = new Date(now);
  const departDate = parseTimeToDate(train.departTime, baseDate);
  let deltaSec = (departDate.getTime() - now.getTime()) / 1000;
  const past = deltaSec < 0;
  const absSec = Math.abs(deltaSec);

  let hours = Math.round(absSec / 3600);
  if (hours >= 1) return { value: hours, unit: 'HOURS', past };
  let minutes = Math.round(absSec / 60);
  if (minutes >= 60) return { value: 1, unit: 'HOURS', past };
  if (minutes >= 1) return { value: minutes, unit: 'MINUTES', past };
  let seconds = Math.round(absSec);
  if (seconds >= 60) return { value: 1, unit: 'MINUTES', past };
  return { value: seconds, unit: 'SECONDS', past };
}
