import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchFilters as SearchFiltersType, LANGUAGE_OPTIONS, SORT_OPTIONS, SortOption } from '../types/book';

interface SearchFiltersProps {
  filters: SearchFiltersType;
  onUpdateFilter: <K extends keyof SearchFiltersType>(key: K, value: SearchFiltersType[K]) => void;
  onClearFilters: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function SearchFilters({
  filters,
  onUpdateFilter,
  onClearFilters,
  isExpanded,
  onToggleExpand,
}: SearchFiltersProps) {
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const hasActiveFilters = !!(
    filters.subject ||
    filters.language ||
    filters.yearMin ||
    filters.yearMax ||
    (filters.sort && filters.sort !== 'relevance')
  );

  const selectedLanguageLabel = LANGUAGE_OPTIONS.find(l => l.code === filters.language)?.label || 'All Languages';
  const selectedSortLabel = SORT_OPTIONS.find(s => s.value === filters.sort)?.label || 'Relevance';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={onToggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.toggleButtonContent}>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="#A1A1AA"
          />
          <Text style={styles.toggleButtonText}>
            {isExpanded ? 'Hide Filters' : 'Show Filters'}
          </Text>
        </View>
        {hasActiveFilters && !isExpanded && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        )}
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.filtersContent}>
          {/* Subject Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Subject / Genre</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., fantasy, history..."
              placeholderTextColor="#52525B"
              value={filters.subject || ''}
              onChangeText={(text) => onUpdateFilter('subject', text || undefined)}
            />
          </View>

          {/* Language Filter */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Language</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setLanguageModalVisible(true)}
            >
              <Text style={styles.selectButtonText}>{selectedLanguageLabel}</Text>
              <Text style={styles.selectArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Year Range */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Year Range</Text>
            <View style={styles.yearInputs}>
              <TextInput
                style={[styles.textInput, styles.yearInput]}
                placeholder="From"
                placeholderTextColor="#52525B"
                keyboardType="numeric"
                maxLength={4}
                value={filters.yearMin?.toString() || ''}
                onChangeText={(text) => {
                  const num = parseInt(text, 10);
                  onUpdateFilter('yearMin', isNaN(num) ? undefined : num);
                }}
              />
              <Text style={styles.yearDash}>–</Text>
              <TextInput
                style={[styles.textInput, styles.yearInput]}
                placeholder="To"
                placeholderTextColor="#52525B"
                keyboardType="numeric"
                maxLength={4}
                value={filters.yearMax?.toString() || ''}
                onChangeText={(text) => {
                  const num = parseInt(text, 10);
                  onUpdateFilter('yearMax', isNaN(num) ? undefined : num);
                }}
              />
            </View>
          </View>

          {/* Sort Order */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Sort By</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setSortModalVisible(true)}
            >
              <Text style={styles.selectButtonText}>{selectedSortLabel}</Text>
              <Text style={styles.selectArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={onClearFilters}
            >
              <Text style={styles.clearButtonText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Language Modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setLanguageModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Language</Text>
            <ScrollView style={styles.modalScroll}>
              {LANGUAGE_OPTIONS.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.modalOption,
                    filters.language === lang.code && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    onUpdateFilter('language', lang.code || undefined);
                    setLanguageModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      filters.language === lang.code && styles.modalOptionTextSelected,
                    ]}
                  >
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Sort Modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSortModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort By</Text>
            <ScrollView style={styles.modalScroll}>
              {SORT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.modalOption,
                    filters.sort === option.value && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    onUpdateFilter('sort', option.value as SortOption);
                    setSortModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      filters.sort === option.value && styles.modalOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  toggleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleButtonText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  activeBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    borderRadius: 10,
  },
  activeBadgeText: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '600',
  },
  filtersContent: {
    backgroundColor: '#18181F',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#0F0F14',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  selectButton: {
    backgroundColor: '#0F0F14',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  selectButtonText: {
    color: '#FAFAFA',
    fontSize: 15,
  },
  selectArrow: {
    color: '#71717A',
    fontSize: 18,
    fontWeight: '300',
  },
  yearInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yearInput: {
    flex: 1,
    textAlign: 'center',
  },
  yearDash: {
    color: '#52525B',
    fontSize: 18,
    marginHorizontal: 12,
  },
  clearButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  clearButtonText: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1A1A24',
    borderRadius: 20,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  modalTitle: {
    color: '#FAFAFA',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalScroll: {
    maxHeight: 300,
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
  },
  modalOptionSelected: {
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
  },
  modalOptionText: {
    color: '#A1A1AA',
    fontSize: 16,
  },
  modalOptionTextSelected: {
    color: '#A78BFA',
    fontWeight: '600',
  },
});
