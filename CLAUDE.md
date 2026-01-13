# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React Native mobile app built with Expo that provides book search/filtering via the Open Library API, with the goal of matching books to ambient music recommendations.

## Development Commands

```bash
npm start          # Start Expo development server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run in web browser
```

No test or lint scripts are currently configured.

## Architecture

**Stack:** React 19 + React Native 0.81 + Expo 54 + TypeScript (strict mode)

**Structure:**
- `App.tsx` - Root component, renders BookSearch
- `src/components/` - UI components (BookSearch, SearchFilters)
- `src/hooks/` - Data fetching hooks (useBookSearch, useBookDetails, useSubjectBrowse, useDebounce)
- `src/types/book.ts` - All TypeScript types and constants (Book, Author, SearchFilters, Genre, etc.)

**API Integration:** Open Library API (no auth required)
- Search endpoint: `https://openlibrary.org/search.json`
- Works/Authors/Subjects endpoints for enhanced details
- Cover images: `https://covers.openlibrary.org/b/id/{id}-{size}.jpg`

**Key Patterns:**
- Custom hooks for all data fetching with 400ms debouncing
- Raw API responses normalized to app-specific types (OpenLibraryBook → Book)
- Books deduplicated by title + author
- Local state only (useState) - no external state management
- Dark theme with purple accent (#A78BFA)

**Dual UI Modes:** Search mode (text query with filters) and Browse mode (genre-based exploration) are mutually exclusive.
