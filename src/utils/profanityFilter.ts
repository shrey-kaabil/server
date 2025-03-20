/**
 * A simple profanity filter utility
 * In a production app, consider using a more robust library
 */

// Basic list of profane words to filter out
const profanityList: string[] = [
  'badword1',
  'badword2',
  'badword3',
  // Add more words as needed
];

/**
 * Check if a text contains profanity
 * @param text Text to check
 * @returns True if profanity is found
 */
export const containsProfanity = (text: string): boolean => {
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  
  return profanityList.some(word => lowerText.includes(word));
};

/**
 * Filter profanity from text by replacing with asterisks
 * @param text Text to filter
 * @returns Filtered text
 */
export const filterProfanity = (text: string): string => {
  if (!text) return text;
  
  let filteredText = text;
  
  profanityList.forEach(word => {
    // Create a regex that matches the word with word boundaries
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    
    // Replace with asterisks of the same length
    filteredText = filteredText.replace(regex, '*'.repeat(word.length));
  });
  
  return filteredText;
};

export default {
  containsProfanity,
  filterProfanity
}; 