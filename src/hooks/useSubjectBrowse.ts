import { useState, useCallback } from 'react';
import { Book, OpenLibrarySubjectResponse, OpenLibrarySubjectWork, Genre } from '../types/book';
import { buildCoverUrl } from './useBookSearch';

const OPEN_LIBRARY_SUBJECTS_URL = 'https://openlibrary.org/subjects';
const RESULTS_LIMIT = 20;

/**
 * Normalizes a subject work to our app's Book type
 */
function normalizeSubjectWork(work: OpenLibrarySubjectWork): Book {
  return {
    id: work.key,
    title: work.title,
    authors: work.authors?.map((a) => a.name) || [],
    authorKeys: work.authors?.map((a) => a.key.replace('/authors/', '')),
    year: work.first_publish_year,
    coverUrl: buildCoverUrl(work.cover_id),
    subjects: undefined,
    pageCount: undefined,
  };
}

interface UseSubjectBrowseResult {
  selectedGenre: Genre | null;
  setSelectedGenre: (genre: Genre | null) => void;
  results: Book[];
  isLoading: boolean;
  error: string | null;
  workCount: number;
  browseGenre: (genre: Genre) => Promise<void>;
  clearBrowse: () => void;
}

export function useSubjectBrowse(): UseSubjectBrowseResult {
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [results, setResults] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workCount, setWorkCount] = useState(0);

  const browseGenre = useCallback(async (genre: Genre) => {
    setIsLoading(true);
    setError(null);
    setSelectedGenre(genre);

    try {
      // Convert genre to URL-friendly format (lowercase, replace spaces with underscores)
      const subjectSlug = genre.toLowerCase().replace(/\s+/g, '_');
      
      const params = new URLSearchParams({
        limit: RESULTS_LIMIT.toString(),
      });

      const response = await fetch(
        `${OPEN_LIBRARY_SUBJECTS_URL}/${subjectSlug}.json?${params}`
      );

      if (!response.ok) {
        throw new Error(`Failed to browse ${genre}`);
      }

      const data: OpenLibrarySubjectResponse = await response.json();
      const normalizedBooks = data.works.map(normalizeSubjectWork);

      setResults(normalizedBooks);
      setWorkCount(data.work_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setResults([]);
      setWorkCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearBrowse = useCallback(() => {
    setSelectedGenre(null);
    setResults([]);
    setError(null);
    setWorkCount(0);
  }, []);

  return {
    selectedGenre,
    setSelectedGenre,
    results,
    isLoading,
    error,
    workCount,
    browseGenre,
    clearBrowse,
  };
}
