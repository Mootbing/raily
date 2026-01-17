import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { COLORS, styles } from '../screens/styles';

export function RefreshButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!!disabled}
      style={styles.refreshButton}
      activeOpacity={0.7}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Refresh train schedules"
    >
      <Ionicons 
        name="refresh" 
        size={24} 
        color={disabled ? COLORS.secondary : COLORS.accentBlue}
        style={disabled ? styles.refreshIconSpinning : undefined}
      />
    </TouchableOpacity>
  );
}
