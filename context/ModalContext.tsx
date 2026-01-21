import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { Stop, Train } from '../types/train';

// Modal types that can be displayed
export type ModalType = 'main' | 'trainDetail' | 'departureBoard';

// Modal configuration for each type
export interface ModalConfig {
  type: ModalType;
  initialSnap?: 'min' | 'half' | 'max';
  data?: {
    train?: Train;
    station?: Stop;
  };
}

// Transition request - what modal to show next after current dismisses
interface TransitionRequest {
  target: ModalConfig | null;
  returnTo?: ModalConfig | null; // For going back (e.g., detail -> departure board)
}

interface ModalContextType {
  // Current modal state
  activeModal: ModalType;
  modalData: {
    train: Train | null;
    station: Stop | null;
  };
  currentSnap: 'min' | 'half' | 'max';

  // Visibility states for rendering
  showMain: boolean;
  showTrainDetail: boolean;
  showDepartureBoard: boolean;

  // Modal refs for imperative control
  mainModalRef: React.RefObject<any>;
  detailModalRef: React.RefObject<any>;
  departureBoardRef: React.RefObject<any>;

  // Navigation stack for back navigation
  modalStack: ModalConfig[];

  // Transition functions
  navigateToTrain: (train: Train, options?: { fromMarker?: boolean; returnTo?: ModalType }) => void;
  navigateToStation: (station: Stop) => void;
  navigateToMain: () => void;
  goBack: () => void;
  dismissCurrent: () => void;

  // Internal handlers for modal animations
  handleModalDismissed: (type: ModalType) => void;
  handleSnapChange: (snap: 'min' | 'half' | 'max') => void;

  // Get initial snap for a modal type
  getInitialSnap: (type: ModalType) => 'min' | 'half' | 'max';
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModalContext = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModalContext must be used within ModalProvider');
  return ctx;
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Refs for modal imperative handles
  const mainModalRef = useRef<any>(null);
  const detailModalRef = useRef<any>(null);
  const departureBoardRef = useRef<any>(null);

  // Visibility states
  const [showMain, setShowMain] = useState(true);
  const [showTrainDetail, setShowTrainDetail] = useState(false);
  const [showDepartureBoard, setShowDepartureBoard] = useState(false);

  // Active modal tracking
  const [activeModal, setActiveModal] = useState<ModalType>('main');
  const [currentSnap, setCurrentSnap] = useState<'min' | 'half' | 'max'>('half');

  // Modal data
  const [modalData, setModalData] = useState<{
    train: Train | null;
    station: Stop | null;
  }>({ train: null, station: null });

  // Navigation stack for back navigation
  const [modalStack, setModalStack] = useState<ModalConfig[]>([]);

  // Pending transition - what to do after current modal dismisses
  const pendingTransitionRef = useRef<TransitionRequest | null>(null);

  // Track initial snap for next modal
  const nextModalSnapRef = useRef<'min' | 'half' | 'max'>('half');

  // Get initial snap for a modal type based on pending transition
  const getInitialSnap = useCallback((type: ModalType): 'min' | 'half' | 'max' => {
    return nextModalSnapRef.current;
  }, []);

  // Handle snap changes
  const handleSnapChange = useCallback((snap: 'min' | 'half' | 'max') => {
    setCurrentSnap(snap);
  }, []);

  // Navigate to train detail modal
  const navigateToTrain = useCallback(
    (train: Train, options?: { fromMarker?: boolean; returnTo?: ModalType }) => {
      const fromMarker = options?.fromMarker ?? false;
      const returnTo = options?.returnTo;

      // Set up the transition
      const targetSnap = fromMarker ? 'half' : 'max';
      nextModalSnapRef.current = targetSnap;

      // Store the return destination if coming from departure board
      const returnConfig: ModalConfig | null =
        returnTo === 'departureBoard' && modalData.station
          ? { type: 'departureBoard', initialSnap: 'half', data: { station: modalData.station } }
          : null;

      pendingTransitionRef.current = {
        target: {
          type: 'trainDetail',
          initialSnap: targetSnap,
          data: { train },
        },
        returnTo: returnConfig,
      };

      // Update stack if we have a return destination
      if (returnConfig) {
        setModalStack(prev => [...prev, returnConfig]);
      }

      // Store train data now (will be used when modal shows)
      setModalData(prev => ({ ...prev, train }));

      // Dismiss current modal - the transition will happen in handleModalDismissed
      if (activeModal === 'main') {
        mainModalRef.current?.dismiss?.();
      } else if (activeModal === 'departureBoard') {
        departureBoardRef.current?.dismiss?.();
      } else if (activeModal === 'trainDetail') {
        // Transitioning from one train to another
        detailModalRef.current?.dismiss?.();
      }
    },
    [activeModal, modalData.station]
  );

