import * as Location from 'expo-location';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AnimatedRoute } from '../components/map/AnimatedRoute';
import { AnimatedStationMarker } from '../components/map/AnimatedStationMarker';
import MapSettingsPill, { MapType, RouteMode, StationMode, TrainMode } from '../components/map/MapSettingsPill';
import DepartureBoardModal from '../components/ui/departure-board-modal';
import SlideUpModal from '../components/ui/slide-up-modal';
import TrainDetailModal from '../components/ui/train-detail-modal';
import { AppColors } from '../constants/theme';
import { TrainProvider, useTrainContext } from '../context/TrainContext';
import { useRealtime } from '../hooks/useRealtime';
import { useShapes } from '../hooks/useShapes';
import { useStations } from '../hooks/useStations';
import { TrainAPIService } from '../services/api';
import type { ViewportBounds } from '../services/shape-loader';
import { TrainStorageService } from '../services/storage';
import type { Stop, Train } from '../types/train';
import { gtfsParser } from '../utils/gtfs-parser';
import { getColoredRouteColor, getRouteColor, getStrokeWidthForZoom, getColoredRouteColor as getTrainMarkerColor } from '../utils/route-colors';
import { clusterStations, getStationAbbreviation } from '../utils/station-clustering';
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

function MapScreenInner() {
  const mapRef = useRef<MapView>(null);
  const mainModalRef = useRef<any>(null);
  const detailModalRef = useRef<any>(null);
  const departureBoardRef = useRef<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDepartureBoard, setShowDepartureBoard] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Stop | null>(null);

  // Track pending station for animation sequencing (ref to avoid async state issues)
  const pendingStationRef = useRef<Stop | null>(null);
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
  const [routeMode, setRouteMode] = useState<RouteMode>('secondary');
  const [stationMode, setStationMode] = useState<StationMode>('auto');
  const [trainMode, setTrainMode] = useState<TrainMode>('white');
  const { savedTrains, setSavedTrains, selectedTrain, setSelectedTrain } = useTrainContext();
  const insets = useSafeAreaInsets();

  // Use lazy-loaded stations and shapes based on viewport
  const stations = useStations(viewportBounds ?? undefined);
  const { visibleShapes } = useShapes(viewportBounds ?? undefined);

  // Track pending train for animation sequencing (ref to avoid async state issues)
  const pendingTrainRef = React.useRef<Train | null>(null);

  // Handle train selection: dismiss main modal first, then show detail modal
  const handleTrainSelect = (train: Train) => {
    pendingTrainRef.current = train;
    setSelectedTrain(train);
    // Dismiss main modal - when animation completes, show detail modal
    mainModalRef.current?.dismiss?.();
  };

  // When main modal finishes sliding out, show the detail modal or departure board
  const handleMainModalDismissed = () => {
    if (pendingTrainRef.current) {
      setShowDetailModal(true);
    } else if (pendingStationRef.current) {
      setShowDepartureBoard(true);
    }
  };

  // When detail modal closes, slide main modal back in
  const handleDetailModalClose = () => {
    detailModalRef.current?.dismiss?.();
  };

  // When detail modal finishes sliding out, slide main modal back in
  const handleDetailModalDismissed = () => {
    pendingTrainRef.current = null;
    setShowDetailModal(false);
    setSelectedTrain(null);
    // If we came from departure board, show it again; otherwise show main modal
    setTimeout(() => {
      if (pendingStationRef.current) {
        // Re-show the departure board
        setShowDepartureBoard(true);
      } else {
        mainModalRef.current?.slideIn?.();
      }
    }, 50);
  };

  // Handle station pin press - show departure board
  const handleStationPress = (cluster: { id: string; lat: number; lon: number; isCluster: boolean; stations: Array<{ id: string; name: string; lat: number; lon: number }> }) => {
    // If it's a cluster, just zoom in
    if (cluster.isCluster) {
      mapRef.current?.animateToRegion({
        latitude: cluster.lat,
        longitude: cluster.lon,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
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

    // Store in ref to avoid race condition with state updates
    pendingStationRef.current = stop;
    setSelectedStation(stop);
    // Dismiss main modal first, then show departure board
    mainModalRef.current?.dismiss?.();
  };

  // Handle train selection from departure board
  const handleDepartureBoardTrainSelect = (train: Train) => {
    pendingTrainRef.current = train;
    setSelectedTrain(train);
    // Dismiss departure board modal, then show detail modal
    departureBoardRef.current?.dismiss?.();
  };

  // When departure board dismisses after selecting a train
  const handleDepartureBoardDismissed = () => {
    if (pendingTrainRef.current) {
      setShowDepartureBoard(false);
      setShowDetailModal(true);
    } else {
      // User closed departure board without selecting a train
      setShowDepartureBoard(false);
      setSelectedStation(null);
      pendingStationRef.current = null;
      setTimeout(() => {
        mainModalRef.current?.slideIn?.();
      }, 50);
    }
  };

  // Handle close button on departure board
  const handleDepartureBoardClose = () => {
    pendingTrainRef.current = null;
    pendingStationRef.current = null;
    departureBoardRef.current?.dismiss?.();
  };

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
        console.error('Error getting initial location:', error);
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
      const trainsWithRealtime = await Promise.all(
        trains.map(train => TrainAPIService.refreshRealtimeData(train))
      );
      setSavedTrains(trainsWithRealtime);
    })();
  }, [setSavedTrains, gtfsLoaded]);

  useRealtime(savedTrains, setSavedTrains, 20000);

  // Handle region changes with debounced viewport bounds updates
  const handleRegionChangeComplete = useCallback((newRegion: any) => {
    setRegion(newRegion);

    // Debounce viewport bounds updates to prevent excessive re-renders
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setViewportBounds(regionToViewportBounds(newRegion));
    }, 150); // 150ms debounce for smooth panning
  }, []);

  // Initialize viewport bounds when region is first set
  React.useEffect(() => {
    if (region && !viewportBounds) {
      setViewportBounds(regionToViewportBounds(region));
    }
  }, [region, viewportBounds]);

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
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
      mapRef.current?.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 500);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  // Calculate dynamic stroke width based on zoom level
  const baseStrokeWidth = useMemo(() => {
    return getStrokeWidthForZoom(region?.latitudeDelta ?? 0.0922);
  }, [region?.latitudeDelta]);

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
        {routeMode !== 'hidden' && visibleShapes.map((shape) => {
          const colorScheme = routeMode === 'colored'
            ? getColoredRouteColor(shape.id)
            : getRouteColor(shape.id);
          return (
            <AnimatedRoute
              key={shape.id}
              id={shape.id}
              coordinates={shape.coordinates}
              strokeColor={colorScheme.stroke}
              strokeWidth={Math.max(2, baseStrokeWidth)}
            />
          );
        })}

        {stationClusters.map((cluster) => {
          // Show full name when zoomed in enough (latitudeDelta < 0.25)
          const showFullName = !cluster.isCluster && (region?.latitudeDelta ?? 1) < 1;
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
                // Center map on station
                mapRef.current?.animateToRegion({
                  latitude: cluster.lat,
                  longitude: cluster.lon,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }, 500);
                // Show departure board
                handleStationPress(cluster);
              }}
            />
          );
        })}

        {trainMode !== 'hidden' && savedTrains.map((train) => {
          const markerColor = trainMode === 'colored' && train.routeName
            ? getTrainMarkerColor(train.routeName).stroke
            : AppColors.primary;
          return (
            train.realtime?.position && (
              <Marker
                key={`train-${train.id}`}
                coordinate={{ latitude: train.realtime.position.lat, longitude: train.realtime.position.lon }}
                title={`Train ${train.trainNumber}`}
                description={train.routeName}
              >
                <View style={[
                  styles.liveTrainMarker,
                  trainMode === 'colored' && { backgroundColor: markerColor }
                ]}>
                  <Ionicons name="train" size={16} color={AppColors.primary} />
                </View>
              </Marker>
            )
          );
        })}
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

      {/* Main modal - My Trains list (always rendered, slides in/out) */}
      <SlideUpModal ref={mainModalRef} minSnapPercent={0.35} onDismiss={handleMainModalDismissed}>
        <ModalContent
          onTrainSelect={(trainOrStation) => {
            // If it's a train, animate out main modal then show details
            if (trainOrStation && trainOrStation.departTime) {
              handleTrainSelect(trainOrStation);
            } else if (trainOrStation && trainOrStation.lat && trainOrStation.lon) {
              // If it's a station, center map and collapse modal to 25%
              mapRef.current?.animateToRegion({
                latitude: trainOrStation.lat,
                longitude: trainOrStation.lon,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }, 500);
              mainModalRef.current?.snapToPoint?.('min');
            }
          }}
        />
      </SlideUpModal>

      {/* Detail modal - Train details */}
      {showDetailModal && selectedTrain && (
        <SlideUpModal
          ref={detailModalRef}
          minSnapPercent={0.15}
          initialSnap="max"
          onDismiss={handleDetailModalDismissed}
        >
          <TrainDetailModal
            train={selectedTrain}
            onClose={handleDetailModalClose}
          />
        </SlideUpModal>
      )}

      {/* Departure board modal - Station departures */}
      {showDepartureBoard && selectedStation && (
        <SlideUpModal
          ref={departureBoardRef}
          minSnapPercent={0.1}
          initialSnap="max"
          onDismiss={handleDepartureBoardDismissed}
        >
          <DepartureBoardModal
            station={selectedStation}
            onClose={handleDepartureBoardClose}
            onTrainSelect={handleDepartureBoardTrainSelect}
          />
        </SlideUpModal>
      )}
    </View>
  );
}

export default function MapScreen() {
  return (
    <TrainProvider>
      <MapScreenInner />
    </TrainProvider>
  );
}
