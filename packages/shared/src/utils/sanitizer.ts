/**
 * Input Sanitizer
 * 
 * Sanitizes user inputs for security
 */

import { config } from '../config/index.js';

/**
 * Sanitize string input
 */
export function sanitizeInput(input: string): string {
  if (!config.get('security').sanitizeInputs) {
    return input;
  }

  const maxLength = config.get('security').maxInputLength;
  
  // Remove potentially dangerous characters
  let sanitized = input
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, maxLength); // Enforce max length

  return sanitized;
}

/**
 * Sanitize query for SQL FTS5
 * 
 * Converts space-separated terms to OR logic for better recall.
 * Example: "cn() tailwind merge" -> "cn OR tailwind OR merge"
 */
export function sanitizeFTS5Query(query: string): string {
  // Escape FTS5 special characters and split into terms
  const sanitized = query
    .replace(/["]/g, '""') // Escape quotes
    .replace(/[()]/g, '') // Remove parentheses
    .trim();
  
  // Split by whitespace and filter empty terms
  const terms = sanitized.split(/\s+/).filter(t => t.length > 0);
  
  // If only one term, return as-is
  if (terms.length === 1) {
    return terms[0];
  }
  
  // Multiple terms: join with OR for better recall
  return terms.join(' OR ');
}

/**
 * Validate email format (basic)
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate user ID format
 */
export function isValidUserId(userId: string): boolean {
  // Alphanumeric, underscore, hyphen only
  const userIdRegex = /^[a-zA-Z0-9_-]+$/;
  return userIdRegex.test(userId) && userId.length <= 64;
}

/**
 * Sanitize file path (prevent directory traversal)
 */
export function sanitizeFilePath(filePath: string): string {
  // Remove ../ and ..\
  return filePath
    .replace(/\.\.\//g, '')
    .replace(/\.\.\\/g, '')
    .replace(/^\/+/, ''); // Remove leading slashes
}

/**
 * Validate JSON string
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}
