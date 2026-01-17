import { BlurView } from 'expo-blur';
import React, { createContext, useEffect, useState } from 'react';
import { Dimensions, Platform, StatusBar, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { AppColors, BorderRadius, Spacing } from '../../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SNAP_POINTS = {
  MIN: SCREEN_HEIGHT * 0.35,
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
  // Get safe area insets dynamically
  const screenHeight = Dimensions.get('screen').height;
  const windowHeight = Dimensions.get('window').height;
  const safeAreaBottomInset = screenHeight - windowHeight;
  // Get status bar height to extend modal to true top of screen
  const statusBarHeight = StatusBar.currentHeight || 0;
  
  const translateY = useSharedValue(SCREEN_HEIGHT - SNAP_POINTS.HALF);
  const context = useSharedValue({ y: 0 });
  const currentSnap = useSharedValue<'min' | 'half' | 'max'>('half');
  const scrollOffset = useSharedValue(0);
  const modalHeight = useSharedValue(SNAP_POINTS.HALF);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const glowOpacity = useSharedValue(0);

  React.useImperativeHandle(ref, () => ({
    snapToPoint,
  }), []);

  useEffect(() => {
    // Animate in on mount with subtle overshoot
    translateY.value = withSpring(SCREEN_HEIGHT - SNAP_POINTS.HALF, {
      damping: 40,
      stiffness: 280,
      overshootClamping: false,
    });
  }, []);

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
      damping: 40,
      stiffness: 280,
      overshootClamping: false,
    });
  };

  const panGesture = Gesture.Pan()
    .enableTrackpadTwoFingerGesture(true)
    .maxPointers(1)
    .onStart(() => {
      context.value = { y: translateY.value };
    })
    .onUpdate((event) => {
      // At fullscreen, only handle gesture if scrolled to top
      if (currentSnap.value === 'max' && scrollOffset.value > 0) {
        return;
      }

      // Update position within bounds
      const newY = context.value.y + event.translationY;
      translateY.value = Math.max(
        SCREEN_HEIGHT - SNAP_POINTS.MAX,
        Math.min(SCREEN_HEIGHT - SNAP_POINTS.MIN, newY)
      );
    })
    .onEnd((event) => {
      const velocity = event.velocityY;
      const currentY = translateY.value;
      const currentHeight = SCREEN_HEIGHT - currentY;

      // Quick swipe detection (velocity-based)
      const QUICK_SWIPE_VELOCITY = 1000;
      const isQuickSwipeUp = velocity < -QUICK_SWIPE_VELOCITY;
      const isQuickSwipeDown = velocity > QUICK_SWIPE_VELOCITY;

      let targetSnap: 'min' | 'half' | 'max';

      if (isQuickSwipeUp) {
        // Quick swipe up -> fullscreen
        targetSnap = 'max';
      } else if (isQuickSwipeDown) {
        // Quick swipe down -> collapse
        targetSnap = 'min';
      } else {
        // Careful/slow swipe -> snap to closest
        const distances = [
          { point: SNAP_POINTS.MIN, distance: Math.abs(currentHeight - SNAP_POINTS.MIN), key: 'min' as const },
          { point: SNAP_POINTS.HALF, distance: Math.abs(currentHeight - SNAP_POINTS.HALF), key: 'half' as const },
          { point: SNAP_POINTS.MAX, distance: Math.abs(currentHeight - SNAP_POINTS.MAX), key: 'max' as const },
        ];

        const closest = distances.reduce((prev, curr) =>
          curr.distance < prev.distance ? curr : prev
        );

        targetSnap = closest.key;
      }

      // Apply the snap
      const targetHeight = SNAP_POINTS[targetSnap.toUpperCase() as 'MIN' | 'HALF' | 'MAX'];
      const targetY = SCREEN_HEIGHT - targetHeight;

      currentSnap.value = targetSnap;
      modalHeight.value = targetHeight;

      runOnJS(setIsFullscreen)(targetSnap === 'max');
      runOnJS(setIsCollapsed)(targetSnap === 'min');

      if (onSnapChange) {
        runOnJS(onSnapChange)(targetSnap);
      }

      if (onHeightChange) {
        runOnJS(onHeightChange)(targetHeight);
      }

      translateY.value = withSpring(targetY, {
        damping: 40,
        stiffness: 280,
        overshootClamping: false,
      });
    })
    .simultaneousWithExternalGesture();

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const animatedBorderRadius = useAnimatedStyle(() => {
    // Keep border radius constant at BorderRadius.xl (32)
    return {
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
    };
  });

  const animatedBackground = useAnimatedStyle(() => {
    // Calculate current height of modal
    const currentHeight = SCREEN_HEIGHT - translateY.value;

    // Progress from HALF (50%) to MAX (95%)
    const halfHeight = SNAP_POINTS.HALF;
    const maxHeight = SNAP_POINTS.MAX;

    // Calculate interpolation progress (0 at 50%, 1 at 95%)
    const progress = Math.max(0, Math.min(1, (currentHeight - halfHeight) / (maxHeight - halfHeight)));

    // Interpolate background opacity
    // At 50%: rgba(20, 20, 25, 0.75) - semi-transparent
    // At 95%: rgba(20, 20, 25, 1.0) - fully opaque (black)
    const baseOpacity = Platform.OS === 'android' ? 0.8 : 0.75;
    const targetOpacity = 1.0;
    const opacity = baseOpacity + (targetOpacity - baseOpacity) * progress;

    // Interpolate border opacity (fade out)
    // At 50%: 1.0 (fully visible)
    // At 95%: 0.0 (invisible)
    const borderOpacity = 1 - progress;

    return {
      backgroundColor: `rgba(20, 20, 25, ${opacity})`,
      borderColor: `rgba(255, 255, 255, ${0.15 * borderOpacity})`,
      borderWidth: 1,
    };
  });

  const animatedMargins = useAnimatedStyle(() => {
    // Calculate current height of modal
    const currentHeight = SCREEN_HEIGHT - translateY.value;

    // Progress from HALF (50%) to MAX (95%)
    const halfHeight = SNAP_POINTS.HALF;
    const maxHeight = SNAP_POINTS.MAX;

    // Calculate interpolation progress (0 at 50%, 1 at 95%)
    const progress = Math.max(0, Math.min(1, (currentHeight - halfHeight) / (maxHeight - halfHeight)));

    // Interpolate horizontal margins from 10px to 0px
    // At 35% and 50%: 10px margins
    // At 95%: 0px margins
    const horizontalMargin = 10 * (1 - progress);

    // Add 15px top margin at fullscreen (95%)
    const topMargin = 15 * progress;

    return {
      marginLeft: horizontalMargin,
      marginRight: horizontalMargin,
      marginTop: topMargin,
    };
  });

  const animatedGlow = useAnimatedStyle(() => {
    return {
      shadowOpacity: 0.3 + glowOpacity.value * 0.2,
      shadowRadius: 20 + glowOpacity.value * 10,
    };
  });

  const handlePressIn = () => {
    glowOpacity.value = withTiming(1, { duration: 150 });
  };

  const handlePressOut = () => {
    glowOpacity.value = withTiming(0, { duration: 300 });
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <SlideUpModalContext.Provider value={{ isFullscreen, isCollapsed, scrollOffset, panGesture, modalHeight, snapToPoint }}>
          <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut}>
            <Animated.View
              style={[
                styles.blurContainer,
                animatedBorderRadius,
                animatedBackground,
                animatedMargins,
                animatedGlow,
                isFullscreen && styles.blurContainerFullscreen,
              ]}
            >
              <Animated.View style={[StyleSheet.absoluteFill, animatedBorderRadius, { overflow: 'hidden' }]}>
                <BlurView
                  intensity={40}
                  style={StyleSheet.absoluteFill}
                >
                  <Animated.View style={styles.content}>
                    <View style={styles.handleContainer} />
                    <View style={styles.childrenContainer}>{children}</View>
                  </Animated.View>
                </BlurView>
              </Animated.View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </SlideUpModalContext.Provider>
      </Animated.View>
    </GestureDetector>
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
    // backgroundColor and borderColor are now animated
    borderBottomWidth: 0,
    shadowColor: AppColors.shadow,
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  blurContainerFullscreen: {
    borderWidth: 0,
    borderBottomWidth: 0,
    shadowOpacity: 0,
  },
  
  content: {
    flex: 1,
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
