import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppColors, BorderRadius, Spacing } from '../../constants/theme';
import { TrainAPIService } from '../../services/api';
import type { Stop, Train } from '../../types/train';
import { SlideUpModalContext } from './slide-up-modal';

interface DepartureBoardModalProps {
  station: Stop;
  onClose: () => void;
  onTrainSelect: (train: Train) => void;
}

/**
 * Format date for display (e.g., "Today", "Tomorrow", "Jan 17")
 */
function formatDateDisplay(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  if (targetDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (targetDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

/**
 * Parse time string (h:mm AM/PM) to minutes since midnight
 */
function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const isPM = match[3].toUpperCase() === 'PM';
  if (isPM && hours !== 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/**
 * Check if a train departs after the current time (for "today" filtering)
 */
function isTrainUpcoming(train: Train, selectedDate: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(selectedDate);
  targetDate.setHours(0, 0, 0, 0);

  // If selected date is not today, show all trains
  if (targetDate.getTime() !== today.getTime()) {
    return true;
  }

  // For today, only show trains that haven't departed yet
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const trainMinutes = parseTimeToMinutes(train.departTime);
  return trainMinutes > currentMinutes - 5; // 5 minute grace period
}

export default function DepartureBoardModal({
  station,
  onClose,
  onTrainSelect,
}: DepartureBoardModalProps) {
  const [departures, setDepartures] = useState<Train[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { isCollapsed, scrollOffset } = React.useContext(SlideUpModalContext);

  // Fetch departures for the station
  useEffect(() => {
    const fetchDepartures = async () => {
      setLoading(true);
      try {
        const trains = await TrainAPIService.getTrainsForStation(station.stop_id);
        // Sort by departure time
        trains.sort((a, b) => {
          const aMinutes = parseTimeToMinutes(a.departTime);
          const bMinutes = parseTimeToMinutes(b.departTime);
          return aMinutes - bMinutes;
        });
        setDepartures(trains);
      } catch (error) {
        console.error('Error fetching departures:', error);
        setDepartures([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDepartures();
  }, [station.stop_id]);

  // Filter departures based on search and date
  const filteredDepartures = useMemo(() => {
    return departures.filter((train) => {
      // Filter by upcoming time for today
      if (!isTrainUpcoming(train, selectedDate)) {
        return false;
      }

      // Filter by search query (destination, train number, route name)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesDestination = train.to.toLowerCase().includes(query);
        const matchesToCode = train.toCode.toLowerCase().includes(query);
        const matchesTrainNumber = train.trainNumber.toLowerCase().includes(query);
        const matchesRouteName = train.routeName?.toLowerCase().includes(query);
        return matchesDestination || matchesToCode || matchesTrainNumber || matchesRouteName;
      }

      return true;
    });
  }, [departures, selectedDate, searchQuery]);

  // Date navigation
  const navigateDate = useCallback((direction: 'prev' | 'next') => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  }, []);

  const canGoBack = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return selected.getTime() > today.getTime();
  }, [selectedDate]);

  // Handle date picker change
  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      // On Android, the picker closes automatically; on iOS, we need to handle it
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
      }
      if (event.type === 'set' && date) {
        // Ensure date is not in the past
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const newDate = new Date(date);
        newDate.setHours(0, 0, 0, 0);
        if (newDate.getTime() >= today.getTime()) {
          setSelectedDate(date);
        }
      }
    },
    []
  );

  // Close date picker on iOS
  const handleDatePickerDone = useCallback(() => {
    setShowDatePicker(false);
  }, []);

  const handleTrainPress = useCallback(
    (train: Train) => {
      // Update the train's fromCode to be this station
      const updatedTrain: Train = {
        ...train,
        fromCode: station.stop_id,
        from: station.stop_name,
      };
      onTrainSelect(updatedTrain);
    },
    [station, onTrainSelect]
  );

  return (
    <ScrollView
      style={styles.modalContent}
      scrollEnabled={true}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
      showsVerticalScrollIndicator={true}
      stickyHeaderIndices={[0]}
      onScroll={(e) => {
        const offsetY = e.nativeEvent.contentOffset.y;
        if (scrollOffset) scrollOffset.value = offsetY;
      }}
      scrollEventThrottle={16}
      bounces={true}
      nestedScrollEnabled={true}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerSubtitle}>{station.stop_id}</Text>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {station.stop_name}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.6}>
          <Ionicons name="close" size={24} color={AppColors.primary} />
        </TouchableOpacity>
      </View>

      {!isCollapsed && (
        <>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={AppColors.secondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by destination or train..."
              placeholderTextColor={AppColors.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={AppColors.secondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Date Selector */}
          <View style={styles.dateSelector}>
            <TouchableOpacity
              style={[styles.dateArrow, !canGoBack && styles.dateArrowDisabled]}
              onPress={() => canGoBack && navigateDate('prev')}
              disabled={!canGoBack}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={canGoBack ? AppColors.primary : AppColors.tertiary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dateDisplay}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={16} color={AppColors.secondary} />
              <Text style={styles.dateText}>{formatDateDisplay(selectedDate)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateArrow} onPress={() => navigateDate('next')}>
              <Ionicons name="chevron-forward" size={20} color={AppColors.primary} />
            </TouchableOpacity>
          </View>

          {/* Date Picker */}
          {showDatePicker && (
            <View style={styles.datePickerContainer}>
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={handleDateChange}
                minimumDate={new Date()}
                themeVariant="dark"
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.datePickerDoneButton}
                  onPress={handleDatePickerDone}
                >
                  <Text style={styles.datePickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Departures List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={AppColors.primary} />
              <Text style={styles.loadingText}>Loading departures...</Text>
            </View>
          ) : filteredDepartures.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="train-outline" size={48} color={AppColors.tertiary} />
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'No trains match your search'
                  : 'No departures found for this station'}
              </Text>
            </View>
          ) : (
            <View style={styles.departuresList}>
              <Text style={styles.sectionTitle}>
                Departures ({filteredDepartures.length})
              </Text>
              {filteredDepartures.map((train, index) => {
                if (!train || !train.departTime) return null;
                return (
                  <TouchableOpacity
                    key={`${train.tripId || train.id}-${index}`}
                    style={styles.departureItem}
                    onPress={() => handleTrainPress(train)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.departureTime}>
                      <Text style={styles.timeText}>{train.departTime}</Text>
                      {train.realtime?.delay && train.realtime.delay > 0 && (
                        <Text style={styles.delayText}>+{train.realtime.delay}m</Text>
                      )}
                    </View>
                    <View style={styles.departureInfo}>
                      <View style={styles.trainHeader}>
                        <Text style={styles.trainNumber}>
                          {train.routeName || 'Amtrak'} {train.trainNumber || ''}
                        </Text>
                        {train.realtime?.status && (
                          <View
                            style={[
                              styles.statusBadge,
                              train.realtime.delay && train.realtime.delay > 0
                                ? styles.statusDelayed
                                : styles.statusOnTime,
                            ]}
                          >
                            <Text style={styles.statusText}>
                              {train.realtime.delay && train.realtime.delay > 0
                                ? 'Delayed'
                                : 'On Time'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.destinationRow}>
                        <MaterialCommunityIcons
                          name="arrow-right"
                          size={14}
                          color={AppColors.secondary}
                        />
                        <Text style={styles.destinationText}>
                          {train.to || 'Unknown'} {train.toCode ? `(${train.toCode})` : ''}
                        </Text>
                      </View>
                      <Text style={styles.arrivalText}>
                        {train.arriveTime ? `Arrives ${train.arriveTime}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={AppColors.tertiary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    flex: 1,
    marginHorizontal: -Spacing.xl,
  },
  header: {
    paddingLeft: Spacing.xl,
    paddingRight: Spacing.xl,
    paddingTop: 0,
    paddingBottom: Spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  headerSubtitle: {
    fontSize: 14,
    color: AppColors.secondary,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  closeButton: {
    position: 'absolute',
    zIndex: 20,
    right:0,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: AppColors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: AppColors.border.primary,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  dateArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateArrowDisabled: {
    backgroundColor: AppColors.background.primary,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: AppColors.background.secondary,
    borderRadius: BorderRadius.md,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.primary,
  },
  datePickerContainer: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    backgroundColor: AppColors.background.secondary,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  datePickerDoneButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: AppColors.border.primary,
  },
  datePickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.accent,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: AppColors.background.secondary,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: AppColors.primary,
    paddingVertical: Spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
    color: AppColors.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 14,
    color: AppColors.secondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  departuresList: {
    paddingHorizontal: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.secondary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  departureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border.primary,
  },
  departureTime: {
    width: 80,
    alignItems: 'flex-start',
  },
  timeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  delayText: {
    fontSize: 12,
    color: AppColors.error,
    fontWeight: '600',
    marginTop: 2,
  },
  departureInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  trainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  trainNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.primary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  statusOnTime: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusDelayed: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.primary,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  destinationText: {
    fontSize: 14,
    color: AppColors.secondary,
  },
  arrivalText: {
    fontSize: 12,
    color: AppColors.tertiary,
  },
});
