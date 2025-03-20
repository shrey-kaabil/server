"use strict";
/**
 * Application constants
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AI_DELAY_MAX = exports.DEFAULT_AI_DELAY_MIN = exports.MAX_QUEUE_TIME = exports.GUESS_TIME_LIMIT = exports.MAX_MESSAGE_LENGTH = void 0;
// Message limits
exports.MAX_MESSAGE_LENGTH = 1000;
// Time limits (in milliseconds)
exports.GUESS_TIME_LIMIT = 30 * 1000; // 30 seconds to guess after receiving final message
// Matchmaking
exports.MAX_QUEUE_TIME = 60 * 1000; // 60 seconds max queue time before matching with AI
// Default values
exports.DEFAULT_AI_DELAY_MIN = 1000; // Minimum AI response delay
exports.DEFAULT_AI_DELAY_MAX = 3000; // Maximum AI response delay
exports.default = {
    MAX_MESSAGE_LENGTH: exports.MAX_MESSAGE_LENGTH,
    GUESS_TIME_LIMIT: exports.GUESS_TIME_LIMIT,
    MAX_QUEUE_TIME: exports.MAX_QUEUE_TIME,
    DEFAULT_AI_DELAY_MIN: exports.DEFAULT_AI_DELAY_MIN,
    DEFAULT_AI_DELAY_MAX: exports.DEFAULT_AI_DELAY_MAX
};
