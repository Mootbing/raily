import * as Location from 'expo-location';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import MapView, { PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedRoute } from '../components/map/AnimatedRoute';
import { AnimatedStationMarker } from '../components/map/AnimatedStationMarker';
import { LiveTrainMarker } from '../components/map/LiveTrainMarker';
import MapSettingsPill, { MapType, RouteMode, StationMode, TrainMode } from '../components/map/MapSettingsPill';
import DepartureBoardModal from '../components/ui/departure-board-modal';
import SlideUpModal from '../components/ui/slide-up-modal';
import TrainDetailModal from '../components/ui/train-detail-modal';
import { AppColors } from '../constants/theme';
import { ModalProvider, useModalContext } from '../context/ModalContext';
import { TrainProvider, useTrainContext } from '../context/TrainContext';
import { useLiveTrains } from '../hooks/useLiveTrains';
import { useRealtime } from '../hooks/useRealtime';
import { useShapes } from '../hooks/useShapes';
import { useStations } from '../hooks/useStations';
import { TrainAPIService } from '../services/api';
import type { ViewportBounds } from '../services/shape-loader';
import { TrainStorageService } from '../services/storage';
import type { Stop, Train } from '../types/train';
import { gtfsParser } from '../utils/gtfs-parser';
import { getRouteColor, getStrokeWidthForZoom } from '../utils/route-colors';
import { ClusteringConfig } from '../utils/clustering-config';
import { clusterStations, getStationAbbreviation } from '../utils/station-clustering';
import { clusterTrains } from '../utils/train-clustering';
import { logger } from '../utils/logger';
import { ModalContent } from './ModalContent';
import { styles } from './styles';

// Convert map region to viewport bounds for lazy loading
function regionToViewportBounds(region: {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}): ViewportBounds {
  return {
    minLat: region.latitude - region.latitudeDelta / 2,
    maxLat: region.latitude + region.latitudeDelta / 2,
    minLon: region.longitude - region.longitudeDelta / 2,
    maxLon: region.longitude + region.longitudeDelta / 2,
  };
}

/**
 * Calculate latitude offset for map centering based on modal state.
 * When modal is at 50%, center point at 20% from top (40% of visible area).
 * When no modal or fullscreen, center normally (no offset).
 */
function getLatitudeOffsetForModal(latitudeDelta: number, modalSnap: 'min' | 'half' | 'max' | null): number {
  if (modalSnap === 'half') {
    // Modal covers 50% of screen, visible map is top 50%
    // To place point at 20% from top of screen = 40% of visible area
    // Offset = 30% of latitudeDelta (move center down so point appears higher)
    return latitudeDelta * 0.3;
  }
  // No offset for fullscreen modal, collapsed modal, or no modal
  return 0;
}