  // Navigate to station departure board
  const navigateToStation = useCallback(
    (station: Stop) => {
      nextModalSnapRef.current = 'half';

      pendingTransitionRef.current = {
        target: {
          type: 'departureBoard',
          initialSnap: 'half',
          data: { station },
        },
        returnTo: null,
      };

      // Store station data now
      setModalData(prev => ({ ...prev, station }));

      // Dismiss current modal
      if (activeModal === 'main') {
        mainModalRef.current?.dismiss?.();
      } else if (activeModal === 'trainDetail') {
        detailModalRef.current?.dismiss?.();
      } else if (activeModal === 'departureBoard') {
        // Transitioning from one station to another
        departureBoardRef.current?.dismiss?.();
      }
    },
    [activeModal]
  );

  // Navigate back to main modal
  const navigateToMain = useCallback(() => {
    nextModalSnapRef.current = 'half';

    pendingTransitionRef.current = {
      target: {
        type: 'main',
        initialSnap: 'half',
      },
      returnTo: null,
    };

    // Clear stack
    setModalStack([]);

    // Dismiss current modal
    if (activeModal === 'trainDetail') {
      detailModalRef.current?.dismiss?.();
    } else if (activeModal === 'departureBoard') {
      departureBoardRef.current?.dismiss?.();
    }
  }, [activeModal]);

  // Go back in the stack
  const goBack = useCallback(() => {
    if (modalStack.length > 0) {
      const returnTo = modalStack[modalStack.length - 1];
      nextModalSnapRef.current = returnTo.initialSnap || 'half';

      pendingTransitionRef.current = {
        target: returnTo,
        returnTo: null,
      };

      // Pop the stack
      setModalStack(prev => prev.slice(0, -1));

      // Dismiss current modal
      if (activeModal === 'trainDetail') {
        detailModalRef.current?.dismiss?.();
      } else if (activeModal === 'departureBoard') {
        departureBoardRef.current?.dismiss?.();
      }
    } else {
      // No stack, go to main
      navigateToMain();
    }
  }, [modalStack, activeModal, navigateToMain]);

  // Dismiss current modal without navigation (just closes it)
  const dismissCurrent = useCallback(() => {
    goBack();
  }, [goBack]);

  // Handle when a modal finishes dismissing
  const handleModalDismissed = useCallback((type: ModalType) => {
    // Hide the dismissed modal
    if (type === 'main') {
      setShowMain(false);
    } else if (type === 'trainDetail') {
      setShowTrainDetail(false);
    } else if (type === 'departureBoard') {
      setShowDepartureBoard(false);
    }

    // Process pending transition
    const transition = pendingTransitionRef.current;
    if (transition?.target) {
      const target = transition.target;

      // Small delay to allow dismiss animation to complete
      setTimeout(() => {
        // Update modal data if needed
        if (target.data?.train) {
          setModalData(prev => ({ ...prev, train: target.data!.train! }));
        }
        if (target.data?.station) {
          setModalData(prev => ({ ...prev, station: target.data!.station! }));
        }

        // Show and slide in the target modal
        if (target.type === 'main') {
          setShowMain(true);
          setActiveModal('main');
          mainModalRef.current?.slideIn?.(target.initialSnap || 'half');
        } else if (target.type === 'trainDetail') {
          setShowTrainDetail(true);
          setActiveModal('trainDetail');
          // TrainDetail modal will auto-animate in on mount
        } else if (target.type === 'departureBoard') {
          setShowDepartureBoard(true);
          setActiveModal('departureBoard');
          // DepartureBoard modal will auto-animate in on mount
        }

        // Clear the pending transition
        pendingTransitionRef.current = null;
      }, 50);
    }
  }, []);

  const value: ModalContextType = {
    activeModal,
    modalData,
    currentSnap,
    showMain,
    showTrainDetail,
    showDepartureBoard,
    mainModalRef,
    detailModalRef,
    departureBoardRef,
    modalStack,
    navigateToTrain,
    navigateToStation,
    navigateToMain,
    goBack,
    dismissCurrent,
    handleModalDismissed,
    handleSnapChange,
    getInitialSnap,
  };

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
};
