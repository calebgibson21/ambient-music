import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Book, BookDetails, Genre, POPULAR_GENRES, ReadingStatus, READING_STATUS_OPTIONS } from '../types/book';
import { useBookSearch } from '../hooks/useBookSearch';
import { useBookDetailsAuto } from '../hooks/useBookDetails';
import { useSubjectBrowse } from '../hooks/useSubjectBrowse';
import { useReadingList } from '../hooks/useReadingList';
import { useMusic } from '../context/MusicContext';
import { SearchFilters } from './SearchFilters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// Book Card Component
// ============================================================================

interface BookCardProps {
  book: Book;
  onPress: () => void;
}

function BookCard({ book, onPress }: BookCardProps) {
  return (
    <TouchableOpacity
      style={styles.bookCard}
      onPress={onPress}
      activeOpacity={0.7}
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
        <View style={styles.bookMeta}>
          {book.year && (
            <Text style={styles.bookYear}>{book.year}</Text>
          )}
          {book.editionCount && book.editionCount > 1 && (
            <View style={styles.editionBadge}>
              <Text style={styles.editionBadgeText}>
                {book.editionCount} editions
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// Genre Chips Component
// ============================================================================

interface GenreChipsProps {
  selectedGenre: Genre | null;
  onSelectGenre: (genre: Genre) => void;
  onClearGenre: () => void;
}

function GenreChips({ selectedGenre, onSelectGenre, onClearGenre }: GenreChipsProps) {
  return (
    <View style={styles.genreSection}>
      <View style={styles.genreHeader}>
        <Text style={styles.genreSectionTitle}>Browse by Genre</Text>
        {selectedGenre && (
          <TouchableOpacity onPress={onClearGenre}>
            <Text style={styles.clearGenreText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.genreChipsContainer}
      >
        {POPULAR_GENRES.map((genre) => (
          <TouchableOpacity
            key={genre}
            style={[
              styles.genreChip,
              selectedGenre === genre && styles.genreChipSelected,
            ]}
            onPress={() => onSelectGenre(genre)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.genreChipText,
                selectedGenre === genre && styles.genreChipTextSelected,
              ]}
            >
              {genre}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Selected Book View Component (Enhanced with details)
// ============================================================================

interface SelectedBookViewProps {
  book: Book;
  details: BookDetails | null;
  isLoadingDetails: boolean;
  onBack: () => void;
  isInReadingList: boolean;
  currentStatus: ReadingStatus | undefined;
  onAddToList: (status: ReadingStatus) => void;
  onRemoveFromList: () => void;
  onPlayMusic: () => void;
  isMusicPlaying: boolean;
  isMusicLoading: boolean;
}

function SelectedBookView({ 
  book, 
  details, 
  isLoadingDetails, 
  onBack,
  isInReadingList,
  currentStatus,
  onAddToList,
  onRemoveFromList,
  onPlayMusic,
  isMusicPlaying,
  isMusicLoading,
}: SelectedBookViewProps) {
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isAuthorBioExpanded, setIsAuthorBioExpanded] = useState(false);
  const author = details?.author;
  const description = details?.description;
  const fullSubjects = details?.fullSubjects || book.subjects;

  return (
    <ScrollView style={styles.selectedContainer} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back to search</Text>
      </TouchableOpacity>

      <View style={styles.selectedContent}>
        {/* Cover Image */}
        <View style={styles.selectedCoverContainer}>
          {book.coverUrl ? (
            <Image
              source={{ uri: book.coverUrl.replace('-M.', '-L.') }}
              style={styles.selectedCover}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.placeholderCover, styles.selectedPlaceholder]}>
              <Text style={[styles.placeholderText, styles.selectedPlaceholderText]}>
                {book.title.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.selectedTitle}>{book.title}</Text>

        {/* Subjects */}
        {fullSubjects && fullSubjects.length > 0 && (
          <View style={styles.subjectsContainer}>
            {fullSubjects.slice(0, 6).map((subject, index) => (
              <View key={`subject-${index}`} style={styles.subjectTag}>
                <Text style={styles.subjectText}>{subject}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        <TouchableOpacity 
          style={[
            styles.matchMusicButton,
            isMusicPlaying && styles.matchMusicButtonActive,
          ]}
          onPress={onPlayMusic}
          disabled={isMusicLoading}
          activeOpacity={0.8}
        >
          {isMusicLoading ? (
            <ActivityIndicator size="small" color="#0F0F14" />
          ) : (
            <View style={styles.matchMusicButtonContent}>
              <Ionicons
                name={isMusicPlaying ? 'musical-notes' : 'musical-note'}
                size={16}
                color="#0F0F14"
              />
              <Text style={styles.matchMusicButtonText}>
                {isMusicPlaying ? 'Playing Ambient Music' : 'Play Ambient Music'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Reading List Button */}
        {isInReadingList ? (
          <View style={styles.readingListSection}>
            <View style={styles.inListBadge}>
              <Text style={styles.inListBadgeText}>
                {READING_STATUS_OPTIONS.find(o => o.value === currentStatus)?.label || 'In List'}
              </Text>
            </View>
            <View style={styles.readingListActions}>
              <TouchableOpacity 
                style={styles.changeStatusButton}
                onPress={() => setShowStatusPicker(!showStatusPicker)}
              >
                <Text style={styles.changeStatusButtonText}>Change Status</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.removeFromListButton}
                onPress={onRemoveFromList}
              >
                <Text style={styles.removeFromListButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.addToListButton}
            onPress={() => setShowStatusPicker(!showStatusPicker)}
          >
            <Text style={styles.addToListButtonText}>+ Add to Reading List</Text>
          </TouchableOpacity>
        )}

        {/* Status Picker */}
        {showStatusPicker && (
          <View style={styles.statusPicker}>
            {READING_STATUS_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.statusOption,
                  currentStatus === option.value && styles.statusOptionSelected,
                ]}
                onPress={() => {
                  onAddToList(option.value);
                  setShowStatusPicker(false);
                }}
              >
                <Text style={[
                  styles.statusOptionText,
                  currentStatus === option.value && styles.statusOptionTextSelected,
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Author Section */}
        {(book.authors.length > 0 || author) && (
          <View style={styles.authorSection}>
            {author?.photoUrl && (
              <Image
                source={{ uri: author.photoUrl }}
                style={styles.authorPhoto}
                resizeMode="cover"
              />
            )}
            <View style={styles.authorInfo}>
              <Text style={styles.selectedAuthor}>
                by {author?.name || book.authors.join(', ')}
              </Text>
              {author?.birthDate && (
                <Text style={styles.authorDates}>
                  {author.birthDate}
                  {author.deathDate ? ` – ${author.deathDate}` : ''}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Meta Tags */}
        <View style={styles.metaRow}>
          {book.year && (
            <View style={styles.metaTag}>
              <Text style={styles.metaTagText}>{book.year}</Text>
            </View>
          )}
          {book.pageCount && (
            <View style={styles.metaTag}>
              <Text style={styles.metaTagText}>{book.pageCount} pages</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {isLoadingDetails && !description && (
          <View style={styles.descriptionLoading}>
            <ActivityIndicator size="small" color="#A78BFA" />
            <Text style={styles.descriptionLoadingText}>Loading details...</Text>
          </View>
        )}

        {description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionLabel}>About this book</Text>
            <Text 
              style={styles.descriptionText} 
              numberOfLines={isDescriptionExpanded ? undefined : 3}
            >
              {description}
            </Text>
            <TouchableOpacity
              onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
              style={styles.expandButton}
              activeOpacity={0.7}
            >
              <Text style={styles.expandButtonText}>
                {isDescriptionExpanded ? 'Show less' : 'Show more'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Author Bio */}
        {author?.bio && (
          <View style={styles.authorBioContainer}>
            <Text style={styles.authorBioLabel}>About the author</Text>
            <Text 
              style={styles.authorBioText} 
              numberOfLines={isAuthorBioExpanded ? undefined : 3}
            >
              {author.bio}
            </Text>
            <TouchableOpacity
              onPress={() => setIsAuthorBioExpanded(!isAuthorBioExpanded)}
              style={styles.expandButton}
              activeOpacity={0.7}
            >
              <Text style={styles.expandButtonText}>
                {isAuthorBioExpanded ? 'Show less' : 'Show more'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </View>
    </ScrollView>
  );
}

// ============================================================================
// Main BookSearch Component
// ============================================================================

export function BookSearch() {
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const {
    query,
    setQuery,
    filters,
    updateFilter,
    clearFilters,
    results: searchResults,
    isLoading: isSearchLoading,
    error: searchError,
    hasSearched,
    selectedBook,
    selectBook,
    clearSelection,
  } = useBookSearch();

  const {
    selectedGenre,
    results: browseResults,
    isLoading: isBrowseLoading,
    error: browseError,
    workCount,
    browseGenre,
    clearBrowse,
  } = useSubjectBrowse();

  const { details, isLoading: isLoadingDetails } = useBookDetailsAuto(selectedBook);

  const { addBook, removeBook, isInList, getItemByBookId } = useReadingList();
  
  const { status: musicStatus, currentBook, play: playMusic } = useMusic();

  // Determine which results to show
  const isSearchMode = query.trim().length > 0 || hasSearched;
  const isBrowseMode = selectedGenre !== null;
  const results = isSearchMode ? searchResults : browseResults;
  const isLoading = isSearchMode ? isSearchLoading : isBrowseLoading;
  const error = isSearchMode ? searchError : browseError;

  const handleSelectGenre = (genre: Genre) => {
    setQuery(''); // Clear search when browsing
    browseGenre(genre);
  };

  const handleClearGenre = () => {
    clearBrowse();
  };

  const handleQueryChange = (text: string) => {
    if (selectedGenre) {
      clearBrowse(); // Clear browse when searching
    }
    setQuery(text);
  };

  // Show selected book view
  if (selectedBook) {
    const readingListItem = getItemByBookId(selectedBook.id);
    const isMusicPlaying = currentBook?.id === selectedBook.id && (musicStatus === 'playing' || musicStatus === 'paused');
    const isMusicLoading = currentBook?.id === selectedBook.id && musicStatus === 'connecting';
    
    return (
      <SelectedBookView
        book={selectedBook}
        details={details}
        isLoadingDetails={isLoadingDetails}
        onBack={clearSelection}
        isInReadingList={isInList(selectedBook.id)}
        currentStatus={readingListItem?.status}
        onAddToList={(status) => addBook(selectedBook, status)}
        onRemoveFromList={() => removeBook(selectedBook.id)}
        onPlayMusic={() => playMusic(selectedBook)}
        isMusicPlaying={isMusicPlaying}
        isMusicLoading={isMusicLoading}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Find a Book</Text>
        <Text style={styles.subtitle}>
          Search for a book to match with ambient music
        </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title or author..."
          placeholderTextColor="#6B7280"
          value={query}
          onChangeText={handleQueryChange}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {isSearchLoading && (
          <ActivityIndicator
            style={styles.loadingIndicator}
            size="small"
            color="#A78BFA"
          />
        )}
      </View>

      {/* Search Filters */}
      <SearchFilters
        filters={filters}
        onUpdateFilter={updateFilter}
        onClearFilters={clearFilters}
        isExpanded={filtersExpanded}
        onToggleExpand={() => setFiltersExpanded(!filtersExpanded)}
      />

      {/* Genre Browsing */}
      {!isSearchMode && (
        <GenreChips
          selectedGenre={selectedGenre}
          onSelectGenre={handleSelectGenre}
          onClearGenre={handleClearGenre}
        />
      )}

      {/* Browse Mode Header */}
      {isBrowseMode && !isSearchMode && (
        <View style={styles.browseHeader}>
          <Text style={styles.browseTitle}>{selectedGenre}</Text>
          <Text style={styles.browseCount}>
            {workCount.toLocaleString()} books
          </Text>
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Empty State */}
      {(hasSearched || isBrowseMode) && results.length === 0 && !isLoading && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No books found</Text>
          <Text style={styles.emptySubtext}>
            Try a different search term or genre
          </Text>
        </View>
      )}

      {/* Loading State for Browse */}
      {isBrowseLoading && !isSearchMode && (
        <View style={styles.browseLoadingContainer}>
          <ActivityIndicator size="large" color="#A78BFA" />
        </View>
      )}

      {/* Results List */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BookCard book={item} onPress={() => selectBook(item)} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
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
  searchContainer: {
    marginHorizontal: 24,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  searchInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#FAFAFA',
    letterSpacing: 0.3,
  },
  loadingIndicator: {
    marginRight: 16,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
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
  bookMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  bookYear: {
    fontSize: 13,
    color: '#71717A',
  },
  editionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
    borderRadius: 8,
  },
  editionBadgeText: {
    fontSize: 11,
    color: '#A78BFA',
    fontWeight: '500',
  },
  errorContainer: {
    marginHorizontal: 24,
    padding: 16,
    backgroundColor: '#2D1F1F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4A2828',
    marginBottom: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#71717A',
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#52525B',
    marginTop: 8,
  },

  // Genre Section
  genreSection: {
    marginBottom: 20,
  },
  genreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  genreSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A1A1AA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearGenreText: {
    fontSize: 13,
    color: '#A78BFA',
    fontWeight: '500',
  },
  genreChipsContainer: {
    paddingHorizontal: 24,
    gap: 8,
  },
  genreChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1A1A24',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    marginRight: 8,
  },
  genreChipSelected: {
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: '#A78BFA',
  },
  genreChipText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '500',
  },
  genreChipTextSelected: {
    color: '#A78BFA',
  },

  // Browse Header
  browseHeader: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  browseTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FAFAFA',
    letterSpacing: -0.3,
  },
  browseCount: {
    fontSize: 14,
    color: '#71717A',
    marginTop: 4,
  },
  browseLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  // Selected book view styles
  selectedContainer: {
    flex: 1,
    backgroundColor: '#0F0F14',
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButtonText: {
    color: '#A78BFA',
    fontSize: 15,
    fontWeight: '500',
  },
  selectedContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  selectedCoverContainer: {
    width: SCREEN_WIDTH * 0.45,
    height: SCREEN_WIDTH * 0.68,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#27272A',
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  selectedCover: {
    width: '100%',
    height: '100%',
  },
  selectedPlaceholder: {
    width: '100%',
    height: '100%',
  },
  selectedPlaceholderText: {
    fontSize: 56,
  },
  selectedTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FAFAFA',
    textAlign: 'center',
    marginTop: 24,
    letterSpacing: -0.3,
    lineHeight: 30,
  },

  // Author Section
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    paddingHorizontal: 20,
  },
  authorPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#27272A',
  },
  authorInfo: {
    flex: 1,
    alignItems: 'center',
  },
  selectedAuthor: {
    fontSize: 16,
    color: '#A1A1AA',
    textAlign: 'center',
  },
  authorDates: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 2,
  },

  // Meta Tags
  metaRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  metaTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1A1A24',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  metaTagText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '500',
  },

  // Description
  descriptionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 10,
  },
  descriptionLoadingText: {
    color: '#71717A',
    fontSize: 14,
  },
  descriptionContainer: {
    marginTop: 24,
    width: '100%',
    backgroundColor: '#18181F',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  descriptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 15,
    color: '#D4D4D8',
    lineHeight: 22,
  },
  expandButton: {
    marginTop: 10,
    paddingVertical: 4,
  },
  expandButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A78BFA',
  },

  // Author Bio
  authorBioContainer: {
    marginTop: 16,
    width: '100%',
    backgroundColor: '#18181F',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  authorBioLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  authorBioText: {
    fontSize: 15,
    color: '#D4D4D8',
    lineHeight: 22,
  },

  // Subjects
  subjectsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 20,
    gap: 8,
    paddingHorizontal: 8,
  },
  subjectTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
  },
  subjectText: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '500',
  },

  // Action Button
  matchMusicButton: {
    marginTop: 32,
    paddingHorizontal: 32,
    paddingVertical: 18,
    backgroundColor: '#A78BFA',
    borderRadius: 28,
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  matchMusicButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchMusicButtonText: {
    color: '#0F0F14',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  matchMusicButtonActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.25)',
    borderWidth: 2,
    borderColor: '#A78BFA',
  },

  // Reading List Styles
  readingListSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  inListBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    marginBottom: 12,
  },
  inListBadgeText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600',
  },
  readingListActions: {
    flexDirection: 'row',
    gap: 12,
  },
  changeStatusButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1A1A24',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  changeStatusButtonText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '500',
  },
  removeFromListButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  removeFromListButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
  },
  addToListButton: {
    marginTop: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: '#1A1A24',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#A78BFA',
  },
  addToListButtonText: {
    color: '#A78BFA',
    fontSize: 15,
    fontWeight: '600',
  },
  statusPicker: {
    marginTop: 16,
    width: '100%',
    backgroundColor: '#18181F',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  statusOption: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  statusOptionSelected: {
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
  },
  statusOptionText: {
    color: '#A1A1AA',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusOptionTextSelected: {
    color: '#A78BFA',
  },

  bottomPadding: {
    height: 50,
  },
});
