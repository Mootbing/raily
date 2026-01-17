import * as Haptics from 'expo-haptics';
import { TrainTrack } from 'lucide-react-native';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppColors, BorderRadius, Spacing } from '../constants/theme';
import { COLORS, styles } from '../screens/styles';
import type { Train } from '../types/train';

// First threshold - shows delete button
const FIRST_THRESHOLD = -80;
// Second threshold - triggers auto-delete on release
const SECOND_THRESHOLD = -140;

export function parseTimeToDate(timeStr: string, baseDate: Date): Date {
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

export function getCountdownForTrain(train: Train): { value: number; unit: 'DAYS' | 'HOURS' | 'MINUTES' | 'SECONDS'; past: boolean } {
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

interface SwipeableTrainCardProps {
  train: Train;
  onPress: () => void;
  onDelete: () => void;
}

function SwipeableTrainCard({ train, onPress, onDelete }: SwipeableTrainCardProps) {
  const translateX = useSharedValue(0);
  const hasTriggeredSecondHaptic = useSharedValue(false);
  const isDeleting = useSharedValue(false);

  const triggerSecondHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const triggerDeleteHaptic = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDelete = () => {
    triggerDeleteHaptic();
    onDelete();
  };

  const performDelete = () => {
    isDeleting.value = true;
    translateX.value = withTiming(-500, { duration: 200 }, () => {
      runOnJS(handleDelete)();
    });
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onUpdate((event) => {
      if (isDeleting.value) return;

      // Only allow left swipe (negative values), no max limit
      const clampedX = Math.min(0, event.translationX);
      translateX.value = clampedX;

      // Haptic only when crossing second threshold (auto-delete point)
      if (clampedX <= SECOND_THRESHOLD && !hasTriggeredSecondHaptic.value) {
        hasTriggeredSecondHaptic.value = true;
        runOnJS(triggerSecondHaptic)();
      } else if (clampedX > SECOND_THRESHOLD && hasTriggeredSecondHaptic.value) {
        hasTriggeredSecondHaptic.value = false;
      }
    })
    .onEnd(() => {
      if (isDeleting.value) return;

      // If past second threshold, auto-delete
      if (translateX.value <= SECOND_THRESHOLD) {
        runOnJS(performDelete)();
      } else if (translateX.value <= FIRST_THRESHOLD) {
        // Snap to show delete button
        translateX.value = withSpring(-FIRST_THRESHOLD, {
          damping: 20,
          stiffness: 200,
        });
      } else {
        // Snap back
        translateX.value = withSpring(0, {
          damping: 20,
          stiffness: 200,
        });
      }
      hasTriggeredSecondHaptic.value = false;
    });

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      if (isDeleting.value) return;

      if (translateX.value < -10) {
        // If swiped, tap closes it
        translateX.value = withSpring(0, {
          damping: 20,
          stiffness: 200,
        });
      } else {
        runOnJS(onPress)();
      }
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const absX = Math.abs(translateX.value);
    // Fade from 1 to 0 as we go from FIRST_THRESHOLD to SECOND_THRESHOLD
    const fadeProgress = interpolate(
      absX,
      [Math.abs(FIRST_THRESHOLD), Math.abs(SECOND_THRESHOLD)],
      [1, 0],
      'clamp'
    );

    return {
      transform: [{ translateX: translateX.value }],
      opacity: fadeProgress,
    };
  });

  // Delete button container fills the revealed space
  const deleteContainerAnimatedStyle = useAnimatedStyle(() => {
    const absX = Math.abs(translateX.value);
    const progress = Math.min(1, absX / Math.abs(FIRST_THRESHOLD));

    return {
      opacity: progress,
      width: absX > 0 ? absX : 0,
    };
  });

  // Delete button (the pill) - icon alignment changes based on swipe distance
  const deleteButtonAnimatedStyle = useAnimatedStyle(() => {
    const absX = Math.abs(translateX.value);
    const pastSecondThreshold = absX >= Math.abs(SECOND_THRESHOLD);

    return {
      justifyContent: pastSecondThreshold ? 'flex-start' : 'center',
      paddingLeft: pastSecondThreshold ? 16 : 0,
    };
  });

  const countdown = getCountdownForTrain(train);
  const unitLabel = `${countdown.unit}${countdown.past ? ' AGO' : ''}`;
  const isPast = countdown.past;

  const handleDeletePress = () => {
    performDelete();
  };

  return (
    <View style={swipeStyles.container}>
      {/* Delete button behind the card */}
      <Animated.View style={[swipeStyles.deleteButtonContainer, deleteContainerAnimatedStyle]}>
        <GestureDetector gesture={Gesture.Tap().onEnd(() => runOnJS(handleDeletePress)())}>
          <Animated.View style={[swipeStyles.deleteButton, deleteButtonAnimatedStyle]}>
            <Ionicons name="trash" size={22} color="#fff" />
          </Animated.View>
        </GestureDetector>
      </Animated.View>

      {/* The actual card */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.flightCard, cardAnimatedStyle]}>
          <View style={styles.flightLeft}>
            <Text style={[styles.daysAway, isPast && { color: COLORS.secondary }]}>{countdown.value}</Text>
            <Text style={[styles.daysLabel, isPast && { color: COLORS.secondary }]}>{unitLabel}</Text>
          </View>

          <View style={styles.flightCenter}>
            <View style={styles.flightHeader}>
              <Image
                source={require('../assets/images/amtrak.png')}
                style={styles.amtrakLogo}
                fadeDuration={0}
              />
              <Text style={[styles.trainNumber, { color: COLORS.secondary, fontWeight: '400' }]}>
                {train.routeName ? train.routeName : train.operator} {train.trainNumber}
              </Text>
              <Text style={styles.flightDate}>{train.date}</Text>
            </View>

            <Text style={[styles.route, { fontSize: 18 }]}>{train.from} to {train.to}</Text>

            <View style={styles.timeRow}>
              <View style={styles.timeInfo}>
                <View style={[styles.arrowIcon, styles.departureIcon]}>
                  <MaterialCommunityIcons name="arrow-top-right" size={8} color="rgba(255, 255, 255, 0.5)" />
                </View>
                <Text style={styles.timeCode}>{train.fromCode}</Text>
                <Text style={styles.timeValue}>{train.departTime}</Text>
              </View>

              <View style={styles.timeInfo}>
                <View style={[styles.arrowIcon, styles.arrivalIcon]}>
                  <MaterialCommunityIcons name="arrow-bottom-left" size={8} color="rgba(255, 255, 255, 0.5)" />
                </View>
                <Text style={styles.timeCode}>{train.toCode}</Text>
                <Text style={styles.timeValue}>{train.arriveTime}</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

interface TrainListProps {
  flights: Train[];
  onTrainSelect: (t: Train) => void;
  onDeleteTrain?: (train: Train) => void;
}

export function TrainList({ flights, onTrainSelect, onDeleteTrain }: TrainListProps) {
  if (flights.length === 0) {
    return (
      <View style={styles.noTrainsContainer}>
        <TrainTrack size={48} color={COLORS.primary} />
        <Text style={styles.noTrainsText}>No saved trips yet</Text>
      </View>
    );
  }

  return (
    <>
      {flights.map((flight) => (
        <SwipeableTrainCard
          key={flight.id}
          train={flight}
          onPress={() => onTrainSelect(flight)}
          onDelete={() => onDeleteTrain?.(flight)}
        />
      ))}
    </>
  );
}

const swipeStyles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  deleteButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingRight: 4,
    paddingVertical: 4,
  },
  deleteButton: {
    flex: 1,
    borderRadius: 26,
    backgroundColor: AppColors.error,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
});
