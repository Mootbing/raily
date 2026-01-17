import MapScreen from '../screens/MapScreen';

export default MapScreen;
/* Legacy code below retained but disabled for mobile-only refactor.
  }, []);

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
    snapToPoint('max'); // Expand to fullscreen loading screen
    try {
      await ensureFreshGTFS();
      // Reload frequently used after refresh
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
    } catch (error) {
      console.error('Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
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
          <View style={styles.titleRow}>
            <Text style={[styles.title, isCollapsed && styles.titleCollapsed]}>{isSearchFocused ? 'Add Train' : 'My Trains'}</Text>
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
                  color={isRefreshing ? COLORS.secondary : COLORS.accentBlue}
                  style={isRefreshing ? styles.refreshIconSpinning : undefined}
                />
              </TouchableOpacity>
            )}
          </View>
          {isSearchFocused && (
            <Text style={styles.subtitle}>Add any amtrak train (for now)</Text>
          )}
          
          {isSearchFocused ? (
            <View style={styles.searchContainer}>
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
              style={styles.searchContainer}
              activeOpacity={0.7}
              onPress={() => {
                setIsSearchFocused(true);
                snapToPoint?.('max');
                // Wait for modal animation to complete before focusing
                setTimeout(() => {
                  searchInputRef.current?.focus();
                }, 300);
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
                      <Ionicons name="train" size={24} color="#8B5CF6" />
                    )}
                    {item.type === 'station' && (
                      <Ionicons name="location" size={24} color="#10B981" />
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
                    {flight.realtime?.status && (
                      <View style={[
                        styles.realtimeBadge,
                        flight.realtime.delay && flight.realtime.delay > 0 ? styles.delayedBadge : styles.onTimeBadge
                      ]}>
                        <Text style={styles.realtimeBadgeText}>{flight.realtime.status}</Text>
                      </View>
                    )}
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

function MapScreenLocal() {
  const mapRef = useRef<MapView>(null);
  const mainModalRef = useRef<any>(null);
  const [selectedTrain, setSelectedTrain] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [stations, setStations] = useState<Array<{ id: string; name: string; lat: number; lon: number }>>([]);
  const [visibleShapes, setVisibleShapes] = useState<Array<{ id: string; coordinates: Array<{ latitude: number; longitude: number }> }>>([]);
  const [savedTrains, setSavedTrains] = useState<Train[]>([]);
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

      // Load all stations directly - no lazy loading
      const allStops = gtfsParser.getAllStops();
      setStations(allStops.map(stop => ({
        id: stop.stop_id,
        name: stop.stop_name,
        lat: stop.stop_lat,
        lon: stop.stop_lon,
      })));

      // Initialize shape loader with all shapes
      const rawShapes = gtfsParser.getRawShapesData();
      shapeLoader.initialize(rawShapes);

      // Get initial visible shapes based on current region
      const bounds = {
        minLat: region.latitude - region.latitudeDelta / 2,
        maxLat: region.latitude + region.latitudeDelta / 2,
        minLon: region.longitude - region.longitudeDelta / 2,
        maxLon: region.longitude + region.longitudeDelta / 2,
      };
      setVisibleShapes(shapeLoader.getVisibleShapes(bounds));

      // Load saved trains and fetch real-time data
      const trains = await TrainStorageService.getSavedTrains();
      const trainsWithRealtime = await Promise.all(
        trains.map(train => TrainAPIService.refreshRealtimeData(train))
      );
      setSavedTrains(trainsWithRealtime);
    })();
  }, []);

  // Update visible shapes and stations when viewport changes
  const handleRegionChange = (newRegion: any) => {
    setRegion(newRegion);

    // Query viewport bounds
    const bounds = {
      minLat: newRegion.latitude - newRegion.latitudeDelta / 2,
      maxLat: newRegion.latitude + newRegion.latitudeDelta / 2,
      minLon: newRegion.longitude - newRegion.longitudeDelta / 2,
      maxLon: newRegion.longitude + newRegion.longitudeDelta / 2,
    };

    // Get visible shapes using shape loader
    const visible = shapeLoader.getVisibleShapes(bounds);
    setVisibleShapes(visible);
  };

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
        provider={PROVIDER_DEFAULT}
        onRegionChange={handleRegionChange}
      >
        {/* Route Polylines - Only visible in current viewport */}
        {visibleShapes.map((shape) => (
          <Polyline
            key={shape.id}
            coordinates={shape.coordinates}
            strokeColor="#FFFFFF"
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
          />
        ))}

        {/* Station Markers */}
        {stations.map((station) => (
          <Marker
            key={station.id}
            coordinate={{ latitude: station.lat, longitude: station.lon }}
            title={station.name}
            description={station.id}
          >
            <Ionicons name="location" size={24} color="#FFFFFF" />
          </Marker>
        ))}

        {/* Live Train Positions */}
        {savedTrains
          .filter(train => train.realtime?.position)
          .map((train) => (
            <Marker
              key={`live-${train.id}`}
              coordinate={{ 
                latitude: train.realtime!.position!.lat, 
                longitude: train.realtime!.position!.lon 
              }}
              title={`Train ${train.flightNumber}`}
              description={train.realtime?.status || 'Live'}
              onPress={() => {
                setSelectedTrain(train);
                setShowDetailModal(true);
              }}
            >
              <View style={styles.liveTrainMarker}>
                <Ionicons name="navigate" size={20} color="white" />
              </View>
            </Marker>
          ))}
      </MapView>
      
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

export default MapScreen;

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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSizes.title,
    fontWeight: 'bold',
    fontFamily: FONTS.family,
    color: COLORS.primary,
  },
  titleCollapsed: {
    marginBottom: Spacing.sm,
  },
  refreshButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIconSpinning: {
    opacity: 0.5,
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
  liveTrainMarker: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  realtimeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 8,
  },
  onTimeBadge: {
    backgroundColor: '#10B981',
  },
  delayedBadge: {
    backgroundColor: '#EF4444',
  },
  realtimeBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
});
*/