function MapScreenInner() {
  const mapRef = useRef<MapView>(null);

  // Use centralized modal context
  const {
    showMain,
    showTrainDetail,
    showDepartureBoard,
    mainModalRef,
    detailModalRef,
    departureBoardRef,
    modalData,
    navigateToTrain,
    navigateToStation,
    navigateToMain,
    goBack,
    handleModalDismissed,
    handleSnapChange,
    getInitialSnap,
    currentSnap,
  } = useModalContext();

  const [region, setRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  // Debounced viewport bounds for lazy loading (updates less frequently than region)
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapType, setMapType] = useState<MapType>('standard');
  const [routeMode, setRouteMode] = useState<RouteMode>('visible');
  const [stationMode, setStationMode] = useState<StationMode>('auto');
  const [trainMode, setTrainMode] = useState<TrainMode>('all');
  const { savedTrains, setSavedTrains, selectedTrain, setSelectedTrain } = useTrainContext();
  const insets = useSafeAreaInsets();

  // Use lazy-loaded stations and shapes based on viewport
  const stations = useStations(viewportBounds ?? undefined);
  const { visibleShapes } = useShapes(viewportBounds ?? undefined);

  // Fetch all live trains from GTFS-RT (only when trainMode is 'all')
  const { liveTrains } = useLiveTrains(15000, trainMode === 'all');

  // Handle train selection from list - animate map if has position, navigate to detail
  const handleTrainSelect = useCallback(
    (train: Train) => {
      setSelectedTrain(train);

      // If train has realtime position, animate map to that location
      const fromMarker = !!train.realtime?.position;
      if (train.realtime?.position) {
        const latitudeDelta = 0.05;
        const latitudeOffset = getLatitudeOffsetForModal(latitudeDelta, 'half');
        mapRef.current?.animateToRegion(
          {
            latitude: train.realtime.position.lat - latitudeOffset,
            longitude: train.realtime.position.lon,
            latitudeDelta: latitudeDelta,
            longitudeDelta: 0.05,
          },
          500
        );
      }

      navigateToTrain(train, { fromMarker });
    },
    [setSelectedTrain, navigateToTrain]
  );

  // Handle train marker press on the map - center map on train and show detail at 50%
  const handleTrainMarkerPress = useCallback(
    (train: Train, lat: number, lon: number) => {
      // Center map on train position with offset for 50% modal
      const latitudeDelta = 0.05;
      const latitudeOffset = getLatitudeOffsetForModal(latitudeDelta, 'half');
      mapRef.current?.animateToRegion(
        {
          latitude: lat - latitudeOffset,
          longitude: lon,
          latitudeDelta: latitudeDelta,
          longitudeDelta: 0.05,
        },
        500
      );

      setSelectedTrain(train);
      navigateToTrain(train, { fromMarker: true });
    },
    [setSelectedTrain, navigateToTrain]
  );

  // Handle live train marker press - fetch train details then show modal
  const handleLiveTrainMarkerPress = useCallback(
    async (tripId: string, lat: number, lon: number) => {
      try {
        const train = await TrainAPIService.getTrainDetails(tripId);
        if (train) {
          handleTrainMarkerPress(train, lat, lon);
        }
      } catch (error) {
        logger.error('Error fetching train details:', error);
      }
    },
    [handleTrainMarkerPress]
  );

  // Handle station pin press - show departure board
  const handleStationPress = useCallback(
    (cluster: {
      id: string;
      lat: number;
      lon: number;
      isCluster: boolean;
      stations: Array<{ id: string; name: string; lat: number; lon: number }>;
    }) => {
      // If it's a cluster, just zoom in
      if (cluster.isCluster) {
        mapRef.current?.animateToRegion(
          {
            latitude: cluster.lat,
            longitude: cluster.lon,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          500
        );
        return;
      }

      // Get the station data
      const stationData = cluster.stations[0];
      const stop: Stop = {
        stop_id: stationData.id,
        stop_name: stationData.name,
        stop_lat: stationData.lat,
        stop_lon: stationData.lon,
      };

      navigateToStation(stop);
    },
    [navigateToStation]
  );

  // Handle train selection from departure board
  const handleDepartureBoardTrainSelect = useCallback(
    (train: Train) => {
      setSelectedTrain(train);
      navigateToTrain(train, { fromMarker: false, returnTo: 'departureBoard' });
    },
    [setSelectedTrain, navigateToTrain]
  );

  // Handle saving train from departure board swipe
  const handleSaveTrainFromBoard = useCallback(
    async (train: Train): Promise<boolean> => {
      if (!train.tripId) return false;
      const saved = await TrainStorageService.saveTrain(train);
      if (saved) {
        const updatedTrains = await TrainStorageService.getSavedTrains();
        setSavedTrains(updatedTrains);
      }
      return saved;
    },
    [setSavedTrains]
  );

  // Handle close button on departure board
  const handleDepartureBoardClose = useCallback(() => {
    navigateToMain();
  }, [navigateToMain]);

  // Handle detail modal close
  const handleDetailModalClose = useCallback(() => {
    goBack();
  }, [goBack]);

  // Handle train-to-train navigation from detail modal
  const handleTrainToTrainNavigation = useCallback(
    (train: Train) => {
      setSelectedTrain(train);
      navigateToTrain(train, { fromMarker: false });
    },
    [setSelectedTrain, navigateToTrain]
  );

  // Handle station selection from train detail - navigate to departure board
  const handleStationSelectFromDetail = useCallback(
    (stationCode: string, lat: number, lon: number) => {
      // Animate map to station with offset for 50% modal
      const latitudeDelta = 0.02;
      const latitudeOffset = getLatitudeOffsetForModal(latitudeDelta, 'half');
      mapRef.current?.animateToRegion(
        {
          latitude: lat - latitudeOffset,
          longitude: lon,
          latitudeDelta: latitudeDelta,
          longitudeDelta: 0.02,
        },
        500
      );

      // Create a Stop object and navigate
      const stop: Stop = {
        stop_id: stationCode,
        stop_name: gtfsParser.getStopName(stationCode),
        stop_lat: lat,
        stop_lon: lon,
      };
      navigateToStation(stop);
    },
    [navigateToStation]
  );

  // Get user location on mount
  React.useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
        } else {
          // Fallback to San Francisco if permission denied
          setRegion({
            latitude: 37.78825,
            longitude: -122.4324,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
        }
      } catch (error) {
        logger.error('Error getting initial location:', error);
        // Fallback to San Francisco on error
        setRegion({
          latitude: 37.78825,
          longitude: -122.4324,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      }
    })();
  }, []);

  // Track when GTFS data is loaded
  const [gtfsLoaded, setGtfsLoaded] = React.useState(gtfsParser.isLoaded);

  // Poll for GTFS loaded state
  React.useEffect(() => {
    if (gtfsLoaded) return;

    const interval = setInterval(() => {
      if (gtfsParser.isLoaded) {
        setGtfsLoaded(true);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [gtfsLoaded]);

  // Load saved trains after GTFS is ready
  React.useEffect(() => {
    if (!gtfsLoaded) return;

    (async () => {
      const trains = await TrainStorageService.getSavedTrains();
      const trainsWithRealtime = await Promise.all(trains.map(train => TrainAPIService.refreshRealtimeData(train)));
      setSavedTrains(trainsWithRealtime);
    })();
  }, [setSavedTrains, gtfsLoaded]);

  useRealtime(savedTrains, setSavedTrains, 20000);

  // Handle region changes with throttled region updates and debounced viewport bounds
  const lastRegionUpdateRef = useRef<number>(0);
  const pendingRegionRef = useRef<any>(null);
  const regionThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRegionChangeComplete = useCallback((newRegion: any) => {
    const now = Date.now();
    const THROTTLE_MS = 100; // Throttle region state updates

    // Store pending region for deferred update
    pendingRegionRef.current = newRegion;

    // Throttle setRegion calls to reduce re-renders during fast movement
    if (now - lastRegionUpdateRef.current >= THROTTLE_MS) {
      lastRegionUpdateRef.current = now;
      setRegion(newRegion);
    } else if (!regionThrottleTimerRef.current) {
      // Schedule a deferred update to catch the final position
      regionThrottleTimerRef.current = setTimeout(() => {
        regionThrottleTimerRef.current = null;
        if (pendingRegionRef.current) {
          lastRegionUpdateRef.current = Date.now();
          setRegion(pendingRegionRef.current);
        }
      }, THROTTLE_MS);
    }

    // Debounce viewport bounds updates (for lazy loading) with longer delay
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setViewportBounds(regionToViewportBounds(newRegion));
    }, 250); // 250ms debounce for viewport bounds
  }, []);

  // Initialize viewport bounds when region is first set
  React.useEffect(() => {
    if (region && !viewportBounds) {
      setViewportBounds(regionToViewportBounds(region));
    }
  }, [region, viewportBounds]);

  // Cleanup timers on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (regionThrottleTimerRef.current) {
        clearTimeout(regionThrottleTimerRef.current);
      }
    };
  }, []);

  const handleRecenter = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const latitudeDelta = 0.05;
      const latitudeOffset = getLatitudeOffsetForModal(latitudeDelta, currentSnap);
      mapRef.current?.animateToRegion(
        {
          latitude: location.coords.latitude - latitudeOffset,
          longitude: location.coords.longitude,
          latitudeDelta: latitudeDelta,
          longitudeDelta: 0.05,
        },
        500
      );
    } catch (error) {
      logger.error('Error getting location:', error);
    }
  };

  // Calculate dynamic stroke width based on zoom level
  const baseStrokeWidth = useMemo(() => {
    return getStrokeWidthForZoom(region?.latitudeDelta ?? 0.0922);
  }, [region?.latitudeDelta]);

  // Routes are always visible (no zoom-based fading)
  const shouldRenderRoutes = routeMode !== 'hidden';

  // Cluster stations based on zoom level and station mode
  const stationClusters = useMemo(() => {
    if (stationMode === 'hidden') return [];
    if (stationMode === 'all') {
      // Return all stations without clustering
      return stations.map(s => ({
        id: s.id,
        lat: s.lat,
        lon: s.lon,
        isCluster: false,
        stations: [s],
      }));
    }
    // 'auto' mode - use clustering
    return clusterStations(stations, region?.latitudeDelta ?? 0.0922);
  }, [stations, region?.latitudeDelta, stationMode]);

  // Don't render until we have a region
  if (!region) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: AppColors.primary }}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={mapType}
        initialRegion={region}
        showsUserLocation={true}
        showsTraffic={false}
        showsIndoors={true}
        userLocationAnnotationTitle="Your Location"
        provider={PROVIDER_DEFAULT}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {shouldRenderRoutes &&
          visibleShapes.map(shape => {
            const colorScheme = getRouteColor(shape.id);
            return (
              <AnimatedRoute
                key={shape.id}
                id={shape.id}
                coordinates={shape.coordinates}
                strokeColor={colorScheme.stroke}
                strokeWidth={Math.max(2, baseStrokeWidth)}
                zoomOpacity={colorScheme.opacity}
              />
            );
          })}

        {stationClusters.map(cluster => {
          // Show full name when zoomed in enough
          const showFullName = !cluster.isCluster && (region?.latitudeDelta ?? 1) < ClusteringConfig.fullNameThreshold;
          const displayName = cluster.isCluster
            ? `${cluster.stations.length}+`
            : showFullName
              ? cluster.stations[0].name
              : getStationAbbreviation(cluster.stations[0].id, cluster.stations[0].name);
          return (
            <AnimatedStationMarker
              key={cluster.id}
              cluster={cluster}
              showFullName={showFullName}
              displayName={displayName}
              onPress={() => {
                // Center map on station with offset for 50% modal (departure board opens at half)
                const latitudeDelta = 0.02;
                const latitudeOffset = getLatitudeOffsetForModal(latitudeDelta, 'half');
                mapRef.current?.animateToRegion(
                  {
                    latitude: cluster.lat - latitudeOffset,
                    longitude: cluster.lon,
                    latitudeDelta: latitudeDelta,
                    longitudeDelta: 0.02,
                  },
                  500
                );
                // Show departure board
                handleStationPress(cluster);
              }}
            />
          );
        })}

        {/* Render saved trains when mode is 'saved' */}
        {trainMode === 'saved' &&
          (() => {
            const savedTrainsWithPosition = savedTrains
              .filter(train => train.realtime?.position)
              .map(train => ({
                tripId: train.tripId || `saved-${train.id}`,
                trainNumber: train.trainNumber,
                routeName: train.routeName,
                position: {
                  lat: train.realtime!.position!.lat,
                  lon: train.realtime!.position!.lon,
                },
                isSaved: true,
                originalTrain: train,
              }));

            const clusteredSavedTrains = clusterTrains(savedTrainsWithPosition, region?.latitudeDelta ?? 1);

            return clusteredSavedTrains.map(cluster => (
              <LiveTrainMarker
                key={cluster.id}
                trainNumber={cluster.trainNumber || ''}
                routeName={cluster.routeName || null}
                coordinate={{
                  latitude: cluster.lat,
                  longitude: cluster.lon,
                }}
                isSaved={true}
                isCluster={cluster.isCluster}
                clusterCount={cluster.trains.length}
                onPress={() => {
                  if (!cluster.isCluster && cluster.trains[0]) {
                    const train = (cluster.trains[0] as any).originalTrain;
                    handleTrainMarkerPress(train, cluster.lat, cluster.lon);
                  }
                }}
              />
            ));
          })()}

        {/* Render all live trains when mode is 'all' */}
        {trainMode === 'all' &&
          (() => {
            // Prepare trains with saved status
            const trainsWithSavedStatus = liveTrains.map(train => {
              const savedTrain = savedTrains.find(
                saved =>
                  saved.trainNumber === train.trainNumber || (saved.tripId && saved.tripId.includes(train.trainNumber))
              );
              return {
                tripId: train.tripId,
                trainNumber: train.trainNumber,
                routeName: train.routeName,
                position: train.position,
                isSaved: !!savedTrain,
                savedTrain,
              };
            });

            const clusteredTrains = clusterTrains(trainsWithSavedStatus, region?.latitudeDelta ?? 1);

            return clusteredTrains.map(cluster => (
              <LiveTrainMarker
                key={cluster.id}
                trainNumber={cluster.trainNumber || ''}
                routeName={cluster.routeName || null}
                coordinate={{
                  latitude: cluster.lat,
                  longitude: cluster.lon,
                }}
                isSaved={cluster.isSaved}
                isCluster={cluster.isCluster}
                clusterCount={cluster.trains.length}
                onPress={() => {
                  if (!cluster.isCluster && cluster.trains[0]) {
                    const trainData = cluster.trains[0] as any;
                    // If it's a saved train, use its data directly
                    if (trainData.savedTrain && trainData.savedTrain.realtime?.position) {
                      handleTrainMarkerPress(trainData.savedTrain, cluster.lat, cluster.lon);
                    } else {
                      // Fetch train details for non-saved trains
                      handleLiveTrainMarkerPress(trainData.tripId, cluster.lat, cluster.lon);
                    }
                  }
                }}
              />
            ));
          })()}
      </MapView>

      <MapSettingsPill
        top={insets.top + 16}
        routeMode={routeMode}
        setRouteMode={setRouteMode}
        stationMode={stationMode}
        setStationMode={setStationMode}
        mapType={mapType}
        setMapType={setMapType}
        trainMode={trainMode}
        setTrainMode={setTrainMode}
        onRecenter={handleRecenter}
      />

      {/* Main modal - My Trains list (conditionally rendered, slides in/out) */}
      {showMain && (
        <SlideUpModal
          ref={mainModalRef}
          minSnapPercent={0.35}
          initialSnap={savedTrains.length === 0 ? 'min' : 'half'}
          onDismiss={() => handleModalDismissed('main')}
          onSnapChange={handleSnapChange}
        >
          <ModalContent
            onTrainSelect={trainOrStation => {
              // If it's a train, animate out main modal then show details
              if (trainOrStation && trainOrStation.departTime) {
                handleTrainSelect(trainOrStation as Train);
              } else if (trainOrStation && (trainOrStation as any).lat && (trainOrStation as any).lon) {
                // If it's a station, center map and collapse modal to 25%
                mapRef.current?.animateToRegion(
                  {
                    latitude: (trainOrStation as any).lat,
                    longitude: (trainOrStation as any).lon,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  },
                  500
                );
                mainModalRef.current?.snapToPoint?.('min');
              }
            }}
          />
        </SlideUpModal>
      )}

      {/* Detail modal - Train details */}
      {showTrainDetail && selectedTrain && (
        <SlideUpModal
          ref={detailModalRef}
          minSnapPercent={0.15}
          initialSnap={getInitialSnap('trainDetail')}
          onDismiss={() => handleModalDismissed('trainDetail')}
          onSnapChange={handleSnapChange}
        >
          <TrainDetailModal
            train={selectedTrain}
            onClose={handleDetailModalClose}
            onStationSelect={handleStationSelectFromDetail}
            onTrainSelect={handleTrainToTrainNavigation}
          />
        </SlideUpModal>
      )}

      {/* Departure board modal - Station departures */}
      {showDepartureBoard && modalData.station && (
        <SlideUpModal
          ref={departureBoardRef}
          minSnapPercent={0.15}
          initialSnap={getInitialSnap('departureBoard')}
          onDismiss={() => handleModalDismissed('departureBoard')}
          onSnapChange={handleSnapChange}
        >
          <DepartureBoardModal
            station={modalData.station}
            onClose={handleDepartureBoardClose}
            onTrainSelect={handleDepartureBoardTrainSelect}
            onSaveTrain={handleSaveTrainFromBoard}
          />
        </SlideUpModal>
      )}
    </View>
  );
}

export default function MapScreen() {
  return (
    <TrainProvider>
      <ModalProvider>
        <MapScreenInner />
      </ModalProvider>
    </TrainProvider>
  );
}
