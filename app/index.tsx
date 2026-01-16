import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import MapView from 'react-native-maps';
import SlideUpModal, { SlideUpModalContext } from '../components/ui/slide-up-modal';
import TrainDetailModal from '../components/ui/train-detail-modal';
import { AppColors, BorderRadius, FontSizes, Spacing } from '../constants/theme';
import { DEFAULT_TRAIN } from '../fixtures/trains';
import { TrainAPIService } from '../services/api';
import { TrainStorageService } from '../services/storage';
import type { Train } from '../types/train';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Use centralized theme constants
const COLORS = AppColors;
const FONTS = {
  family: 'System',
};

// Helper: parse a 12-hour time string (e.g., "3:45 PM") to a Date on baseDate
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

// Helper: get countdown value and unit for train departure
function getCountdownForTrain(train: Train): { value: number; unit: 'DAYS' | 'HOURS' | 'MINUTES' | 'SECONDS'; past: boolean } {
  // If we know it's more than a day away, keep DAYS granularity
  if (train.daysAway && train.daysAway > 0) {
    return { value: Math.round(train.daysAway), unit: 'DAYS', past: false };
  }
  const now = new Date();
  // Base on today by default; a future enhancement could infer actual date
  const baseDate = new Date(now);
  const departDate = parseTimeToDate(train.departTime, baseDate);
  let deltaSec = (departDate.getTime() - now.getTime()) / 1000;
  const past = deltaSec < 0;
  const absSec = Math.abs(deltaSec);

  // Choose the most appropriate unit, rounding to nearest whole number
  let hours = Math.round(absSec / 3600);
  if (hours >= 1) {
    return { value: hours, unit: 'HOURS', past };
  }
  let minutes = Math.round(absSec / 60);
  if (minutes >= 60) {
    // Escalate to 1 hour if rounding pushes to 60
    return { value: 1, unit: 'HOURS', past };
  }
  if (minutes >= 1) {
    return { value: minutes, unit: 'MINUTES', past };
  }
  let seconds = Math.round(absSec);
  if (seconds >= 60) {
    // Escalate to 1 minute if rounding pushes to 60
    return { value: 1, unit: 'MINUTES', past };
  }
  return { value: seconds, unit: 'SECONDS', past };
}

