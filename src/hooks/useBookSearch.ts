import { useState, useEffect, useCallback } from 'react';
import { Book, OpenLibrarySearchResponse, OpenLibraryBook, SearchFilters } from '../types/book';
import { useDebounce } from './useDebounce';

const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
const OPEN_LIBRARY_COVER_URL = 'https://covers.openlibrary.org/b/id';
const DEBOUNCE_DELAY = 400; // ms
const RESULTS_LIMIT = 20;

/**
 * Builds a cover image URL from an Open Library cover ID
 */
export function buildCoverUrl(coverId: number | undefined, size: 'S' | 'M' | 'L' = 'M'): string | undefined {
  if (!coverId) return undefined;
  return `${OPEN_LIBRARY_COVER_URL}/${coverId}-${size}.jpg`;
}

/**
 * Builds an author photo URL from an Open Library photo ID
 */
export function buildAuthorPhotoUrl(photoId: number | undefined, size: 'S' | 'M' | 'L' = 'M'): string | undefined {
  if (!photoId) return undefined;
  return `https://covers.openlibrary.org/a/id/${photoId}-${size}.jpg`;
}

/**
 * Normalizes an Open Library book result to our app's Book type
 */
function normalizeBook(doc: OpenLibraryBook): Book {
  return {
    id: doc.key,
    title: doc.title,
    authors: doc.author_name || [],
    authorKeys: doc.author_key,
    year: doc.first_publish_year,
    coverUrl: buildCoverUrl(doc.cover_i),
    isbn: doc.isbn?.[0],
    publisher: doc.publisher?.[0],
    subjects: doc.subject?.slice(0, 5),
    pageCount: doc.number_of_pages_median,
    editionCount: doc.edition_key?.length,
  };
}

/**
 * Deduplicates books by title + author combination to handle multiple editions
 */
function deduplicateBooks(books: Book[]): Book[] {
  const seen = new Map<string, Book>();
  
  for (const book of books) {
    const key = `${book.title.toLowerCase()}|${book.authors.join(',').toLowerCase()}`;
    
    // Keep the version with a cover, or the first one we see
    if (!seen.has(key) || (!seen.get(key)?.coverUrl && book.coverUrl)) {
      seen.set(key, book);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Builds the search query string with filters
 */
function buildSearchQuery(query: string, filters: SearchFilters): string {
  const parts: string[] = [query];
  
  if (filters.subject) {
    parts.push(`subject:"${filters.subject}"`);
  }
  
  if (filters.language) {
    parts.push(`language:${filters.language}`);
  }
  
  if (filters.yearMin || filters.yearMax) {
    const min = filters.yearMin || '*';
    const max = filters.yearMax || '*';
    parts.push(`first_publish_year:[${min} TO ${max}]`);
  }
  
  return parts.join(' ');
}

interface UseBookSearchResult {
  query: string;
  setQuery: (query: string) => void;
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  updateFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  clearFilters: () => void;
  results: Book[];
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
  selectedBook: Book | null;
  selectBook: (book: Book) => void;
  clearSelection: () => void;
}

const DEFAULT_FILTERS: SearchFilters = {
  subject: undefined,
  language: undefined,
  yearMin: undefined,
  yearMax: undefined,
  sort: 'relevance',
};

export function useBookSearch(): UseBookSearchResult {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const debouncedQuery = useDebounce(query, DEBOUNCE_DELAY);
  const debouncedFilters = useDebounce(filters, DEBOUNCE_DELAY);

  const searchBooks = useCallback(async (searchQuery: string, searchFilters: SearchFilters) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fullQuery = buildSearchQuery(searchQuery, searchFilters);
      
      const params = new URLSearchParams({
        q: fullQuery,
        limit: RESULTS_LIMIT.toString(),
        fields: 'key,title,author_name,author_key,first_publish_year,cover_i,isbn,publisher,subject,number_of_pages_median,edition_key',
      });
      
      // Add sort parameter if not default
      if (searchFilters.sort && searchFilters.sort !== 'relevance') {
        params.set('sort', searchFilters.sort);
      }

      const response = await fetch(`${OPEN_LIBRARY_SEARCH_URL}?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to search books');
      }

      const data: OpenLibrarySearchResponse = await response.json();
      const normalizedBooks = data.docs.map(normalizeBook);
      const uniqueBooks = deduplicateBooks(normalizedBooks);
      
      setResults(uniqueBooks);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    searchBooks(debouncedQuery, debouncedFilters);
  }, [debouncedQuery, debouncedFilters, searchBooks]);

  const updateFilter = useCallback(<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const selectBook = useCallback((book: Book) => {
    setSelectedBook(book);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBook(null);
  }, []);

  return {
    query,
    setQuery,
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    results,
    isLoading,
    error,
    hasSearched,
    selectedBook,
    selectBook,
    clearSelection,
  };
}
