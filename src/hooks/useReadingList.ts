import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Book, ReadingListItem, ReadingStatus } from '../types/book';

const STORAGE_KEY = '@ambient_music_reading_list';

interface UseReadingListResult {
  items: ReadingListItem[];
  isLoading: boolean;
  addBook: (book: Book, status: ReadingStatus) => Promise<void>;
  removeBook: (bookId: string) => Promise<void>;
  updateStatus: (bookId: string, status: ReadingStatus) => Promise<void>;
  isInList: (bookId: string) => boolean;
  getItemByBookId: (bookId: string) => ReadingListItem | undefined;
  getBooksByStatus: (status: ReadingStatus) => ReadingListItem[];
}

export function useReadingList(): UseReadingListResult {
  const [items, setItems] = useState<ReadingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load reading list from AsyncStorage on mount
  useEffect(() => {
    loadReadingList();
  }, []);

  const loadReadingList = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ReadingListItem[];
        setItems(parsed);
      }
    } catch (error) {
      console.error('Failed to load reading list:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveReadingList = async (newItems: ReadingListItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
      setItems(newItems);
    } catch (error) {
      console.error('Failed to save reading list:', error);
      throw error;
    }
  };

  const addBook = useCallback(async (book: Book, status: ReadingStatus) => {
    const existingIndex = items.findIndex(item => item.book.id === book.id);
    
    if (existingIndex >= 0) {
      // Book already exists, update its status
      const updated = [...items];
      updated[existingIndex] = {
        ...updated[existingIndex],
        status,
        dateUpdated: new Date().toISOString(),
      };
      await saveReadingList(updated);
    } else {
      // Add new book
      const newItem: ReadingListItem = {
        book,
        status,
        dateAdded: new Date().toISOString(),
      };
      await saveReadingList([newItem, ...items]);
    }
  }, [items]);

  const removeBook = useCallback(async (bookId: string) => {
    const filtered = items.filter(item => item.book.id !== bookId);
    await saveReadingList(filtered);
  }, [items]);

  const updateStatus = useCallback(async (bookId: string, status: ReadingStatus) => {
    const updated = items.map(item => {
      if (item.book.id === bookId) {
        return {
          ...item,
          status,
          dateUpdated: new Date().toISOString(),
        };
      }
      return item;
    });
    await saveReadingList(updated);
  }, [items]);

  const isInList = useCallback((bookId: string): boolean => {
    return items.some(item => item.book.id === bookId);
  }, [items]);

  const getItemByBookId = useCallback((bookId: string): ReadingListItem | undefined => {
    return items.find(item => item.book.id === bookId);
  }, [items]);

  const getBooksByStatus = useCallback((status: ReadingStatus): ReadingListItem[] => {
    return items.filter(item => item.status === status);
  }, [items]);

  return {
    items,
    isLoading,
    addBook,
    removeBook,
    updateStatus,
    isInList,
    getItemByBookId,
    getBooksByStatus,
  };
}
