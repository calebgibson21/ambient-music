import { useState, useEffect, useCallback } from 'react';
import {
  Book,
  BookDetails,
  Author,
  OpenLibraryWorkDetails,
  OpenLibraryAuthorDetails,
} from '../types/book';
import { buildAuthorPhotoUrl } from './useBookSearch';

const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';

/**
 * Extracts text from Open Library's description field
 * which can be either a string or an object with a value property
 */
function extractDescription(desc: string | { value: string } | undefined): string | undefined {
  if (!desc) return undefined;
  if (typeof desc === 'string') return desc;
  return desc.value;
}

/**
 * Normalizes author data from Open Library
 */
function normalizeAuthor(data: OpenLibraryAuthorDetails): Author {
  return {
    id: data.key,
    name: data.name || data.personal_name || 'Unknown',
    bio: extractDescription(data.bio),
    birthDate: data.birth_date,
    deathDate: data.death_date,
    photoUrl: buildAuthorPhotoUrl(data.photos?.[0]),
  };
}

interface UseBookDetailsResult {
  details: BookDetails | null;
  isLoading: boolean;
  error: string | null;
  fetchDetails: (book: Book) => Promise<void>;
  clearDetails: () => void;
}

export function useBookDetails(): UseBookDetailsResult {
  const [details, setDetails] = useState<BookDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async (book: Book) => {
    setIsLoading(true);
    setError(null);

    try {
      // Start with basic book info
      const bookDetails: BookDetails = {
        book,
        description: undefined,
        fullSubjects: book.subjects,
        author: undefined,
      };

      // Fetch work details (description, full subjects)
      const workId = book.id.replace('/works/', '');
      try {
        const workResponse = await fetch(`${OPEN_LIBRARY_BASE_URL}/works/${workId}.json`);
        if (workResponse.ok) {
          const workData: OpenLibraryWorkDetails = await workResponse.json();
          bookDetails.description = extractDescription(workData.description);
          if (workData.subjects && workData.subjects.length > 0) {
            bookDetails.fullSubjects = workData.subjects;
          }
        }
      } catch {
        // Work details are optional, continue without them
        console.warn('Failed to fetch work details');
      }

      // Fetch first author details if available
      if (book.authorKeys && book.authorKeys.length > 0) {
        const authorKey = book.authorKeys[0];
        try {
          const authorResponse = await fetch(`${OPEN_LIBRARY_BASE_URL}/authors/${authorKey}.json`);
          if (authorResponse.ok) {
            const authorData: OpenLibraryAuthorDetails = await authorResponse.json();
            bookDetails.author = normalizeAuthor(authorData);
          }
        } catch {
          // Author details are optional, continue without them
          console.warn('Failed to fetch author details');
        }
      }

      setDetails(bookDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch book details');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearDetails = useCallback(() => {
    setDetails(null);
    setError(null);
  }, []);

  return {
    details,
    isLoading,
    error,
    fetchDetails,
    clearDetails,
  };
}

/**
 * Hook that automatically fetches details when a book is provided
 */
export function useBookDetailsAuto(book: Book | null): {
  details: BookDetails | null;
  isLoading: boolean;
  error: string | null;
} {
  const { details, isLoading, error, fetchDetails, clearDetails } = useBookDetails();

  useEffect(() => {
    if (book) {
      fetchDetails(book);
    } else {
      clearDetails();
    }
  }, [book?.id]); // Only refetch when book ID changes

  return { details, isLoading, error };
}
