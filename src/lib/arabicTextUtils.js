/**
 * Arabic Text Normalization & Fuzzy Matching Utilities
 * Provides intelligent text processing for Arabic input with dialect normalization
 */

/**
 * Comprehensive Arabic text normalization
 * Standardizes various Arabic character forms for consistent comparison
 */
export const normalizeArabic = (text) => {
  if (!text) return '';
  return text.toString()
    .removeDiacritics()
    .normalizeAlif()
    .normalizeTaMarbuta()
    .normalizeAlifMaqsura()
    .normalizeLamAlif()
    .collapseWhitespace()
    .trim();
};

/**
 * Fuzzy matching - calculates similarity between two strings
 * Uses Levenshtein distance for Arabic text
 */
export const fuzzyMatch = (str1, str2, threshold = 0.7) => {
  if (!str1 || !str2) return { match: false, similarity: 0 };
  
  const norm1 = normalizeArabic(str1);
  const norm2 = normalizeArabic(str2);
  
  if (norm1 === norm2) return { match: true, similarity: 1 };
  
  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  const similarity = 1 - (distance / maxLength);
  
  return {
    match: similarity >= threshold,
    similarity
  };
};

/**
 * Find similar items using fuzzy matching
 * Returns items that closely match the search query
 */
export const findSimilarItems = (query, items, fieldName = 'name', threshold = 0.6) => {
  if (!query || !items?.length) return [];
  
  return items
    .map(item => {
      const value = item[fieldName] || '';
      const { similarity } = fuzzyMatch(query, value, threshold);
      return { ...item, similarity, matchValue: value };
    })
    .filter(item => item.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
};

/**
 * Check for near-duplicates with fuzzy matching
 * Warns user if similar items already exist
 */
export const checkNearDuplicates = (name, company, existingItems, threshold = 0.8) => {
  if (!name || !existingItems?.length) return null;
  
  const normCompany = normalizeArabic(company || 'بدون شركة');
  const normName = normalizeArabic(name);
  
  for (const item of existingItems) {
    const normDbCompany = normalizeArabic(item.company || 'بدون شركة');
    const normDbName = normalizeArabic(item.name);
    
    // Exact match after normalization
    if (normDbName === normName && normDbCompany === normCompany) {
      return { type: 'exact', item };
    }
    
    // Fuzzy match on name with same company
    if (normDbCompany === normCompany) {
      const { match, similarity } = fuzzyMatch(name, item.name, threshold);
      if (match) {
        return { type: 'fuzzy', item, similarity };
      }
    }
  }
  
  return null;
};

// Helper: Levenshtein distance for Arabic text
const levenshteinDistance = (str1, str2) => {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,     // deletion
        matrix[j - 1][i] + 1,     // insertion
        matrix[j - 1][i - 1] + indicator  // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
};

// Add methods to String prototype for convenience
if (!String.prototype.removeDiacritics) {
  String.prototype.removeDiacritics = function() {
    return this.replace(/[\u064B-\u065F]/g, '');
  };
}

if (!String.prototype.normalizeAlif) {
  String.prototype.normalizeAlif = function() {
    return this.replace(/[أإآٱ]/g, 'ا');
  };
}

if (!String.prototype.normalizeTaMarbuta) {
  String.prototype.normalizeTaMarbuta = function() {
    return this.replace(/ة/g, 'ه');
  };
}

if (!String.prototype.normalizeAlifMaqsura) {
  String.prototype.normalizeAlifMaqsura = function() {
    return this.replace(/[ىئ]/g, 'ي');
  };
}

if (!String.prototype.normalizeLamAlif) {
  String.prototype.normalizeLamAlif = function() {
    return this.replace(/لا/g, 'لا');
  };
}

if (!String.prototype.collapseWhitespace) {
  String.prototype.collapseWhitespace = function() {
    return this.replace(/\s+/g, ' ');
  };
}
