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
import { Ionicons } from '@expo/vector-icons';
import { useMusic } from '../context/MusicContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WAVE_MIN_SCALE = 0.15; // Minimal height when paused
const WAVE_PULSE_MIN = 0.3;  // Minimum during pulse animation

// Animated wave bar with entrance animation
function WaveBar({ delay, isAnimating, entranceDelay }: { delay: number; isAnimating: boolean; entranceDelay: number }) {
  const scaleY = useRef(new Animated.Value(WAVE_MIN_SCALE)).current;
  const [hasEntered, setHasEntered] = useState(false);
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const wasAnimatingRef = useRef(false);

  // Track previous animating state to detect transitions
  useEffect(() => {
    const wasAnimating = wasAnimatingRef.current;
    wasAnimatingRef.current = isAnimating;

    // Stop any existing animation first
    if (pulseAnimRef.current) {
      pulseAnimRef.current.stop();
      pulseAnimRef.current = null;
    }

    if (isAnimating && !hasEntered) {
      // First time animating - do entrance animation then start pulse
      setHasEntered(true);
      
      Animated.timing(scaleY, {
        toValue: 1,
        duration: 300,
        delay: entranceDelay,
        useNativeDriver: true,
      }).start(() => {
        // Start pulse animation after entrance
        if (wasAnimatingRef.current) { // Still animating after entrance completes
          const pulseAnim = Animated.loop(
            Animated.sequence([
              Animated.timing(scaleY, {
                toValue: WAVE_PULSE_MIN,
                duration: 400 + Math.random() * 200,
                delay,
                useNativeDriver: true,
              }),
              Animated.timing(scaleY, {
                toValue: 1,
                duration: 400 + Math.random() * 200,
                useNativeDriver: true,
              }),
            ])
          );
          pulseAnimRef.current = pulseAnim;
          pulseAnim.start();
        }
      });
    } else if (isAnimating && hasEntered) {
      // Resuming from pause - animate back up then restart pulse
      Animated.timing(scaleY, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        if (wasAnimatingRef.current) { // Still animating after grow-up completes
          const pulseAnim = Animated.loop(
            Animated.sequence([
              Animated.timing(scaleY, {
                toValue: WAVE_PULSE_MIN,
                duration: 400 + Math.random() * 200,
                delay,
                useNativeDriver: true,
              }),
              Animated.timing(scaleY, {
                toValue: 1,
                duration: 400 + Math.random() * 200,
                useNativeDriver: true,
              }),
            ])
          );
          pulseAnimRef.current = pulseAnim;
          pulseAnim.start();
        }
      });
    } else if (!isAnimating && hasEntered) {
      // Paused - settle to minimal height
      Animated.timing(scaleY, {
        toValue: WAVE_MIN_SCALE,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isAnimating, hasEntered, scaleY, delay, entranceDelay]);

  return (
    <Animated.View
      style={[
        styles.waveBar,
        {
          transform: [{ scaleY }],
        },
      ]}
    />
  );
}

// Status indicator with smooth transitions between loading and visualizer
function StatusIndicator({ 
  isLoading, 
  isBuffering, 
  isPlaying,
  isPaused,
}: { 
  isLoading: boolean; 
  isBuffering: boolean; 
  isPlaying: boolean;
  isPaused: boolean;
}) {
  const loadingOpacity = useRef(new Animated.Value(1)).current;
  const visualizerOpacity = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const prevIsLoadingRef = useRef(true);
  const hasEverShownVisualizerRef = useRef(false);

  // Shimmer animation for loading bar
  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  // Crossfade transition - react to isLoading changes
  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    if (wasLoading && !isLoading) {
      // Transition: loading -> not loading (show visualizer)
      hasEverShownVisualizerRef.current = true;
      Animated.parallel([
        Animated.timing(loadingOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(visualizerOpacity, {
          toValue: 1,
          duration: 400,
          delay: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!wasLoading && isLoading) {
      // Transition: not loading -> loading (show loading bar)
      hasEverShownVisualizerRef.current = false;
      Animated.parallel([
        Animated.timing(loadingOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(visualizerOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
    // No animation needed if isLoading didn't change (pause/resume)
  }, [isLoading, loadingOpacity, visualizerOpacity]);

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  // Determine if wave bars should animate (playing and not loading)
  const shouldAnimateWaves = isPlaying && !isLoading;

  return (
    <View style={styles.statusIndicatorContainer}>
      {/* Loading bar layer */}
      <Animated.View style={[styles.statusLayer, { opacity: loadingOpacity }]}>
        <View style={styles.loadingBarContainer}>
          <View style={styles.loadingBarTrack}>
            <Animated.View
              style={[
                styles.loadingBarShimmer,
                { transform: [{ translateX: shimmerTranslateX }] },
              ]}
            />
          </View>
          <Text style={styles.loadingText}>
            {isBuffering ? 'Buffering...' : 'Generating...'}
          </Text>
        </View>
      </Animated.View>

      {/* Visualizer layer - always rendered */}
      <Animated.View 
        style={[
          styles.statusLayer, 
          styles.visualizerLayer, 
          { opacity: visualizerOpacity }
        ]}
      >
        <View style={styles.visualizer}>
          {[...Array(5)].map((_, i) => (
            <WaveBar 
              key={i} 
              delay={i * 80} 
              isAnimating={shouldAnimateWaves}
              entranceDelay={i * 60}
            />
          ))}
        </View>
      </Animated.View>
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
  const { status, currentBook, prompts, metrics, pause, resume, stop } = useMusic();
  const [isExpanded, setIsExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(100)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;

  const isVisible = status !== 'idle' && currentBook !== null;
  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isBuffering = isPlaying && !metrics.isAudioPlaying;
  // Show loading bar until audio is actually playing through speakers
  const isLoading = status === 'connecting' || isBuffering;

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
    extrapolate: 'clamp',
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
            <StatusIndicator 
              isLoading={isLoading} 
              isBuffering={isBuffering} 
              isPlaying={isPlaying}
              isPaused={isPaused}
            />
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={handlePlayPause}
            disabled={isLoading}
          >
            <Ionicons
              name={isLoading ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'}
              size={18}
              color="#A78BFA"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={stop}
          >
            <Ionicons name="stop" size={18} color="#A78BFA" />
          </TouchableOpacity>
        </View>

        {/* Expand indicator */}
        <Ionicons
          name={isExpanded ? 'chevron-down' : 'chevron-up'}
          size={14}
          color="#52525B"
          style={styles.expandIcon}
        />
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
    height: 16,
  },
  statusIndicatorContainer: {
    position: 'relative',
    height: 16,
    minWidth: 100,
  },
  statusLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 16,
    justifyContent: 'center',
  },
  visualizerLayer: {
    left: 0,
  },
  loadingBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingBarTrack: {
    width: 60,
    height: 4,
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingBarShimmer: {
    width: 40,
    height: '100%',
    backgroundColor: '#A78BFA',
    borderRadius: 2,
  },
  loadingText: {
    fontSize: 11,
    color: '#A78BFA',
    fontWeight: '500',
    letterSpacing: 0.3,
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
  expandIcon: {
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
