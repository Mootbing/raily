import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useContext, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { FrequentlyUsedList } from '../components/FrequentlyUsedList';
import { SearchBar } from '../components/SearchBar';
import { TrainList } from '../components/TrainList';
import { SlideUpModalContext } from '../components/ui/slide-up-modal';
import { useTrainContext } from '../context/TrainContext';
import { useFrequentlyUsed } from '../hooks/useFrequentlyUsed';
import { TrainAPIService } from '../services/api';
import { ensureFreshGTFS, hasCachedGTFS, isCacheStale } from '../services/gtfs-sync';
import { TrainStorageService } from '../services/storage';
import type { Train } from '../types/train';
import { COLORS, styles } from './styles';

function SearchResults({ 
  query, 
  onSelectResult 
}: { 
  query: string; 
  onSelectResult: (result: any) => void;
}) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const searchTrains = async () => {
      setLoading(true);
      const searchResults = await TrainAPIService.search(query);
      setResults(searchResults);
      setLoading(false);
    };
    searchTrains();
  }, [query]);

  if (loading) {
    return (
      <View style={styles.frequentlyUsedItem}>
        <Text style={styles.frequentlyUsedName}>Searching...</Text>
      </View>
    );
  }

  return (
    <>
      {results.map((result) => (
        <TouchableOpacity
          key={result.id}
          style={styles.frequentlyUsedItem}
          activeOpacity={0.7}
          onPress={() => onSelectResult(result)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`${result.name}, ${result.subtitle}`}
          accessibilityHint={`Select ${result.type} ${result.name}`}
        >
          <View style={styles.frequentlyUsedIcon}>
            {result.type === 'train' && (
              <Ionicons name="train" size={24} color={COLORS.primary} />
            )}
            {result.type === 'station' && (
              <Ionicons name="location" size={24} color={COLORS.primary} />
            )}
            {result.type === 'route' && (
              <Ionicons name="train" size={24} color={COLORS.primary} />
            )}
          </View>
          <View style={styles.frequentlyUsedText}>
            <Text style={styles.frequentlyUsedName}>{result.name}</Text>
            <Text style={styles.frequentlyUsedSubtitle}>{result.subtitle}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={COLORS.secondary} />
        </TouchableOpacity>
      ))}
    </>
  );
}