// Search Results Component
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
              <Ionicons name="train" size={24} color={COLORS.accentBlue} />
            )}
            {result.type === 'station' && (
              <Ionicons name="location" size={24} color={COLORS.accentBlue} />
            )}
            {result.type === 'route' && (
              <Ionicons name="train" size={24} color={COLORS.accentBlue} />
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

function ModalContent({ onTrainSelect }: { onTrainSelect: (train: Train) => void }) {
  const { isFullscreen, isCollapsed, scrollOffset, panGesture, snapToPoint } = useContext(SlideUpModalContext);
  const [imageError, setImageError] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedTrains, setSavedTrains] = useState<Train[]>([]);
  const searchInputRef = React.useRef<TextInput>(null);

  // Load saved trains from storage service
  useEffect(() => {
    const loadSavedTrains = async () => {
      const trains = await TrainStorageService.getSavedTrains();
      if (trains.length === 0) {
        // Initialize with default train
        await TrainStorageService.initializeWithDefaults([DEFAULT_TRAIN]);
        setSavedTrains([DEFAULT_TRAIN]);
      } else {
        setSavedTrains(trains);
      }
    };
    loadSavedTrains();
  }, []);

  // Save train using storage service
  const saveTrain = async (train: Train) => {
    const saved = await TrainStorageService.saveTrain(train);
    if (saved) {
      const updatedTrains = await TrainStorageService.getSavedTrains();
      setSavedTrains(updatedTrains);
    }
  };

  const flights = savedTrains;

  const [frequentlyUsed, setFrequentlyUsed] = useState<Array<{
    id: string;
    name: string;
    code: string;
    subtitle: string;
    type: 'train' | 'station';
  }>>([]);

  useEffect(() => {
    const loadFrequentlyUsed = async () => {
      const routes = await TrainAPIService.getRoutes();
      const stops = await TrainAPIService.getStops();
      
      setFrequentlyUsed([
        ...routes.slice(0, 3).map((route, index) => ({
          id: `freq-route-${index}`,
          name: route.route_long_name,
          code: route.route_short_name || route.route_id.substring(0, 3),
          subtitle: `AMT${route.route_id}`,
          type: 'train' as const,
        })),
        ...stops.slice(0, 2).map((stop, index) => ({
          id: `freq-stop-${index}`,
          name: stop.stop_name,
          code: stop.stop_id,
          subtitle: stop.stop_id,
          type: 'station' as const,
        })),
      ]);
    };
    loadFrequentlyUsed();
  }, []);

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
        scrollEnabled={isFullscreen}
        onScroll={(e) => {
          scrollOffset.value = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <View>
          <Text style={[styles.title, isCollapsed && styles.titleCollapsed]}>{isSearchFocused ? 'Add Train' : 'My Trains'}</Text>
          {isSearchFocused && (
            <Text style={styles.subtitle}>Add any amtrak train (for now)</Text>
          )}
          
          {isSearchFocused ? (
            <View style={[styles.searchContainer, isCollapsed && styles.searchContainerCollapsed]}>
              <Ionicons name="search" size={20} color="#888" />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder={"Northeast Regional, BOS, or NER123"}
                placeholderTextColor={COLORS.secondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onBlur={() => {
                  setIsSearchFocused(false);
                  snapToPoint?.('half');
                }}
                accessible={true}
                accessibilityLabel="Search for trains or stations"
                accessibilityHint="Enter train name, station name, or route to search"
                autoFocus
              />
              <TouchableOpacity 
                onPress={() => {
                  setIsSearchFocused(false);
                  snapToPoint?.('half');
                }} 
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Close search"
              >
                <Ionicons name="close-circle" size={20} color="#888" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.searchContainer, isCollapsed && styles.searchContainerCollapsed]}
              activeOpacity={0.7}
              onPress={() => {
                setIsSearchFocused(true);
                snapToPoint?.('max');
                setTimeout(() => {
                  searchInputRef.current?.focus();
                }, 50);
              }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Search to add trains"
              accessibilityHint="Tap to start searching"
            >
              <Ionicons name="search" size={20} color="#888" />
              <Text style={styles.searchButtonText}>Search to add trains</Text>
            </TouchableOpacity>
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
                      onTrainSelect(trainObj);
                      setSearchQuery('');
                      setIsSearchFocused(false);
                    }
                  } else if (result.type === 'station') {
                    // For stations, get the first train that stops there
                    const stopData = result.data as { stop_id: string };
                    const trains = await TrainAPIService.getTrainsForStation(stopData.stop_id);
                    if (trains.length > 0) {
                      await saveTrain(trains[0]);
                      onTrainSelect(trains[0]);
                      setSearchQuery('');
                      setIsSearchFocused(false);
                    }
                  }
                }}
              />
            ) : (
              frequentlyUsed.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.frequentlyUsedItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    // Handle selection
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${item.subtitle}`}
                  accessibilityHint={`Select ${item.type === 'train' ? 'train route' : 'station'} ${item.name}`}
                >
                  <View style={styles.frequentlyUsedIcon}>
                    {item.type === 'train' && (
                      <Ionicons name="train" size={24} color={COLORS.accentBlue} />
                    )}
                    {item.type === 'station' && (
                      <Ionicons name="location" size={24} color={COLORS.accentBlue} />
                    )}
                  </View>
                  <View style={styles.frequentlyUsedText}>
                    <Text style={styles.frequentlyUsedName}>{item.name}</Text>
                    <Text style={styles.frequentlyUsedSubtitle}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color={COLORS.secondary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
        {!isSearchFocused && !isCollapsed && (
          flights.length === 0 ? (
            <View style={styles.noTrainsContainer}>
              <Ionicons name="train" size={48} color={COLORS.secondary} />
              <Text style={styles.noTrainsText}>no trains yet...</Text>
            </View>
          ) : (
            flights.map((flight, index) => {
              const countdown = getCountdownForTrain(flight);
              const unitLabel = `${countdown.unit}${countdown.past ? ' AGO' : ''}`;
              return (
              <TouchableOpacity 
                key={flight.id} 
                style={styles.flightCard}
                onPress={() => {
                  onTrainSelect(flight);
                }}
                activeOpacity={0.7}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={`Train ${flight.flightNumber} from ${flight.from} to ${flight.to}`}
                accessibilityHint={`Departs at ${flight.departTime} (${countdown.value} ${countdown.unit.toLowerCase()} ${countdown.past ? 'ago' : 'from now'}), arrives at ${flight.arriveTime}. Tap to view details`}
              >
                <View style={styles.flightLeft}>
                  <Text style={styles.daysAway}>{countdown.value}</Text>
                  <Text style={styles.daysLabel}>{unitLabel}</Text>
                </View>
                
                <View style={styles.flightCenter}>
                  <View style={styles.flightHeader}>
                    {imageError ? (
                      <Ionicons name="train" size={16} color={COLORS.accent} />
                    ) : (
                      <Image
                        source={require('../assets/images/amtrak.png')}
                        style={styles.amtrakLogo}
                        fadeDuration={0}
                        onError={() => setImageError(true)}
                      />
                    )}
                    <Text style={styles.flightNumber}>{flight.airline} {flight.flightNumber}</Text>
                    <Text style={styles.flightDate}>{flight.date}</Text>
                  </View>
                  
                  <Text style={styles.route}>{flight.from} to {flight.to}</Text>
                  
                  <View style={styles.timeRow}>
                    <View style={styles.timeInfo}>
                      <View style={[styles.arrowIcon, styles.departureIcon]}>
                        <MaterialCommunityIcons name="arrow-top-right" size={8} color="rgba(255, 255, 255, 0.5)" />
                      </View>
                      <Text style={styles.timeCode}>{flight.fromCode}</Text>
                      <Text style={styles.timeValue}>{flight.departTime}</Text>
                    </View>
                    
                    <View style={styles.timeInfo}>
                      <View style={[styles.arrowIcon, styles.arrivalIcon]}>
                        <MaterialCommunityIcons name="arrow-bottom-left" size={8} color="rgba(255, 255, 255, 0.5)" />
                      </View>
                      <Text style={styles.timeCode}>{flight.toCode}</Text>
                      <Text style={styles.timeValue}>
                        {flight.arriveTime}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
            })
          )
        )}
      </ScrollView>
    </GestureDetector>
  );
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const mainModalRef = useRef<any>(null);
  const [selectedTrain, setSelectedTrain] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      // Get initial location and set region
      const location = await Location.getCurrentPositionAsync({});
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 1000);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        showsUserLocation={true}
        showsTraffic={false}
        showsIndoors={true}
        userLocationAnnotationTitle="Your Location"
      />
      
      <SlideUpModal ref={mainModalRef}>
        <ModalContent onTrainSelect={(train) => {
          setSelectedTrain(train);
          setShowDetailModal(true);
        }} />
      </SlideUpModal>

      {showDetailModal && selectedTrain && (
        <View style={styles.detailModalContainer}>
          <SlideUpModal onDismiss={() => setShowDetailModal(false)}>
            <TrainDetailModal 
              train={selectedTrain}
              onClose={() => setShowDetailModal(false)}
            />
          </SlideUpModal>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  detailModalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: FontSizes.title,
    fontWeight: 'bold',
    fontFamily: FONTS.family,
    color: COLORS.primary,
    marginBottom: Spacing.md,
  },
  titleCollapsed: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.flightDate,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.secondary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: COLORS.border.secondary,
  },
  searchContainerCollapsed: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    color: COLORS.primary,
    fontSize: FontSizes.searchLabel,
    fontFamily: FONTS.family,
  },
  frequentlyUsedSection: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSizes.timeLabel,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
    fontWeight: '600',
  },
  frequentlyUsedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
  },
  searchButtonText: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    color: COLORS.secondary,
    fontSize: FontSizes.searchLabel,
    fontFamily: FONTS.family,
  },
  frequentlyUsedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  frequentlyUsedText: {
    flex: 1,
  },
  frequentlyUsedName: {
    fontSize: FontSizes.searchLabel,
    fontFamily: FONTS.family,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  frequentlyUsedSubtitle: {
    fontSize: FontSizes.daysLabel,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
  },
  noTrainsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  noTrainsText: {
    fontSize: FontSizes.flightDate,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
  },
  flightCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.background.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: COLORS.border.primary,
  },
  flightLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.lg,
    minWidth: 60,
  },
  daysAway: {
    fontSize: FontSizes.daysAway,
    fontWeight: 'bold',
    fontFamily: FONTS.family,
    color: COLORS.primary,
    lineHeight: 36,
  },
  daysLabel: {
    fontSize: FontSizes.daysLabel,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
    marginTop: Spacing.xs,
    letterSpacing: 0.5,
  },
  flightCenter: {
    flex: 1,
  },
  flightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  amtrakLogo: {
    width: 16,
    height: 16,
    marginRight: 3,
    resizeMode: 'contain',
  },
  flightNumber: {
    fontSize: FontSizes.flightNumber,
    fontFamily: FONTS.family,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: 3,
    marginRight: Spacing.md,
  },
  flightDate: {
    fontSize: FontSizes.flightDate,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
    marginLeft: 'auto',
  },
  route: {
    fontSize: FontSizes.route,
    fontWeight: '600',
    fontFamily: FONTS.family,
    color: COLORS.primary,
    marginBottom: Spacing.md,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arrowIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  departureIcon: {
    backgroundColor: COLORS.tertiary,
  },
  arrivalIcon: {
    backgroundColor: COLORS.tertiary,
  },
  timeCode: {
    fontSize: FontSizes.timeCode,
    fontFamily: FONTS.family,
    color: COLORS.secondary,
    marginRight: Spacing.sm,
  },
  timeValue: {
    fontSize: FontSizes.timeValue,
    fontFamily: FONTS.family,
    color: COLORS.primary,
    fontWeight: '500',
  },
});
