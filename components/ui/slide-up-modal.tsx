import { BlurView } from 'expo-blur';
import React, { createContext, useEffect, useState } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { BorderRadius, Spacing } from '../../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SNAP_POINTS = {
  MIN: SCREEN_HEIGHT * 0.15 + 30,
  HALF: SCREEN_HEIGHT * 0.5,
  MAX: SCREEN_HEIGHT * 0.95,
};

export const SlideUpModalContext = createContext<{
  isFullscreen: boolean;
  isCollapsed: boolean;
  scrollOffset: any;
  panGesture: any;
  modalHeight: any;
  snapToPoint?: (point: 'min' | 'half' | 'max') => void;
}>({
  isFullscreen: false,
  isCollapsed: false,
  scrollOffset: { value: 0 } as any,
  panGesture: null,
  modalHeight: { value: SCREEN_HEIGHT * 0.5 } as any,
});

interface SlideUpModalProps {
  children: React.ReactNode;
  onSnapChange?: (snapPoint: 'min' | 'half' | 'max') => void;
  onHeightChange?: (height: number) => void;
  onDismiss?: () => void;
}

export default React.forwardRef<{ snapToPoint: (point: 'min' | 'half' | 'max') => void }, SlideUpModalProps>(
  function SlideUpModal({ children, onSnapChange, onHeightChange, onDismiss }: SlideUpModalProps, ref: React.Ref<any>) {
  const translateY = useSharedValue(SCREEN_HEIGHT - SNAP_POINTS.HALF);
  const context = useSharedValue({ y: 0 });
  const currentSnap = useSharedValue<'min' | 'half' | 'max'>('half');
  const scrollOffset = useSharedValue(0);
  const modalHeight = useSharedValue(SNAP_POINTS.HALF);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  React.useImperativeHandle(ref, () => ({
    snapToPoint,
  }), []);

  useEffect(() => {
    // Animate in on mount
    translateY.value = withSpring(SCREEN_HEIGHT - SNAP_POINTS.HALF, {
      damping: 50,
      stiffness: 200,
    });
  }, []);

  const snapToClosest = (currentY: number) => {
    'worklet';
    const modalHeightValue = SCREEN_HEIGHT - currentY;
    
    // Calculate distances to each snap point
    const distances = [
      { point: SNAP_POINTS.MIN, distance: Math.abs(modalHeightValue - SNAP_POINTS.MIN), key: 'min' as const },
      { point: SNAP_POINTS.HALF, distance: Math.abs(modalHeightValue - SNAP_POINTS.HALF), key: 'half' as const },
      { point: SNAP_POINTS.MAX, distance: Math.abs(modalHeightValue - SNAP_POINTS.MAX), key: 'max' as const },
    ];
    
    // Find closest snap point
    const closest = distances.reduce((prev, curr) => 
      curr.distance < prev.distance ? curr : prev
    );
    
    currentSnap.value = closest.key;
    modalHeight.value = closest.point;
    
    if (onSnapChange) {
      runOnJS(onSnapChange)(closest.key);
    }
    
    if (onHeightChange) {
      runOnJS(onHeightChange)(closest.point);
    }
    
    runOnJS(setIsFullscreen)(closest.key === 'max');
    runOnJS(setIsCollapsed)(closest.key === 'min');
    
    return SCREEN_HEIGHT - closest.point;
  };

  const snapToPoint = (point: 'min' | 'half' | 'max') => {
    const snapPoint = point === 'min' ? SNAP_POINTS.MIN : point === 'half' ? SNAP_POINTS.HALF : SNAP_POINTS.MAX;
    const targetY = SCREEN_HEIGHT - snapPoint;
    
    currentSnap.value = point;
    modalHeight.value = snapPoint;
    
    if (onSnapChange) {
      runOnJS(onSnapChange)(point);
    }
    
    if (onHeightChange) {
      runOnJS(onHeightChange)(snapPoint);
    }
    
    runOnJS(setIsFullscreen)(point === 'max');
    runOnJS(setIsCollapsed)(point === 'min');
    
    translateY.value = withSpring(targetY, {
      damping: 50,
      stiffness: 200,
    });
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      // When content is scrolled, let ScrollView handle gestures until at top
      if (currentSnap.value === 'max' && scrollOffset.value > 0) {
        return;
      }
      // Limit dragging within bounds
      const newY = context.value.y + event.translationY;
      translateY.value = Math.max(
        SCREEN_HEIGHT - SNAP_POINTS.MAX,
        Math.min(SCREEN_HEIGHT - SNAP_POINTS.MIN, newY)
      );
    })
    .onEnd((event) => {
      // If at top of scroll and the user dragged down, collapse to MIN
      const atTop = scrollOffset.value <= 10;
      const draggedDown = (event?.translationY ?? 0) > 30 || (event?.velocityY ?? 0) > 800;
      if (atTop && draggedDown) {
        const targetY = SCREEN_HEIGHT - SNAP_POINTS.MIN;
        currentSnap.value = 'min';
        modalHeight.value = SNAP_POINTS.MIN;
        runOnJS(setIsFullscreen)(false);
        runOnJS(setIsCollapsed)(true);
        translateY.value = withSpring(targetY, {
          damping: 50,
          stiffness: 200,
        });
        if (onSnapChange) {
          runOnJS(onSnapChange)('min');
        }
        if (onHeightChange) {
          runOnJS(onHeightChange)(SNAP_POINTS.MIN);
        }
        return;
      }
      
      const snapPoint = snapToClosest(translateY.value);
      translateY.value = withSpring(snapPoint, {
        damping: 50,
        stiffness: 200,
      });
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <SlideUpModalContext.Provider value={{ isFullscreen, isCollapsed, scrollOffset, panGesture, modalHeight, snapToPoint }}>
        {Platform.OS === 'ios' || Platform.OS === 'android' ? (
          <BlurView intensity={40} style={[
            styles.blurContainer,
            !isFullscreen && {
              borderTopLeftRadius: BorderRadius.xl,
              borderTopRightRadius: BorderRadius.xl,
            }
          ]}>
            <GestureDetector gesture={panGesture}>
              <View style={styles.content}>
                <View style={styles.handleContainer} />
                <View style={styles.childrenContainer}>{children}</View>
              </View>
            </GestureDetector>
          </BlurView>
        ) : (
          <View style={[
            styles.glassWeb,
            styles.content,
            !isFullscreen && {
              borderTopLeftRadius: BorderRadius.xl,
              borderTopRightRadius: BorderRadius.xl,
            }
          ]}>
            <GestureDetector gesture={panGesture}>
              <View style={{ flex: 1 }}>
                <View style={styles.handleContainer} />
                <View style={styles.childrenContainer}>{children}</View>
              </View>
            </GestureDetector>
          </View>
        )}
      </SlideUpModalContext.Provider>
    </Animated.View>
  );
}
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
    zIndex: 1000,
  },
  blurContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: Platform.select({
      ios: 'rgba(20, 20, 25, 0.75)',
      android: 'rgba(20, 20, 25, 0.8)',
      default: 'rgba(20, 20, 25, 0.75)',
    }),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  glassWeb: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(20, 20, 25, 0.8)',
    backdropFilter: 'blur(20px)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderBottomWidth: 0,
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.25)',
  },
  content: {
    flex: 1,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingTop: Spacing.md,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  childrenContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
});
