
import React, { ReactNode } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { COLORS } from '../src/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
}

export function Screen({
  children,
  scroll = true,
}: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe}>

      {scroll ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.body}>
            {children}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.fixedBody}>
          {children}
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
  },

  body: {
    flexGrow: 1,
    padding: 20,
  },

  fixedBody: {
    flex: 1,
    padding: 0,
  },
});
