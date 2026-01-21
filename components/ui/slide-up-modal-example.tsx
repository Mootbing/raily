import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import SlideUpModal from './slide-up-modal';

export default function SlideUpModalExample() {
  const [snapPoint, setSnapPoint] = useState<'min' | 'half' | 'max'>('half');

  return (
    <View style={styles.container}>
      {/* Background content */}
      <View style={styles.background}>
        <Text style={styles.backgroundText}>Main Content Area</Text>
        <Text style={styles.statusText}>
          Modal is at: {snapPoint === 'min' ? '25%' : snapPoint === 'half' ? '50%' : '95%'}
        </Text>
      </View>

      {/* Slide up modal */}
      <SlideUpModal onSnapChange={setSnapPoint}>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Glassmorphic Modal</Text>
          <Text style={styles.subtitle}>Drag the handle up or down to resize</Text>

          <View style={styles.contentBlock}>
            <Text style={styles.heading}>Features:</Text>
            <Text style={styles.text}>• Drag down to 25% of screen</Text>
            <Text style={styles.text}>• Default at 50% of screen</Text>
            <Text style={styles.text}>• Drag up to 95% of screen</Text>
            <Text style={styles.text}>• Glassmorphic design</Text>
            <Text style={styles.text}>• Smooth spring animations</Text>
          </View>

          <View style={styles.contentBlock}>
            <Text style={styles.heading}>How to use:</Text>
            <Text style={styles.text}>
              Touch and drag the handle at the top to slide the modal to different positions. Release to snap to the
              nearest position (25%, 50%, or 95%).
            </Text>
          </View>

          <View style={styles.contentBlock}>
            <Text style={styles.heading}>Sample Content:</Text>
            {[...Array(10)].map((_, i) => (
              <Text key={i} style={styles.text}>
                Item {i + 1} - This is scrollable content inside the modal
              </Text>
            ))}
          </View>
        </ScrollView>
      </SlideUpModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  backgroundText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  statusText: {
    fontSize: 16,
    color: '#aaa',
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#ddd',
    marginBottom: 24,
  },
  contentBlock: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  text: {
    fontSize: 15,
    color: '#eee',
    marginBottom: 8,
    lineHeight: 22,
  },
});
