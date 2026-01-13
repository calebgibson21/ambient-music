import { useState, useEffect, useCallback } from 'react';
import { Book, OpenLibrarySearchResponse, OpenLibraryBook } from '../types/book';
import { useDebounce } from './useDebounce';

const OPEN_LIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
const OPEN_LIBRARY_COVER_URL = 'https://covers.openlibrary.org/b/id';
const DEBOUNCE_DELAY = 400; // ms
const RESULTS_LIMIT = 20;

/**
 * Builds a cover image URL from an Open Library cover ID
 */
function buildCoverUrl(coverId: number | undefined, size: 'S' | 'M' | 'L' = 'M'): string | undefined {
  if (!coverId) return undefined;
  return `${OPEN_LIBRARY_COVER_URL}/${coverId}-${size}.jpg`;
}

/**
 * Normalizes an Open Library book result to our app's Book type
 */
function normalizeBook(doc: OpenLibraryBook): Book {
  return {
    id: doc.key,
    title: doc.title,
    authors: doc.author_name || [],
    year: doc.first_publish_year,
    coverUrl: buildCoverUrl(doc.cover_i),
    isbn: doc.isbn?.[0],
    publisher: doc.publisher?.[0],
    subjects: doc.subject?.slice(0, 5),
    pageCount: doc.number_of_pages_median,
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

interface UseBookSearchResult {
  query: string;
  setQuery: (query: string) => void;
  results: Book[];
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
  selectedBook: Book | null;
  selectBook: (book: Book) => void;
  clearSelection: () => void;
}

export function useBookSearch(): UseBookSearchResult {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const debouncedQuery = useDebounce(query, DEBOUNCE_DELAY);

  const searchBooks = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: RESULTS_LIMIT.toString(),
        fields: 'key,title,author_name,author_key,first_publish_year,cover_i,isbn,publisher,subject,number_of_pages_median',
      });

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
    searchBooks(debouncedQuery);
  }, [debouncedQuery, searchBooks]);

  const selectBook = useCallback((book: Book) => {
    setSelectedBook(book);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBook(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    hasSearched,
    selectedBook,
    selectBook,
    clearSelection,
  };
}
