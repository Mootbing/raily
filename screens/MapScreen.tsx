import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import SlideUpModal from '../components/ui/slide-up-modal';
import TrainDetailModal from '../components/ui/train-detail-modal';
import { useRealtime } from '../hooks/useRealtime';
import { useShapes } from '../hooks/useShapes';
import { TrainAPIService } from '../services/api';
import { TrainStorageService } from '../services/storage';
import type { Train } from '../types/train';
import { gtfsParser } from '../utils/gtfs-parser';
import ModalContent from './ModalContent';
import { styles } from './styles';

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const mainModalRef = useRef<any>(null);
  const [selectedTrain, setSelectedTrain] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [stations, setStations] = useState<Array<{ id: string; name: string; lat: number; lon: number }>>([]);
  const [savedTrains, setSavedTrains] = useState<Train[]>([]);
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    (async () => {
      const trains = await TrainStorageService.getSavedTrains();
      const trainsWithRealtime = await Promise.all(
        trains.map(train => TrainAPIService.refreshRealtimeData(train))
      );
      setSavedTrains(trainsWithRealtime);

      const allStops = gtfsParser.getAllStops();
      setStations(allStops.map(stop => ({ id: stop.stop_id, name: stop.stop_name, lat: stop.stop_lat, lon: stop.stop_lon })));
    })();
  }, []);

  useRealtime(savedTrains, setSavedTrains, 20000);

  const { visibleShapes, updateBounds } = useShapes({
    minLat: region.latitude - region.latitudeDelta / 2,
    maxLat: region.latitude + region.latitudeDelta / 2,
    minLon: region.longitude - region.longitudeDelta / 2,
    maxLon: region.longitude + region.longitudeDelta / 2,
  });

  const handleRegionChange = (newRegion: any) => {
    setRegion(newRegion);
    updateBounds({
      minLat: newRegion.latitude - newRegion.latitudeDelta / 2,
      maxLat: newRegion.latitude + newRegion.latitudeDelta / 2,
      minLon: newRegion.longitude - newRegion.longitudeDelta / 2,
      maxLon: newRegion.longitude + newRegion.longitudeDelta / 2,
    });
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

        {savedTrains.map((train) => (
          train.realtime?.position && (
            <Marker
              key={`train-${train.id}`}
              coordinate={{ latitude: train.realtime.position.lat, longitude: train.realtime.position.lon }}
              title={`Train ${train.flightNumber}`}
              description={train.routeName}
            >
              <View style={styles.liveTrainMarker}>
                <Ionicons name="train" size={16} color="#FFFFFF" />
              </View>
            </Marker>
          )
        ))}
      </MapView>

      <SlideUpModal ref={mainModalRef}>
        <ModalContent onTrainSelect={(train) => {
          setSelectedTrain(train);
          setShowDetailModal(true);
        }} />
      </SlideUpModal>

      <Modal
        visible={showDetailModal && !!selectedTrain}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.detailModalOverlay}>
          <BlurView intensity={40} style={styles.detailModalCard}>
            {selectedTrain && (
              <TrainDetailModal train={selectedTrain} onClose={() => setShowDetailModal(false)} />
            )}
          </BlurView>
        </View>
      </Modal>
    </View>
  );
}
