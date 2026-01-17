import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useContext, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { FrequentlyUsedList } from '../components/FrequentlyUsedList';
import { SearchBar } from '../components/SearchBar';
import { TrainList } from '../components/TrainList';
import { SlideUpModalContext } from '../components/ui/slide-up-modal';
import { useTrainContext } from '../context/TrainContext';
import { useFrequentlyUsed } from '../hooks/useFrequentlyUsed';
import { TrainAPIService } from '../services/api';
import { ensureFreshGTFS } from '../services/gtfs-sync';
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
              <Ionicons name="train" size={24} color="#0066CC" />
            )}
            {result.type === 'station' && (
              <Ionicons name="location" size={24} color="#10B981" />
            )}
            {result.type === 'route' && (
              <Ionicons name="train" size={24} color="#8B5CF6" />
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
  const searchInputRef = React.useRef<TextInput>(null);
  const { items: frequentlyUsed, refresh: refreshFrequentlyUsed } = useFrequentlyUsed();
  const [isHeaderStuck, setIsHeaderStuck] = useState(false);

  // Load saved trains from storage service
  useEffect(() => {
    const { DEFAULT_TRAIN, SAMPLE_TRAINS } = require('../fixtures/trains');
    const loadSavedTrains = async () => {
      const trains = await TrainStorageService.getSavedTrains();
      if (trains.length === 0) {
        // Initialize with several default trains
        await TrainStorageService.initializeWithDefaults(SAMPLE_TRAINS);
        setSavedTrains(SAMPLE_TRAINS);
      } else {
        setSavedTrains(trains);
      }
    };
    loadSavedTrains();
  }, [setSavedTrains]);

  // Save train using storage service
  const saveTrain = async (train: Train) => {
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
      await ensureFreshGTFS((update) => {
        setRefreshProgress(update.progress);
        setRefreshStep(update.step + (update.detail ? ` • ${update.detail}` : ''));
      });
      await refreshFrequentlyUsed();
      setRefreshProgress(1);
      setRefreshStep('Refresh complete');
    } catch (error) {
      console.error('Manual refresh failed:', error);
      setRefreshStep('Refresh failed');
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

  return (
    <GestureDetector gesture={panGesture}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
        scrollEnabled={isFullscreen}
        onScroll={(e) => {
          const offsetY = e.nativeEvent.contentOffset.y;
          scrollOffset.value = offsetY;
          setIsHeaderStuck(offsetY > 0);
        }}
        scrollEventThrottle={16}
        simultaneousHandlers={panGesture}
      >
        <BlurView 
          intensity={isHeaderStuck ? 80 : 0} 
          tint="dark" 
          style={[
            styles.stickyHeader,
            isHeaderStuck && styles.stickyHeaderStuck
          ]}
        >
          <View style={styles.titleRow}>
            <Text style={[styles.title, isCollapsed && styles.titleCollapsed]}>{isSearchFocused ? 'Add Train' : 'My Trains'}</Text>
          </View>
          {/* Absolutely positioned refresh button */}
          {!isSearchFocused && (
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={isRefreshing}
              style={styles.refreshButton}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Refresh train schedules"
            >
              <Ionicons 
                name="refresh" 
                size={24} 
                color={'#fff'}
                style={isRefreshing ? styles.refreshIconSpinning : undefined}
              />
            </TouchableOpacity>
          )}
        </BlurView>
        <View>
          {isRefreshing && (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Refreshing schedules</Text>
                <Text style={styles.progressValue}>{Math.round(refreshProgress * 100)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${Math.max(5, refreshProgress * 100)}%` }]} />
              </View>
              <Text style={styles.progressStep}>{refreshStep || 'Working...'}</Text>
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
                    // For trains, get train details from API
                    const tripData = result.data as { trip_id: string };
                    const trainObj = await TrainAPIService.getTrainDetails(tripData.trip_id);
                    if (trainObj) {
                      await saveTrain(trainObj);
                      onTrainSelect && onTrainSelect(trainObj);
                      setSearchQuery('');
                      setIsSearchFocused(false);
                    }
                  } else if (result.type === 'station') {
                    // For stations, get the first train that stops there
                    const stopData = result.data as { stop_id: string };
                    const trains = await TrainAPIService.getTrainsForStation(stopData.stop_id);
                    if (trains.length > 0) {
                      await saveTrain(trains[0]);
                      onTrainSelect && onTrainSelect(trains[0]);
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
    </GestureDetector>
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
