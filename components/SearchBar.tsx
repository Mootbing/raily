import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  snapToPoint?: (p: 'min'|'half'|'max') => void;
  searchInputRef: React.RefObject<TextInput | null>;
}) {
  return (
    isSearchFocused ? (
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder={"Northeast Regional, BOS, or NER123"}
          placeholderTextColor={COLORS.secondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onBlur={() => {
            setIsSearchFocused(false);
            snapToPoint?.('half');
          }}
          accessible={true}
          accessibilityLabel="Search for trains or stations"
          accessibilityHint="Enter train name, station name, or route to search"
          autoFocus
        />
        <TouchableOpacity 
          onPress={() => {
            setIsSearchFocused(false);
            snapToPoint?.('half');
          }} 
          activeOpacity={0.7}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Close search"
        >
          <Ionicons name="close-circle" size={20} color="#888" />
        </TouchableOpacity>
      </View>
    ) : (
      <TouchableOpacity
        style={styles.searchContainer}
        activeOpacity={0.7}
        onPress={() => {
          setIsSearchFocused(true);
          snapToPoint?.('max');
          setTimeout(() => {
            searchInputRef.current?.focus();
          }, 300);
        }}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Search to add trains"
        accessibilityHint="Tap to start searching"
      >
        <Ionicons name="search" size={20} color="#888" />
        <Text style={styles.searchButtonText}>Search to add trains</Text>
      </TouchableOpacity>
    )
  );
}
