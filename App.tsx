import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, SafeAreaView, Platform, TouchableOpacity, Text } from 'react-native';
import { BookSearch } from './src/components/BookSearch';
import { ReadingList } from './src/components/ReadingList';
import { MusicPlayer } from './src/components/MusicPlayer';
import { MusicProvider } from './src/context/MusicContext';

type Tab = 'search' | 'list';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('search');

  return (
    <MusicProvider>
      <View style={styles.container}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safeArea}>
          {activeTab === 'search' ? <BookSearch /> : <ReadingList />}
          
          {/* Floating Music Player */}
          <MusicPlayer />
          
          {/* Bottom Navigation */}
          <View style={styles.bottomNav}>
          <TouchableOpacity
            style={[styles.navTab, activeTab === 'search' && styles.navTabActive]}
            onPress={() => setActiveTab('search')}
            activeOpacity={0.7}
          >
            <Text style={[styles.navIcon, activeTab === 'search' && styles.navIconActive]}>
              🔍
            </Text>
            <Text style={[styles.navLabel, activeTab === 'search' && styles.navLabelActive]}>
              Search
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.navTab, activeTab === 'list' && styles.navTabActive]}
            onPress={() => setActiveTab('list')}
            activeOpacity={0.7}
          >
            <Text style={[styles.navIcon, activeTab === 'list' && styles.navIconActive]}>
              📚
            </Text>
            <Text style={[styles.navLabel, activeTab === 'list' && styles.navLabelActive]}>
              My List
            </Text>
          </TouchableOpacity>
        </View>
        </SafeAreaView>
      </View>
    </MusicProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F14',
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  safeArea: {
    flex: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#18181F',
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    paddingVertical: 8,
    paddingHorizontal: 40,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
  },
  navTabActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
    opacity: 0.5,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71717A',
  },
  navLabelActive: {
    color: '#A78BFA',
  },
});
