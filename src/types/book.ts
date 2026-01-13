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
  authorKeys?: string[];
  year?: number;
  coverUrl?: string;
  isbn?: string;
  publisher?: string;
  subjects?: string[];
  pageCount?: number;
  editionCount?: number;
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

// Author details from authors endpoint
export interface OpenLibraryAuthorDetails {
  key: string;
  name: string;
  personal_name?: string;
  bio?: string | { value: string };
  birth_date?: string;
  death_date?: string;
  photos?: number[];
  links?: { title: string; url: string }[];
}

// Normalized author type for app use
export interface Author {
  id: string;
  name: string;
  bio?: string;
  birthDate?: string;
  deathDate?: string;
  photoUrl?: string;
}

// Enhanced book details (combined work + author info)
export interface BookDetails {
  book: Book;
  description?: string;
  fullSubjects?: string[];
  author?: Author;
}

// Subject browse response from /subjects/{subject}.json
export interface OpenLibrarySubjectResponse {
  name: string;
  subject_type: string;
  work_count: number;
  works: OpenLibrarySubjectWork[];
}

export interface OpenLibrarySubjectWork {
  key: string;
  title: string;
  authors?: { key: string; name: string }[];
  cover_id?: number;
  first_publish_year?: number;
  edition_count?: number;
}

// Search filters
export type SortOption = 'relevance' | 'new' | 'old' | 'editions' | 'rating';

export interface SearchFilters {
  subject?: string;
  language?: string;
  yearMin?: number;
  yearMax?: number;
  sort?: SortOption;
}

// Language options
export interface LanguageOption {
  code: string;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: '', label: 'All Languages' },
  { code: 'eng', label: 'English' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fre', label: 'French' },
  { code: 'ger', label: 'German' },
  { code: 'ita', label: 'Italian' },
  { code: 'por', label: 'Portuguese' },
  { code: 'rus', label: 'Russian' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'chi', label: 'Chinese' },
];

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'new', label: 'Newest First' },
  { value: 'old', label: 'Oldest First' },
  { value: 'editions', label: 'Most Editions' },
  { value: 'rating', label: 'Highest Rated' },
];

// Popular genres for browsing
export const POPULAR_GENRES = [
  'Fiction',
  'Mystery',
  'Science Fiction',
  'Fantasy',
  'Romance',
  'Horror',
  'History',
  'Biography',
  'Philosophy',
  'Poetry',
  'Adventure',
  'Classics',
] as const;

export type Genre = typeof POPULAR_GENRES[number];

export interface BookSearchState {
  query: string;
  results: Book[];
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
}
