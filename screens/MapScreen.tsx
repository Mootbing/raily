import * as Location from 'expo-location';
import React, { useMemo, useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MapSettingsPill, { MapType, RouteMode, StationMode, TrainMode } from '../components/map/MapSettingsPill';
import SlideUpModal from '../components/ui/slide-up-modal';
import TrainDetailModal from '../components/ui/train-detail-modal';
import { AppColors } from '../constants/theme';
import { TrainProvider, useTrainContext } from '../context/TrainContext';
import { useRealtime } from '../hooks/useRealtime';
import { useShapes } from '../hooks/useShapes';
import { TrainAPIService } from '../services/api';
import { TrainStorageService } from '../services/storage';
import type { Train } from '../types/train';
import { gtfsParser } from '../utils/gtfs-parser';
import { getColoredRouteColor, getRouteColor, getStrokeWidthForZoom, getColoredRouteColor as getTrainMarkerColor } from '../utils/route-colors';
import { clusterStations, getStationAbbreviation } from '../utils/station-clustering';
import { ModalContent } from './ModalContent';
import { styles } from './styles';

function MapScreenInner() {
  const mapRef = useRef<MapView>(null);
  const mainModalRef = useRef<any>(null);
  const detailModalRef = useRef<any>(null);
  const [showDetailModal, setShowDetailModal] = React.useState(false);
  const [stations, setStations] = React.useState<Array<{ id: string; name: string; lat: number; lon: number }>>([]);
  const [region, setRegion] = React.useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const [mapType, setMapType] = React.useState<MapType>('standard');
  const [routeMode, setRouteMode] = React.useState<RouteMode>('secondary');
  const [stationMode, setStationMode] = React.useState<StationMode>('auto');
  const [trainMode, setTrainMode] = React.useState<TrainMode>('white');
  const { savedTrains, setSavedTrains, selectedTrain, setSelectedTrain } = useTrainContext();
  const insets = useSafeAreaInsets();

  // Track pending train for animation sequencing (ref to avoid async state issues)
  const pendingTrainRef = React.useRef<Train | null>(null);

  // Handle train selection: dismiss main modal first, then show detail modal
  const handleTrainSelect = (train: Train) => {
    pendingTrainRef.current = train;
    setSelectedTrain(train);
    // Dismiss main modal - when animation completes, show detail modal
    mainModalRef.current?.dismiss?.();
  };

  // When main modal finishes sliding out, show the detail modal
  const handleMainModalDismissed = () => {
    if (pendingTrainRef.current) {
      setShowDetailModal(true);
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
    // Slide main modal back in
    setTimeout(() => {
      mainModalRef.current?.slideIn?.();
    }, 50);
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

  // Load stations and trains after GTFS is ready
  React.useEffect(() => {
    if (!gtfsLoaded) return;

    (async () => {
      const trains = await TrainStorageService.getSavedTrains();
      const trainsWithRealtime = await Promise.all(
        trains.map(train => TrainAPIService.refreshRealtimeData(train))
      );
      setSavedTrains(trainsWithRealtime);

      const allStops = gtfsParser.getAllStops();
      setStations(allStops.map(stop => ({ id: stop.stop_id, name: stop.stop_name, lat: stop.stop_lat, lon: stop.stop_lon })));
    })();
  }, [setSavedTrains, gtfsLoaded]);

  useRealtime(savedTrains, setSavedTrains, 20000);

  const { visibleShapes } = useShapes();

  const handleRegionChangeComplete = (newRegion: any) => {
    setRegion(newRegion);
  };

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
            <Polyline
              key={shape.id}
              coordinates={shape.coordinates}
              strokeColor={colorScheme.stroke}
              strokeWidth={Math.max(2, baseStrokeWidth)}
              lineCap="round"
              lineJoin="round"
              geodesic={true}
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
            <Marker
              key={cluster.id}
              coordinate={{ latitude: cluster.lat, longitude: cluster.lon }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => {
                mapRef.current?.animateToRegion({
                  latitude: cluster.lat,
                  longitude: cluster.lon,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }, 500);
              }}
            >
              <View style={{ alignItems: 'center' }}>
                <Ionicons
                  name="location"
                  size={24}
                  color={AppColors.primary}
                />
                <Text
                  style={{
                    color: AppColors.primary,
                    fontSize: cluster.isCluster ? 10 : 9,
                    fontWeight: '600',
                    marginTop: -4,
                    textAlign: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                    borderRadius: 3,
                  }}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
              </View>
            </Marker>
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
