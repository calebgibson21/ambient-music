import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useMusic } from '../context/MusicContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WAVE_MIN_SCALE = 0.15;
const WAVE_PULSE_MIN = 0.3;

// Animated wave bar with entrance animation (duplicated from MusicPlayer.tsx)
function WaveBar({ delay, isAnimating, entranceDelay }: { delay: number; isAnimating: boolean; entranceDelay: number }) {
  const scaleY = useRef(new Animated.Value(WAVE_MIN_SCALE)).current;
  const [hasEntered, setHasEntered] = useState(false);
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const wasAnimatingRef = useRef(false);

  useEffect(() => {
    const wasAnimating = wasAnimatingRef.current;
    wasAnimatingRef.current = isAnimating;

    if (pulseAnimRef.current) {
      pulseAnimRef.current.stop();
      pulseAnimRef.current = null;
    }

    if (isAnimating && !hasEntered) {
      setHasEntered(true);

      Animated.timing(scaleY, {
        toValue: 1,
        duration: 300,
        delay: entranceDelay,
        useNativeDriver: true,
      }).start(() => {
        if (wasAnimatingRef.current) {
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
      Animated.timing(scaleY, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        if (wasAnimatingRef.current) {
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

// Status indicator with smooth transitions (duplicated from MusicPlayer.tsx)
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

  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    if (wasLoading && !isLoading) {
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
  }, [isLoading, loadingOpacity, visualizerOpacity]);

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  const shouldAnimateWaves = isPlaying && !isLoading;

  return (
    <View style={styles.statusIndicatorContainer}>
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

interface PlayingScreenProps {
  onClose: () => void;
}

export function PlayingScreen({ onClose }: PlayingScreenProps) {
  const { status, currentBook, metrics, pause, resume } = useMusic();
  const [intensity, setIntensity] = useState(50);
  const slideAnim = useRef(new Animated.Value(1)).current; // 1 = off screen (bottom), 0 = on screen

  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isBuffering = isPlaying && !metrics.isAudioPlaying;
  const isLoading = status === 'connecting' || isBuffering;

  // Animate in on mount
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
      tension: 65,
    }).start();
  }, [slideAnim]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      await pause();
    } else {
      await resume();
    }
  };

  const screenHeight = Dimensions.get('window').height;
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenHeight],
  });

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateY }] }]}>
      {/* Close button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={handleClose}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-down" size={28} color="#A1A1AA" />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
      {/* Book cover */}
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

      {/* Book title */}
      <Text style={styles.bookTitle} numberOfLines={2}>
        {currentBook?.title}
      </Text>


      {/* Status indicator */}
      <View style={styles.statusContainer}>
        <StatusIndicator
          isLoading={isLoading}
          isBuffering={isBuffering}
          isPlaying={isPlaying}
          isPaused={isPaused}
        />
      </View>

      {/* Play/Pause button */}
      <TouchableOpacity
        style={styles.playButton}
        onPress={handlePlayPause}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isLoading ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'}
          size={32}
          color="#A78BFA"
        />
      </TouchableOpacity>

      {/* Intensity slider */}
      <View style={styles.sliderContainer}>
        <Text style={styles.sliderLabel}>Intensity</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          value={intensity}
          onValueChange={setIntensity}
          minimumTrackTintColor="#A78BFA"
          maximumTrackTintColor="rgba(167, 139, 250, 0.2)"
          thumbTintColor="#A78BFA"
        />
        <Text style={styles.sliderValue}>{Math.round(intensity)}%</Text>
      </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F0F14',
    zIndex: 100,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 101,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(39, 39, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 24,
  },
  // Cover
  coverContainer: {
    width: SCREEN_WIDTH * 0.6,
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#18181F',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    fontSize: 64,
    fontWeight: '600',
    color: '#52525B',
  },
  // Book title
  bookTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FAFAFA',
    marginTop: 24,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  // Status indicator
  statusContainer: {
    marginTop: 32,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIndicatorContainer: {
    position: 'relative',
    height: 24,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLayer: {
    position: 'absolute',
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visualizerLayer: {},
  loadingBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingBarTrack: {
    width: 80,
    height: 4,
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingBarShimmer: {
    width: 50,
    height: '100%',
    backgroundColor: '#A78BFA',
    borderRadius: 2,
  },
  loadingText: {
    fontSize: 12,
    color: '#A78BFA',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  visualizer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 24,
    gap: 4,
  },
  waveBar: {
    width: 5,
    height: 24,
    backgroundColor: '#A78BFA',
    borderRadius: 2,
  },
  // Play button
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  // Slider
  sliderContainer: {
    width: '80%',
    marginTop: 40,
    alignItems: 'center',
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    fontSize: 14,
    color: '#A1A1AA',
    marginTop: 4,
  },
});
