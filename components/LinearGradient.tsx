import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface LinearGradientProps {
  colors: string[];
  style?: ViewStyle;
  children?: React.ReactNode;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

// Simple gradient simulation using overlapping views
// In production, use expo-linear-gradient
export function LinearGradient({ colors, style, children }: LinearGradientProps) {
  return (
    <View style={[styles.container, style, { backgroundColor: colors[0] }]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors[1], opacity: 0.5 }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
});
