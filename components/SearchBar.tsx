import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { COLORS, styles } from '../screens/styles';

export function SearchBar({
  isSearchFocused,
  searchQuery,
  setIsSearchFocused,
  setSearchQuery,
  snapToPoint,
  searchInputRef,
}: {
  isSearchFocused: boolean;
  searchQuery: string;
  setIsSearchFocused: (v: boolean) => void;
  setSearchQuery: (v: string) => void;
  snapToPoint?: (p: 'min' | 'half' | 'max') => void;
  searchInputRef: React.RefObject<TextInput | null>;
}) {
  // Always render as a button, but show different UI when search is active
  if (isSearchFocused) {
    return (
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.secondary} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder={'Train name, station name/code, or route number'}
          placeholderTextColor={COLORS.secondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onBlur={() => {
            setIsSearchFocused(false);
            snapToPoint?.('min');
          }}
          accessible={true}
          accessibilityLabel="Search for trains or stations"
          accessibilityHint="Enter train name, station name, or route to search"
          autoFocus
        />
        <TouchableOpacity
          onPress={() => {
            setIsSearchFocused(false);
            setSearchQuery('');
            snapToPoint?.('min');
          }}
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Close search"
        >
          <Ionicons name="close-circle" size={20} color={COLORS.secondary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.searchContainer}
      activeOpacity={0.7}
      onPress={() => {
        snapToPoint?.('max');
        setIsSearchFocused(true);
        // Immediate focus without delay
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel="Search for trains"
      accessibilityHint="Tap to start searching"
    >
      <Ionicons name="search" size={20} color={COLORS.secondary} />
      <Text style={styles.searchButtonText}>Train name, station name/code...</Text>
    </TouchableOpacity>
  );
}
