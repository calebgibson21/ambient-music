import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Book, BookDetails } from '../types/book';
import { useBookDetailsAuto } from '../hooks/useBookDetails';
import { useMusic } from '../context/MusicContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BookDetailModalProps {
  book: Book | null;
  visible: boolean;
  onClose: () => void;
}

/**
 * Overlay that displays detailed book information with option to play ambient music.
 * Positioned above the bottom navigation bar.
 */
export function BookDetailModal({ book, visible, onClose }: BookDetailModalProps) {
  const { details, isLoading } = useBookDetailsAuto(book);
  const { status, currentBook, play } = useMusic();
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isAuthorBioExpanded, setIsAuthorBioExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(1)).current;

  // Reset expanded states when book changes or modal closes
  useEffect(() => {
    if (!visible || !book) {
      setIsDescriptionExpanded(false);
      setIsAuthorBioExpanded(false);
    }
  }, [visible, book?.id]);

  // Animate in when visible
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 65,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const isCurrentlyPlaying = currentBook?.id === book?.id;
  const isMusicLoading = status === 'connecting' && isCurrentlyPlaying;

  const handlePlayMusic = async () => {
    if (book && !isMusicLoading) {
      await play(book);
    }
  };

  if (!book || !visible) {
    return null;
  }

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_HEIGHT],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
        {/* Header with close button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="chevron-down" size={24} color="#A1A1AA" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Book cover */}
          <View style={styles.coverSection}>
            {book.coverUrl ? (
              <Image
                source={{ uri: book.coverUrl }}
                style={styles.coverImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Text style={styles.coverPlaceholderText}>
                  {book.title.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Book info */}
          <View style={styles.infoSection}>
            <Text style={styles.title}>{book.title}</Text>
            
            {book.authors.length > 0 && (
              <Text style={styles.authors}>{book.authors.join(', ')}</Text>
            )}

            {book.year && (
              <Text style={styles.year}>Published {book.year}</Text>
            )}

            {/* Play Ambient Music button */}
            <TouchableOpacity
              style={[
                styles.playMusicButton,
                isCurrentlyPlaying && styles.playMusicButtonActive,
              ]}
              onPress={handlePlayMusic}
              disabled={isMusicLoading}
              activeOpacity={0.8}
            >
              {isMusicLoading ? (
                <ActivityIndicator size="small" color="#A78BFA" />
              ) : (
                <>
                  <Ionicons
                    name={isCurrentlyPlaying ? 'musical-notes' : 'musical-note'}
                    size={20}
                    color="#A78BFA"
                  />
                  <Text style={styles.playMusicText}>
                    {isCurrentlyPlaying ? 'Playing Ambient Music' : 'Play Ambient Music'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Loading indicator for book details */}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#A78BFA" />
                <Text style={styles.loadingText}>Loading details...</Text>
              </View>
            )}

            {/* Subjects/Genres */}
            {(details?.fullSubjects || book.subjects) && (
              <View style={styles.subjectsSection}>
                <Text style={styles.sectionTitle}>Subjects</Text>
                <View style={styles.subjectsContainer}>
                  {(details?.fullSubjects || book.subjects)?.slice(0, 8).map((subject, index) => (
                    <View key={index} style={styles.subjectTag}>
                      <Text style={styles.subjectText}>{subject}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Description */}
            {details?.description && (
              <View style={styles.descriptionSection}>
                <Text style={styles.sectionTitle}>About This Book</Text>
                <Text
                  style={styles.description}
                  numberOfLines={isDescriptionExpanded ? undefined : 4}
                >
                  {details.description}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                  style={styles.showMoreButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.showMoreText}>
                    {isDescriptionExpanded ? 'Show less' : 'Show more'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Author bio */}
            {details?.author?.bio && (
              <View style={styles.authorSection}>
                <Text style={styles.sectionTitle}>About the Author</Text>
                <View style={styles.authorCard}>
                  {details.author.photoUrl && (
                    <Image
                      source={{ uri: details.author.photoUrl }}
                      style={styles.authorPhoto}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.authorInfo}>
                    <Text style={styles.authorName}>{details.author.name}</Text>
                    {(details.author.birthDate || details.author.deathDate) && (
                      <Text style={styles.authorDates}>
                        {details.author.birthDate}
                        {details.author.deathDate && ` – ${details.author.deathDate}`}
                      </Text>
                    )}
                  </View>
                </View>
                <Text
                  style={styles.authorBio}
                  numberOfLines={isAuthorBioExpanded ? undefined : 3}
                >
                  {details.author.bio}
                </Text>
                <TouchableOpacity
                  onPress={() => setIsAuthorBioExpanded(!isAuthorBioExpanded)}
                  style={styles.showMoreButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.showMoreText}>
                    {isAuthorBioExpanded ? 'Show less' : 'Show more'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
    </Animated.View>
  );
}

const BOTTOM_NAV_HEIGHT = 70;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: BOTTOM_NAV_HEIGHT,
    backgroundColor: '#0F0F14',
    zIndex: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 8,
  },
  closeButton: {
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
  scrollContent: {
    paddingBottom: 40,
  },
  coverSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  coverImage: {
    width: SCREEN_WIDTH * 0.45,
    height: SCREEN_WIDTH * 0.45 * 1.5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  coverPlaceholder: {
    width: SCREEN_WIDTH * 0.45,
    height: SCREEN_WIDTH * 0.45 * 1.5,
    borderRadius: 12,
    backgroundColor: '#27272A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    fontSize: 48,
    fontWeight: '600',
    color: '#52525B',
  },
  infoSection: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FAFAFA',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  authors: {
    fontSize: 17,
    color: '#A78BFA',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  year: {
    fontSize: 14,
    color: '#71717A',
    textAlign: 'center',
    marginTop: 6,
  },
  playMusicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderWidth: 1,
    borderColor: '#A78BFA',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: 24,
    gap: 10,
  },
  playMusicButtonActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.25)',
  },
  playMusicText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A78BFA',
    letterSpacing: 0.2,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#71717A',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  descriptionSection: {
    marginTop: 32,
  },
  description: {
    fontSize: 16,
    color: '#D4D4D8',
    lineHeight: 26,
  },
  showMoreButton: {
    marginTop: 8,
    paddingVertical: 4,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A78BFA',
  },
  subjectsSection: {
    marginTop: 32,
  },
  subjectsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectTag: {
    backgroundColor: '#1E1E28',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  subjectText: {
    fontSize: 13,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  authorSection: {
    marginTop: 32,
  },
  authorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#27272A',
  },
  authorInfo: {
    marginLeft: 14,
    flex: 1,
  },
  authorName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FAFAFA',
  },
  authorDates: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 4,
  },
  authorBio: {
    fontSize: 15,
    color: '#A1A1AA',
    lineHeight: 24,
  },
});
