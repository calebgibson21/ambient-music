import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { useMusic } from '../context/MusicContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Animated wave bar component for visualizer
function WaveBar({ delay }: { delay: number }) {
  const animValue = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 400 + Math.random() * 200,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(animValue, {
          toValue: 0.3,
          duration: 400 + Math.random() * 200,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animValue, delay]);

  return (
    <Animated.View
      style={[
        styles.waveBar,
        {
          transform: [{ scaleY: animValue }],
        },
      ]}
    />
  );
}

// Audio visualizer component
function AudioVisualizer({ isPlaying }: { isPlaying: boolean }) {
  if (!isPlaying) {
    return (
      <View style={styles.visualizer}>
        {[...Array(5)].map((_, i) => (
          <View key={i} style={[styles.waveBar, { opacity: 0.3 }]} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.visualizer}>
      {[...Array(5)].map((_, i) => (
        <WaveBar key={i} delay={i * 100} />
      ))}
    </View>
  );
}

/**
 * Floating music player component that appears when music is playing.
 * 
 * Features:
 * - Minimized view showing current book and controls
 * - Expandable to show music prompts/mood
 * - Play/pause/stop controls
 */
export function MusicPlayer() {
  const { status, currentBook, prompts, pause, resume, stop } = useMusic();
  const [isExpanded, setIsExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(100)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;

  const isVisible = status !== 'idle' && currentBook !== null;
  const isPlaying = status === 'playing';
  const isLoading = status === 'connecting';

  // Slide in/out animation
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isVisible ? 0 : 100,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [isVisible, slideAnim]);

  // Expand/collapse animation
  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }, [isExpanded, expandAnim]);

  if (!isVisible) {
    return null;
  }

  const handlePlayPause = async () => {
    if (isPlaying) {
      await pause();
    } else {
      await resume();
    }
  };

  const expandedHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 120],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Main player bar */}
      <TouchableOpacity
        style={styles.mainBar}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.9}
      >
        {/* Book cover thumbnail */}
        <View style={styles.coverContainer}>
          {currentBook?.coverUrl ? (
            <Image
              source={{ uri: currentBook.coverUrl }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.coverPlaceholderText}>
                {currentBook?.title.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Book info and visualizer */}
        <View style={styles.infoContainer}>
          <Text style={styles.bookTitle} numberOfLines={1}>
            {currentBook?.title}
          </Text>
          <View style={styles.statusRow}>
            {isLoading ? (
              <Text style={styles.statusText}>Generating music...</Text>
            ) : (
              <AudioVisualizer isPlaying={isPlaying} />
            )}
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handlePlayPause}
            disabled={isLoading}
          >
            <Text style={styles.controlIcon}>
              {isLoading ? '⏳' : isPlaying ? '⏸' : '▶️'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={stop}
          >
            <Text style={styles.controlIcon}>⏹</Text>
          </TouchableOpacity>
        </View>

        {/* Expand indicator */}
        <Text style={styles.expandIcon}>
          {isExpanded ? '▼' : '▲'}
        </Text>
      </TouchableOpacity>

      {/* Expanded content */}
      <Animated.View style={[styles.expandedContent, { height: expandedHeight }]}>
        <Text style={styles.promptsLabel}>Music Mood</Text>
        <View style={styles.promptsContainer}>
          {prompts.slice(0, 4).map((prompt, index) => (
            <View key={index} style={styles.promptTag}>
              <Text style={styles.promptText}>{prompt.text}</Text>
            </View>
          ))}
        </View>
        {status === 'error' && (
          <Text style={styles.errorText}>Connection error. Try again.</Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90, // Above bottom navigation
    left: 16,
    right: 16,
    backgroundColor: '#1E1E28',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D2D3A',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  mainBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingRight: 8,
  },
  coverContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#27272A',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#3D3D4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#71717A',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FAFAFA',
    letterSpacing: -0.2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#A78BFA',
    fontStyle: 'italic',
  },
  visualizer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 16,
    gap: 3,
  },
  waveBar: {
    width: 4,
    height: 16,
    backgroundColor: '#A78BFA',
    borderRadius: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlIcon: {
    fontSize: 18,
  },
  expandIcon: {
    fontSize: 10,
    color: '#52525B',
    marginLeft: 4,
  },
  expandedContent: {
    overflow: 'hidden',
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
  },
  promptsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  promptsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptTag: {
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
  },
  promptText: {
    fontSize: 13,
    color: '#A78BFA',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 8,
  },
});
