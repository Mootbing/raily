import React, { useRef, useMemo } from 'react';
import { Animated, TouchableOpacity, View, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SlideUpModal from '../components/ui/slide-up-modal';
import TrainDetailModal from '../components/ui/train-detail-modal';
import { AppColors } from '../constants/theme';
import { TrainProvider, useTrainContext } from '../context/TrainContext';
import { useRealtime } from '../hooks/useRealtime';
import { useShapes } from '../hooks/useShapes';
import { TrainAPIService } from '../services/api';
import { TrainStorageService } from '../services/storage';
import { gtfsParser } from '../utils/gtfs-parser';
import { getRouteColor, getColoredRouteColor, getStrokeWidthForZoom } from '../utils/route-colors';
import { clusterStations, getStationAbbreviation } from '../utils/station-clustering';
import { ModalContent } from './ModalContent';
import { styles } from './styles';

function MapScreenInner() {
  const mapRef = useRef<MapView>(null);
  const mainModalRef = useRef<any>(null);
  const detailModalRef = useRef<any>(null);
  const [showDetailModal, setShowDetailModal] = React.useState(false);
  const [stations, setStations] = React.useState<Array<{ id: string; name: string; lat: number; lon: number }>>([]);
  const [region, setRegion] = React.useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [mapType, setMapType] = React.useState<'standard' | 'satellite'>('standard');
  const [routeMode, setRouteMode] = React.useState<'hidden' | 'secondary' | 'colored'>('secondary');
  const { savedTrains, setSavedTrains, selectedTrain, setSelectedTrain } = useTrainContext();
  const [selectedStation, setSelectedStation] = React.useState<string | null>(null);
  const markerScale = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (selectedStation) {
      Animated.spring(markerScale, {
        toValue: 1.2,
        useNativeDriver: true,
        friction: 6,
        tension: 100,
      }).start();
    } else {
      Animated.spring(markerScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 100,
      }).start();
    }
  }, [selectedStation, markerScale]);

  // Animate detail modal to 50% when it opens
  React.useEffect(() => {
    if (showDetailModal) {
      setTimeout(() => {
        detailModalRef.current?.snapToPoint?.('half');
      }, 100);
    }
  }, [showDetailModal]);

  React.useEffect(() => {
    (async () => {
      const trains = await TrainStorageService.getSavedTrains();
      const trainsWithRealtime = await Promise.all(
        trains.map(train => TrainAPIService.refreshRealtimeData(train))
      );
      setSavedTrains(trainsWithRealtime);

      const allStops = gtfsParser.getAllStops();
      setStations(allStops.map(stop => ({ id: stop.stop_id, name: stop.stop_name, lat: stop.stop_lat, lon: stop.stop_lon })));
    })();
  }, [setSavedTrains]);

  useRealtime(savedTrains, setSavedTrains, 20000);

  const { visibleShapes, updateBounds } = useShapes({
    minLat: region.latitude - region.latitudeDelta / 2,
    maxLat: region.latitude + region.latitudeDelta / 2,
    minLon: region.longitude - region.longitudeDelta / 2,
    maxLon: region.longitude + region.longitudeDelta / 2,
  });

  const handleRegionChangeComplete = (newRegion: any) => {
    setRegion(newRegion);
    // Update bounds only after user finishes panning/zooming for better performance
    updateBounds({
      minLat: newRegion.latitude - newRegion.latitudeDelta / 2,
      maxLat: newRegion.latitude + newRegion.latitudeDelta / 2,
      minLon: newRegion.longitude - newRegion.longitudeDelta / 2,
      maxLon: newRegion.longitude + newRegion.longitudeDelta / 2,
    });
  };

  const toggleMapType = () => {
    setMapType((prev) => (prev === 'standard' ? 'satellite' : 'standard'));
  };

  const toggleRouteMode = () => {
    setRouteMode((prev) => {
      if (prev === 'hidden') return 'secondary';
      if (prev === 'secondary') return 'colored';
      return 'hidden';
    });
  };

  // Calculate dynamic stroke width based on zoom level
  const baseStrokeWidth = useMemo(() => {
    return getStrokeWidthForZoom(region.latitudeDelta);
  }, [region.latitudeDelta]);

  // Cluster stations based on zoom level
  const stationClusters = useMemo(() => {
    return clusterStations(stations, region.latitudeDelta);
  }, [stations, region.latitudeDelta]);

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
          const isSelected = !cluster.isCluster && selectedStation === cluster.id;
          return (
            <Marker
              key={cluster.id}
              coordinate={{ latitude: cluster.lat, longitude: cluster.lon }}
              title={cluster.isCluster ? `${cluster.stations.length} stations` : cluster.stations[0].name}
              description={cluster.isCluster ? cluster.stations.map(s => s.name).join(', ') : cluster.stations[0].id}
              onPress={() => !cluster.isCluster && setSelectedStation(cluster.id)}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <Animated.View
                style={{
                  transform: [{ scale: isSelected ? markerScale : 1 }],
                  alignItems: 'center',
                }}
              >
                <Ionicons
                  name="location"
                  size={24}
                  color={isSelected ? AppColors.accentBlue : AppColors.primary}
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
                  {cluster.isCluster
                    ? `${cluster.stations.length}+`
                    : getStationAbbreviation(cluster.stations[0].id, cluster.stations[0].name)}
                </Text>
              </Animated.View>
            </Marker>
          );
        })}

        {savedTrains.map((train) => (
          train.realtime?.position && (
            <Marker
              key={`train-${train.id}`}
              coordinate={{ latitude: train.realtime.position.lat, longitude: train.realtime.position.lon }}
              title={`Train ${train.trainNumber}`}
              description={train.routeName}
            >
              <View style={styles.liveTrainMarker}>
                <Ionicons name="train" size={16} color={AppColors.primary} />
              </View>
            </Marker>
          )
        ))}
      </MapView>

      <TouchableOpacity
        style={[styles.mapTypeButton, { top: insets.top + 16 }]}
        onPress={toggleMapType}
        activeOpacity={0.7}
      >
        {mapType === 'standard' ? (
          <MaterialIcons
            name="satellite-alt"
            size={24}
            color={AppColors.primary}
          />
        ) : (
          <Ionicons
            name="map"
            size={24}
            color={AppColors.primary}
          />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.routeToggleButton, { top: insets.top + 16 }]}
        onPress={toggleRouteMode}
        activeOpacity={0.7}
      >
        {routeMode === 'hidden' && (
          <MaterialIcons name="route" size={24} color={AppColors.tertiary} />
        )}
        {routeMode === 'secondary' && (
          <MaterialIcons name="route" size={24} color={AppColors.primary} />
        )}
        {routeMode === 'colored' && (
          <MaterialIcons name="route" size={24} color={AppColors.accentBlue} />
        )}
      </TouchableOpacity>

      <SlideUpModal ref={mainModalRef}>
        <ModalContent
          onTrainSelect={(trainOrStation) => {
            // If it's a train, show details as before
            if (trainOrStation && trainOrStation.departTime) {
              setSelectedTrain(trainOrStation);
              setShowDetailModal(true);
            } else if (trainOrStation && trainOrStation.lat && trainOrStation.lon) {
              // If it's a station, center map and collapse modal to 25%
              // Find the station id by lat/lon
              const found = stations.find(s => Math.abs(s.lat - trainOrStation.lat) < 1e-6 && Math.abs(s.lon - trainOrStation.lon) < 1e-6);
              if (found) setSelectedStation(found.id);
              mapRef.current?.animateToRegion({
                latitude: trainOrStation.lat,
                longitude: trainOrStation.lon,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }, 500);
              mainModalRef.current?.snapToPoint?.('25%');
            }
          }}
        />
      </SlideUpModal>

      {showDetailModal && selectedTrain && (
        <SlideUpModal ref={detailModalRef}>
          <TrainDetailModal train={selectedTrain} onClose={() => setShowDetailModal(false)} />
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
