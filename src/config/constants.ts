/**
 * Application constants
 */

// Message limits
export const MAX_MESSAGE_LENGTH = 1000;

// Time limits (in milliseconds)
export const GUESS_TIME_LIMIT = 30 * 1000; // 30 seconds to guess after receiving final message

// Matchmaking
export const MAX_QUEUE_TIME = 60 * 1000; // 60 seconds max queue time before matching with AI

// Default values
export const DEFAULT_AI_DELAY_MIN = 1000; // Minimum AI response delay
export const DEFAULT_AI_DELAY_MAX = 3000; // Maximum AI response delay

export default {
  MAX_MESSAGE_LENGTH,
  GUESS_TIME_LIMIT,
  MAX_QUEUE_TIME,
  DEFAULT_AI_DELAY_MIN,
  DEFAULT_AI_DELAY_MAX
}; 