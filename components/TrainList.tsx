import { TrainTrack } from 'lucide-react-native';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS, styles } from '../screens/styles';
import type { Train } from '../types/train';

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

export function TrainList({ flights, onTrainSelect }: { flights: Train[]; onTrainSelect: (t: Train) => void }) {
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
      {flights.map((flight) => {
        const countdown = getCountdownForTrain(flight);
        const unitLabel = `${countdown.unit}${countdown.past ? ' AGO' : ''}`;
        const isPast = countdown.past;
        return (
          <TouchableOpacity
            key={flight.id}
            style={styles.flightCard}
            onPress={() => onTrainSelect(flight)}
            activeOpacity={0.7}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={`Train ${flight.trainNumber} from ${flight.from} to ${flight.to}`}
            accessibilityHint={`Departs at ${flight.departTime} (${countdown.value} ${countdown.unit.toLowerCase()} ${countdown.past ? 'ago' : 'from now'}), arrives at ${flight.arriveTime}. Tap to view details`}
          >
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
                  {flight.routeName ? flight.routeName : flight.operator} {flight.trainNumber}
                </Text>
                <Text style={styles.flightDate}>{flight.date}</Text>
              </View>

              {/*
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                {flight.routeName && flight.routeName.toLowerCase().includes('acela') ? (
                  <TrainFront size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
                ) : (
                  <FontAwesome6 name="train" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
                )}
                <Text style={[styles.route, { fontSize: 18 }]}>{flight.from} to {flight.to}</Text>
              </View>
              */}
              <Text style={[styles.route, { fontSize: 18 }]}>{flight.from} to {flight.to}</Text>

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
                  <Text style={styles.timeValue}>{flight.arriveTime}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </>
  );
}
