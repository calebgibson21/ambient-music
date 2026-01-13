import React from 'react';
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
} from 'react-native';
import { Book } from '../types/book';
import { useBookSearch } from '../hooks/useBookSearch';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
        {book.year && (
          <Text style={styles.bookYear}>{book.year}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

interface SelectedBookViewProps {
  book: Book;
  onBack: () => void;
}

function SelectedBookView({ book, onBack }: SelectedBookViewProps) {
  return (
    <View style={styles.selectedContainer}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back to search</Text>
      </TouchableOpacity>
      
      <View style={styles.selectedContent}>
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
        
        <Text style={styles.selectedTitle}>{book.title}</Text>
        
        {book.authors.length > 0 && (
          <Text style={styles.selectedAuthor}>
            by {book.authors.join(', ')}
          </Text>
        )}
        
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
        
        {book.subjects && book.subjects.length > 0 && (
          <View style={styles.subjectsContainer}>
            {book.subjects.slice(0, 3).map((subject, index) => (
              <View key={index} style={styles.subjectTag}>
                <Text style={styles.subjectText}>{subject}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.matchMusicButton}>
          <Text style={styles.matchMusicButtonText}>Find Ambient Music</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function BookSearch() {
  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    hasSearched,
    selectedBook,
    selectBook,
    clearSelection,
  } = useBookSearch();

  if (selectedBook) {
    return <SelectedBookView book={selectedBook} onBack={clearSelection} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Find a Book</Text>
        <Text style={styles.subtitle}>
          Search for a book to match with ambient music
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title or author..."
          placeholderTextColor="#6B7280"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {isLoading && (
          <ActivityIndicator
            style={styles.loadingIndicator}
            size="small"
            color="#A78BFA"
          />
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {hasSearched && results.length === 0 && !isLoading && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No books found</Text>
          <Text style={styles.emptySubtext}>
            Try a different search term
          </Text>
        </View>
      )}

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
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 15,
    color: '#71717A',
    marginTop: 6,
    letterSpacing: 0.2,
  },
  searchContainer: {
    marginHorizontal: 24,
    marginBottom: 20,
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
  bookYear: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 4,
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
    paddingHorizontal: 32,
    paddingTop: 20,
  },
  selectedCoverContainer: {
    width: SCREEN_WIDTH * 0.5,
    height: SCREEN_WIDTH * 0.75,
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
    fontSize: 64,
  },
  selectedTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: '#FAFAFA',
    textAlign: 'center',
    marginTop: 28,
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  selectedAuthor: {
    fontSize: 17,
    color: '#A1A1AA',
    marginTop: 10,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 20,
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
  subjectsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
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
  matchMusicButton: {
    marginTop: 40,
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
  matchMusicButtonText: {
    color: '#0F0F14',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
