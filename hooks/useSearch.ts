import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';

export function useSearch() {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  return { isSearchFocused, setIsSearchFocused, searchQuery, setSearchQuery, searchInputRef };
}