export function ModalContent({ onTrainSelect }: { onTrainSelect?: (train: Train) => void }) {
  const { isFullscreen, isCollapsed, scrollOffset, panGesture, snapToPoint } = useContext(SlideUpModalContext);
  const [imageError, setImageError] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { savedTrains, setSavedTrains, setSelectedTrain } = useTrainContext();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshStep, setRefreshStep] = useState('');
  const [refreshPhases, setRefreshPhases] = useState<string[]>([]);
  const searchInputRef = React.useRef<TextInput>(null);
  const { items: frequentlyUsed, refresh: refreshFrequentlyUsed } = useFrequentlyUsed();

  // Load saved trains from storage service
  useEffect(() => {
    const loadSavedTrains = async () => {
      const trains = await TrainStorageService.getSavedTrains();
      setSavedTrains(trains);
    };
    loadSavedTrains();
  }, [setSavedTrains]);

  // Check if GTFS needs refresh on mount (weekly refresh)
  useEffect(() => {
    const checkAndRefreshGTFS = async () => {
      const hasCache = await hasCachedGTFS();
      const stale = await isCacheStale();

      if (!hasCache || stale) {
        // Automatically trigger refresh if no cache or stale
        setIsRefreshing(true);
        setRefreshProgress(0.05);
        setRefreshStep('Checking GTFS cache');
        setIsSearchFocused(false);
        snapToPoint?.('min');

        try {
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
          await refreshFrequentlyUsed();
          setRefreshProgress(1);
          setRefreshStep('Refresh complete');
          setRefreshPhases(prev => prev[prev.length - 1] === 'Refresh complete' ? prev : [...prev, 'Refresh complete']);
        } catch (error) {
          console.error('Auto refresh failed:', error);
          setRefreshStep('Refresh failed');
          setRefreshPhases(prev => prev[prev.length - 1] === 'Refresh failed' ? prev : [...prev, 'Refresh failed']);
        } finally {
          setIsRefreshing(false);
        }
      }
    };

    checkAndRefreshGTFS();
  }, [snapToPoint, refreshFrequentlyUsed]);

  // Store valid tripIds in memory and AsyncStorage
  const [validTripIds, setValidTripIds] = useState<string[]>([]);

  const saveTrain = async (train: Train) => {
    if (!train.tripId) return;
    // Add tripId to memory and AsyncStorage
    setValidTripIds((prev) => {
      if (!prev.includes(train.tripId!)) {
        const updated = [...prev, train.tripId!];
        AsyncStorage.setItem('validTripIds', JSON.stringify(updated));
        return updated;
      }
      return prev;
    });
    // Save train as before
    const saved = await TrainStorageService.saveTrain(train);
    if (saved) {
      const updatedTrains = await TrainStorageService.getSavedTrains();
      setSavedTrains(updatedTrains);
    }
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
      setSearchQuery('');
    }
  }, [isCollapsed, isSearchFocused]);

  // This effect was causing the modal to bounce back to bottom
  // Removed - let users manually control modal position

  return (
    <View style={{ flex: 1 }}>
      {/* Fixed Header */}
      <View>
        <View style={styles.titleRow}>
          <Text style={[styles.title, isCollapsed && styles.titleCollapsed]}>
            {isRefreshing ? 'Fetching' : (isSearchFocused ? 'Add Train' : 'My Trains')}
          </Text>
        </View>
        {!isSearchFocused && !isRefreshing && (
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
              style={isRefreshing ? styles.refreshIconSpinning : undefined}
            />
          </TouchableOpacity>
        )}

        {isRefreshing && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 32 }}>
            <Ionicons name="train" size={48} color={COLORS.secondary} style={{ marginBottom: 16 }} />
            <View style={{ width: 240, alignItems: 'center' }}>
              <Text
                style={[styles.noTrainsText, { marginBottom: 8, fontSize: 14 }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {refreshStep || 'Refreshing GTFS data...'}
              </Text>
              <View style={{ width: '100%', height: 6, backgroundColor: COLORS.border.secondary, borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                <View style={{ height: '100%', backgroundColor: COLORS.accentBlue, borderRadius: 999, width: `${Math.max(5, refreshProgress * 100)}%` }} />
              </View>
              <Text style={[styles.progressValue, { marginBottom: 12, fontSize: 13, fontWeight: '600' }]}>{Math.round(refreshProgress * 100)}%</Text>
              <Text style={[styles.frequentlyUsedSubtitle, { fontSize: 11, textAlign: 'center', fontStyle: 'italic', marginTop: 4 }]}>
                This happens once per week to keep schedules current
              </Text>
            </View>
          </View>
        )}

        {isSearchFocused && (
          <Text style={styles.subtitle}>Add any amtrak train (for now)</Text>
        )}

        {!isRefreshing && (
          <View style={{ paddingHorizontal: 0, marginBottom: 0 }}>
            <SearchBar
              isSearchFocused={isSearchFocused}
              searchQuery={searchQuery}
              setIsSearchFocused={setIsSearchFocused}
              setSearchQuery={setSearchQuery}
              snapToPoint={snapToPoint}
              searchInputRef={searchInputRef}
            />
          </View>
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
      >
        {isSearchFocused && !isCollapsed && (
          <View style={styles.frequentlyUsedSection}>
            <Text style={styles.sectionLabel}>
              {searchQuery ? 'SEARCH RESULTS' : 'FREQUENTLY USED'}
            </Text>
            {searchQuery ? (
              <SearchResults
                query={searchQuery}
                onSelectResult={async (result) => {
                  if (result.type === 'train') {
                    const tripData = result.data as { trip_id: string };
                    const trainObj = await TrainAPIService.getTrainDetails(tripData.trip_id);
                    if (trainObj) {
                      await saveTrain(trainObj);
                      onTrainSelect && onTrainSelect(trainObj);
                      setSearchQuery('');
                      setIsSearchFocused(false);
                    }
                  } else if (result.type === 'station') {
                    const stopData = result.data as { stop_id: string, lat?: number, lon?: number };
                    let lat = result.lat, lon = result.lon;
                    if (lat == null || lon == null) {
                      const stop = (typeof stopData.stop_id === 'string') ? (require('../utils/gtfs-parser').gtfsParser.getStop(stopData.stop_id)) : null;
                      lat = stop?.stop_lat;
                      lon = stop?.stop_lon;
                    }
                    if (lat != null && lon != null) {
                      onTrainSelect && onTrainSelect({ lat, lon });
                      setSearchQuery('');
                      setIsSearchFocused(false);
                    }
                  }
                }}
              />
            ) : (
              <FrequentlyUsedList
                items={frequentlyUsed}
                onSelect={(item) => {
                  // TODO: Implement selection
                }}
              />
            )}
          </View>
        )}
        {!isSearchFocused && !isRefreshing && (
          <TrainList flights={flights} onTrainSelect={(train) => {
            setSelectedTrain(train);
            if (typeof onTrainSelect === 'function') onTrainSelect(train);
          }} />
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
