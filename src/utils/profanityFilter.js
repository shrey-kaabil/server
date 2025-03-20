"use strict";
/**
 * A simple profanity filter utility
 * In a production app, consider using a more robust library
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterProfanity = exports.containsProfanity = void 0;
// Basic list of profane words to filter out
const profanityList = [
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
const containsProfanity = (text) => {
    if (!text)
        return false;
    const lowerText = text.toLowerCase();
    return profanityList.some(word => lowerText.includes(word));
};
exports.containsProfanity = containsProfanity;
/**
 * Filter profanity from text by replacing with asterisks
 * @param text Text to filter
 * @returns Filtered text
 */
const filterProfanity = (text) => {
    if (!text)
        return text;
    let filteredText = text;
    profanityList.forEach(word => {
        // Create a regex that matches the word with word boundaries
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        // Replace with asterisks of the same length
        filteredText = filteredText.replace(regex, '*'.repeat(word.length));
    });
    return filteredText;
};
exports.filterProfanity = filterProfanity;
exports.default = {
    containsProfanity: exports.containsProfanity,
    filterProfanity: exports.filterProfanity
};
