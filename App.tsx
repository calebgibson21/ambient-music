import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, SafeAreaView, Platform, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookSearch } from './src/components/BookSearch';
import { ReadingList } from './src/components/ReadingList';
import { PlayingScreen } from './src/components/PlayingScreen';
import { MusicPlayer } from './src/components/MusicPlayer';
import { BookDetailModal } from './src/components/BookDetailModal';
import { MusicProvider } from './src/context/MusicContext';
import { Book } from './src/types/book';

type Tab = 'search' | 'list';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('search');
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [selectedDetailBook, setSelectedDetailBook] = useState<Book | null>(null);

  return (
    <MusicProvider>
      <View style={styles.container}>
        <StatusBar style="light" />
        <SafeAreaView style={styles.safeArea}>
          {activeTab === 'search' ? <BookSearch /> : <ReadingList onOpenBookDetail={setSelectedDetailBook} />}

          {/* Floating Music Player - hidden when full-screen player is open */}
          {!isPlayerExpanded && <MusicPlayer onExpand={() => setIsPlayerExpanded(true)} />}
          
          {/* Bottom Navigation */}
          <View style={styles.bottomNav}>
          <TouchableOpacity
            style={[styles.navTab, activeTab === 'search' && styles.navTabActive]}
            onPress={() => setActiveTab('search')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'search' ? 'search' : 'search-outline'}
              size={22}
              color={activeTab === 'search' ? '#A78BFA' : '#71717A'}
            />
            <Text style={[styles.navLabel, activeTab === 'search' && styles.navLabelActive]}>
              Search
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.navTab, activeTab === 'list' && styles.navTabActive]}
            onPress={() => setActiveTab('list')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'list' ? 'library' : 'library-outline'}
              size={22}
              color={activeTab === 'list' ? '#A78BFA' : '#71717A'}
            />
            <Text style={[styles.navLabel, activeTab === 'list' && styles.navLabelActive]}>
              My List
            </Text>
          </TouchableOpacity>
        </View>
        </SafeAreaView>

        {/* Full-screen Player Overlay */}
        {isPlayerExpanded && (
          <PlayingScreen onClose={() => setIsPlayerExpanded(false)} />
        )}

        {/* Book Detail Overlay */}
        <BookDetailModal
          book={selectedDetailBook}
          visible={selectedDetailBook !== null}
          onClose={() => setSelectedDetailBook(null)}
        />
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
    zIndex: 100,
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
  navLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: '#71717A',
  },
  navLabelActive: {
    color: '#A78BFA',
  },
});
