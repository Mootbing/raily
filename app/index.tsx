import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import MapView from 'react-native-maps';
import SlideUpModal, { SlideUpModalContext } from '../components/ui/slide-up-modal';
import TrainDetailModal from '../components/ui/train-detail-modal';
import { AppColors, BorderRadius, FontSizes, FontWeights, Spacing } from '../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Color palette
const COLORS = AppColors;

const FONTS = {
  family: 'System',
  weight: FontWeights,
};

function ModalContent({ onTrainSelect }: { onTrainSelect: (train: any) => void }) {
  const { isFullscreen, scrollOffset, panGesture, isMinimized } = useContext(SlideUpModalContext);
  const [imageError, setImageError] = useState(false);

  const flights = [
    {
      id: 1,
      airline: 'AMTK',
      flightNumber: '401',
      from: 'Philadelphia',
      to: 'San Francisco',
      fromCode: 'PHL',
      toCode: 'SFO',
      departTime: '3:53 PM',
      arriveTime: '7:21 PM',
      date: 'Fri, 13 Feb',
      daysAway: 28,
    },
    {
      id: 2,
      airline: 'AMTK',
      flightNumber: '402',
      from: 'San Francisco',
      to: 'Philadelphia',
      fromCode: 'SFO',
      toCode: 'PHL',
      departTime: '11:49 PM',
      arriveTime: '8:08 AM',
      arriveNext: true,
      date: 'Sun, 15 Feb',
      daysAway: 30,
    },
  ];

  return (
    <>
      <GestureDetector gesture={panGesture}>
        <View>
          <Text style={styles.title}>My Trains</Text>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#888" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search to add trains"
              placeholderTextColor={COLORS.secondary}
              editable={!isMinimized}
            />
          </View>
        </View>
      </GestureDetector>

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
        {flights.map((flight, index) => (
        <TouchableOpacity 
          key={flight.id} 
          style={[
            styles.flightCard,
            isMinimized && index > 0 && { display: 'none' }
          ]}
          onPress={() => {
            onTrainSelect(flight);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.flightLeft}>
            <Text style={styles.daysAway}>{flight.daysAway}</Text>
            <Text style={styles.daysLabel}>DAYS</Text>
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
                  {flight.arriveNext ? ' +1' : ''}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
    </GestureDetector>
    </>
  );
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [selectedTrain, setSelectedTrain] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const detailModalAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
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

  useEffect(() => {
    if (showDetailModal) {
      Animated.spring(detailModalAnim, {
        toValue: SCREEN_HEIGHT * 0.5,
        useNativeDriver: true,
        damping: 30,
        stiffness: 150,
      }).start();
    } else {
      detailModalAnim.setValue(SCREEN_HEIGHT);
    }
  }, [showDetailModal]);

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
      
      <SlideUpModal>
        <ModalContent onTrainSelect={(train) => {
          setSelectedTrain(train);
          setShowDetailModal(true);
        }} />
      </SlideUpModal>

      {showDetailModal && selectedTrain && (
        <Animated.View style={[styles.detailModalContainer, {
          transform: [{ translateY: detailModalAnim }]
        }]}>
          <SlideUpModal onDismiss={() => setShowDetailModal(false)}>
            <TrainDetailModal 
              train={selectedTrain}
              onClose={() => setShowDetailModal(false)}
            />
          </SlideUpModal>
        </Animated.View>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    color: COLORS.primary,
    fontSize: FontSizes.searchLabel,
    fontFamily: FONTS.family,
  },
  flightCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
