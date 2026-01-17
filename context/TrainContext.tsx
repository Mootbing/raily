import React, { createContext, useContext, useState } from 'react';
import type { Train } from '../types/train';

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
  const [savedTrains, setSavedTrains] = useState<Train[]>([]);
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);

  return (
    <TrainContext.Provider value={{ savedTrains, setSavedTrains, selectedTrain, setSelectedTrain }}>
      {children}
    </TrainContext.Provider>
  );
};
