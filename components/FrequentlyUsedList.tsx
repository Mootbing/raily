import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { COLORS, styles } from '../screens/styles';

export interface FrequentlyUsedItemProps {
  id: string;
  name: string;
  code: string;
  subtitle: string;
  type: 'train' | 'station';
}

export function FrequentlyUsedList({ items, onSelect }: { items: FrequentlyUsedItemProps[]; onSelect: (item: FrequentlyUsedItemProps) => void }) {
  return (
    <>
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.frequentlyUsedItem}
          activeOpacity={0.7}
          onPress={() => onSelect(item)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${item.subtitle}`}
          accessibilityHint={`Select ${item.type === 'train' ? 'train route' : 'station'} ${item.name}`}
        >
          <View style={styles.frequentlyUsedIcon}>
            {item.type === 'train' && (
              <Ionicons name="train" size={24} color="#8B5CF6" />
            )}
            {item.type === 'station' && (
              <Ionicons name="location" size={24} color="#10B981" />
            )}
          </View>
          <View style={styles.frequentlyUsedText}>
            <Text style={styles.frequentlyUsedName}>{item.name}</Text>
            <Text style={styles.frequentlyUsedSubtitle}>{item.subtitle}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={COLORS.secondary} />
        </TouchableOpacity>
      ))}
    </>
  );
}
