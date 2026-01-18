import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Book, ReadingStatus, ReadingListItem, READING_STATUS_OPTIONS } from '../types/book';
import { useReadingList } from '../hooks/useReadingList';
import { useMusic } from '../context/MusicContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// Tab Bar Component
// ============================================================================

interface TabBarProps {
  activeTab: ReadingStatus;
  onTabChange: (tab: ReadingStatus) => void;
  counts: Record<ReadingStatus, number>;
}

function TabBar({ activeTab, onTabChange, counts }: TabBarProps) {
  const tabs: { value: ReadingStatus; label: string }[] = [
    { value: 'reading', label: 'Reading' },
    { value: 'want_to_read', label: 'Want to Read' },
    { value: 'finished', label: 'Finished' },
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.value}
          style={[
            styles.tab,
            activeTab === tab.value && styles.tabActive,
          ]}
          onPress={() => onTabChange(tab.value)}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.tabText,
            activeTab === tab.value && styles.tabTextActive,
          ]}>
            {tab.label}
          </Text>
          {counts[tab.value] > 0 && (
            <View style={[
              styles.tabBadge,
              activeTab === tab.value && styles.tabBadgeActive,
            ]}>
              <Text style={[
                styles.tabBadgeText,
                activeTab === tab.value && styles.tabBadgeTextActive,
              ]}>
                {counts[tab.value]}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ============================================================================
// Reading List Book Card
// ============================================================================

interface ReadingListCardProps {
  item: ReadingListItem;
  onViewDetails: () => void;
  onChangeStatus: (status: ReadingStatus) => void;
  onRemove: () => void;
  onPlayMusic: () => void;
  isPlaying: boolean;
}

function ReadingListCard({ item, onViewDetails, onChangeStatus, onRemove, onPlayMusic, isPlaying }: ReadingListCardProps) {
  const [showActions, setShowActions] = useState(false);
  const { book, status, dateAdded } = item;
  
  const formattedDate = new Date(dateAdded).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <TouchableOpacity
      style={styles.bookCard}
      onLongPress={() => setShowActions(true)}
      activeOpacity={0.8}
    >
      <View style={styles.coverContainer}>
        {book.coverUrl ? (
          <Image
            source={{ uri: book.coverUrl }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholderCover}>
            <Text style={styles.placeholderText}>
              {book.title.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitle} numberOfLines={2}>
          {book.title}
        </Text>
        {book.authors.length > 0 && (
          <Text style={styles.bookAuthor} numberOfLines={1}>
            {book.authors.join(', ')}
          </Text>
        )}
        <Text style={styles.dateAdded}>Added {formattedDate}</Text>
        
        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={[styles.playMusicButton, isPlaying && styles.playMusicButtonActive]}
            onPress={onPlayMusic}
          >
            <Ionicons
              name={isPlaying ? 'musical-notes' : 'musical-note'}
              size={14}
              color="#A78BFA"
            />
          </TouchableOpacity>
          
          {!showActions && (
            <TouchableOpacity 
              style={styles.actionsToggle}
              onPress={() => setShowActions(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color="#52525B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal
        visible={showActions}
        transparent
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowActions(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowActions(false)} />
          <View style={styles.actionsMenu}>
            <Text style={styles.actionsTitle}>{book.title}</Text>
            <TouchableOpacity
              style={styles.viewDetailsAction}
              onPress={() => {
                onViewDetails();
                setShowActions(false);
              }}
            >
              <Ionicons name="information-circle-outline" size={18} color="#A78BFA" style={styles.actionIcon} />
              <Text style={styles.viewDetailsText}>View Details</Text>
            </TouchableOpacity>
            <View style={styles.actionsDivider} />
            <Text style={styles.actionsSubtitle}>Change Status</Text>
            {READING_STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.actionOption,
                  status === option.value && styles.actionOptionActive,
                ]}
                onPress={() => {
                  onChangeStatus(option.value);
                  setShowActions(false);
                }}
              >
                <Ionicons 
                  name={
                    option.value === 'reading' ? 'book' : 
                    option.value === 'want_to_read' ? 'bookmark' : 'checkmark-circle'
                  } 
                  size={18} 
                  color={status === option.value ? '#A78BFA' : '#71717A'} 
                  style={styles.actionIcon}
                />
                <Text style={[
                  styles.actionOptionText,
                  status === option.value && styles.actionOptionTextActive,
                ]}>
                  {option.label}
                </Text>
                {status === option.value && (
                  <Ionicons name="checkmark" size={18} color="#A78BFA" />
                )}
              </TouchableOpacity>
            ))}
            <View style={styles.actionsDivider} />
            <TouchableOpacity
              style={styles.removeAction}
              onPress={() => {
                onRemove();
                setShowActions(false);
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" style={styles.actionIcon} />
              <Text style={styles.removeActionText}>Remove from List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelAction}
              onPress={() => setShowActions(false)}
            >
              <Text style={styles.cancelActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

interface EmptyStateProps {
  status: ReadingStatus;
}

function EmptyState({ status }: EmptyStateProps) {
  const messages: Record<ReadingStatus, { title: string; subtitle: string }> = {
    reading: {
      title: 'Nothing currently reading',
      subtitle: 'Add books you\'re reading from the search tab',
    },
    want_to_read: {
      title: 'Your reading wishlist is empty',
      subtitle: 'Save books you want to read later',
    },
    finished: {
      title: 'No finished books yet',
      subtitle: 'Mark books as finished when you complete them',
    },
  };

  const { title, subtitle } = messages[status];

  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateSubtitle}>{subtitle}</Text>
    </View>
  );
}

// ============================================================================
// Main ReadingList Component
// ============================================================================

interface ReadingListProps {
  onOpenBookDetail: (book: Book) => void;
}

export function ReadingList({ onOpenBookDetail }: ReadingListProps) {
  const [activeTab, setActiveTab] = useState<ReadingStatus>('reading');
  const { items, isLoading, getBooksByStatus, updateStatus, removeBook } = useReadingList();
  const { status: musicStatus, currentBook, play: playMusic } = useMusic();

  const counts: Record<ReadingStatus, number> = {
    reading: getBooksByStatus('reading').length,
    want_to_read: getBooksByStatus('want_to_read').length,
    finished: getBooksByStatus('finished').length,
  };

  const currentItems = getBooksByStatus(activeTab);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A78BFA" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Reading List</Text>
        <Text style={styles.subtitle}>
          {items.length} {items.length === 1 ? 'book' : 'books'} saved
        </Text>
      </View>

      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={counts}
      />

      {currentItems.length === 0 ? (
        <EmptyState status={activeTab} />
      ) : (
        <FlatList
          data={currentItems}
          keyExtractor={(item) => item.book.id}
          renderItem={({ item }) => (
            <ReadingListCard
              item={item}
              onViewDetails={() => onOpenBookDetail(item.book)}
              onChangeStatus={(status) => updateStatus(item.book.id, status)}
              onRemove={() => removeBook(item.book.id)}
              onPlayMusic={() => playMusic(item.book)}
              isPlaying={currentBook?.id === item.book.id && (musicStatus === 'playing' || musicStatus === 'paused')}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F14',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F0F14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '300',
    color: '#FAFAFA',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#71717A',
    marginTop: 6,
    letterSpacing: 0.2,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#1A1A24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272A',
    gap: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: '#A78BFA',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
  },
  tabTextActive: {
    color: '#A78BFA',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#27272A',
    borderRadius: 8,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.3)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  tabBadgeTextActive: {
    color: '#A78BFA',
  },

  // List
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Book Card
  bookCard: {
    flexDirection: 'row',
    backgroundColor: '#18181F',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  coverContainer: {
    width: 72,
    height: 108,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#27272A',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2D2D3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#52525B',
  },
  bookInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FAFAFA',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  bookAuthor: {
    fontSize: 14,
    color: '#A1A1AA',
    marginTop: 6,
  },
  dateAdded: {
    fontSize: 12,
    color: '#52525B',
    marginTop: 8,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    right: 0,
    gap: 4,
  },
  playMusicButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playMusicButtonActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.3)',
  },
  actionsToggle: {
    padding: 8,
  },

  // Actions Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  actionsMenu: {
    backgroundColor: '#1A1A24',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  actionsTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FAFAFA',
    textAlign: 'center',
    marginBottom: 16,
  },
  viewDetailsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  viewDetailsText: {
    flex: 1,
    fontSize: 16,
    color: '#A78BFA',
    fontWeight: '600',
  },
  actionsSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 12,
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  actionOptionActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  actionIcon: {
    marginRight: 12,
  },
  actionOptionText: {
    flex: 1,
    fontSize: 16,
    color: '#A1A1AA',
  },
  actionOptionTextActive: {
    color: '#A78BFA',
    fontWeight: '600',
  },
  actionsDivider: {
    height: 1,
    backgroundColor: '#27272A',
    marginVertical: 12,
  },
  removeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  removeActionText: {
    flex: 1,
    fontSize: 16,
    color: '#EF4444',
  },
  cancelAction: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: '#27272A',
  },
  cancelActionText: {
    fontSize: 16,
    color: '#A1A1AA',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#71717A',
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#52525B',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
