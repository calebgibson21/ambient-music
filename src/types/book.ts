// Open Library API response types

export interface OpenLibrarySearchResponse {
  numFound: number;
  start: number;
  docs: OpenLibraryBook[];
}

export interface OpenLibraryBook {
  key: string; // e.g., "/works/OL45883W"
  title: string;
  author_name?: string[];
  author_key?: string[];
  first_publish_year?: number;
  cover_i?: number; // Cover ID for building image URL
  cover_edition_key?: string;
  edition_key?: string[];
  isbn?: string[];
  publisher?: string[];
  language?: string[];
  subject?: string[];
  number_of_pages_median?: number;
}

// Normalized book type for app use
export interface Book {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  coverUrl?: string;
  isbn?: string;
  publisher?: string;
  subjects?: string[];
  pageCount?: number;
}

// Detailed book info from works endpoint
export interface OpenLibraryWorkDetails {
  key: string;
  title: string;
  description?: string | { value: string };
  subjects?: string[];
  subject_places?: string[];
  subject_times?: string[];
  covers?: number[];
}

export interface BookSearchState {
  query: string;
  results: Book[];
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
}
