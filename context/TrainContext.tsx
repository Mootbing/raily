import React, { createContext, useContext, useState } from 'react';
import type { Train } from '../types/train';

// Test train with delay for UI testing - REMOVE IN PRODUCTION
const TEST_DELAYED_TRAIN: Train = {
  id: 99999,
  operator: 'Amtrak',
  trainNumber: '1234',
  from: 'New York',
  to: 'Washington',
  fromCode: 'NYP',
  toCode: 'WAS',
  departTime: '11:49 PM',
  arriveTime: '8:08 AM',
  departDayOffset: 0,
  arriveDayOffset: 1,
  date: 'Sun, Feb 15',
  daysAway: 0,
  routeName: 'Test Delayed',
  tripId: 'test-delayed-trip',
  realtime: {
    delay: 10, // 10 minute delay
    status: 'Delayed',
    lastUpdated: Date.now(),
  },
};

interface TrainContextType {
  savedTrains: Train[];
  setSavedTrains: React.Dispatch<React.SetStateAction<Train[]>>;
  selectedTrain: Train | null;
  setSelectedTrain: React.Dispatch<React.SetStateAction<Train | null>>;
}

export const TrainContext = createContext<TrainContextType | undefined>(undefined);

export const useTrainContext = () => {
  const ctx = useContext(TrainContext);
  if (!ctx) throw new Error('useTrainContext must be used within TrainProvider');
  return ctx;
};

export const TrainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [savedTrains, setSavedTrains] = useState<Train[]>([TEST_DELAYED_TRAIN]);
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);

  return (
    <TrainContext.Provider value={{ savedTrains, setSavedTrains, selectedTrain, setSelectedTrain }}>
      {children}
    </TrainContext.Provider>
  );
};
