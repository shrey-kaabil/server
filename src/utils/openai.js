"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChatGPTResponse = void 0;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Initialize OpenAI client
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY
});
/**
 * Generate a response using ChatGPT for the AI player
 * @param userMessage The message from the human player
 * @param matchId Unique match identifier for maintaining context
 * @param messageHistory Array of previous messages in the conversation
 * @returns The AI-generated response
 */
const generateChatGPTResponse = (userMessage_1, matchId_1, ...args_1) => __awaiter(void 0, [userMessage_1, matchId_1, ...args_1], void 0, function* (userMessage, matchId, messageHistory = []) {
    try {
        // Build the conversation history
        const messages = [
            {
                role: 'system',
                content: 'You are a player in a game called "AI or Not". Your goal is to convince the human player that you might be another human. Respond naturally to their messages. Keep responses conversational, concise (under 150 words), and avoid obvious AI patterns like being overly helpful or formal. Occasionally include typos, use slang, or express strong opinions when appropriate. Respond directly to what the user says rather than attempting to be overly polite. Do not mention being an AI or language model.'
            },
            ...messageHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            { role: 'user', content: userMessage }
        ];
        // Call the OpenAI API
        const response = yield openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 200,
            temperature: 0.7,
        });
        // Extract and return the generated response
        return response.choices[0].message.content || 'Sorry, I\'m not sure how to respond to that.';
    }
    catch (error) {
        console.error('Error generating AI response:', error);
        // Fallback to basic responses if API fails
        const fallbackResponses = [
            "That's an interesting point! What makes you think that?",
            "I'm not entirely convinced. Can you explain why you believe that?",
            "Hmm, I see where you're coming from, but I have a different perspective.",
            "I've been wondering about that too. What do you think about it?",
            "Not sure I agree, but I'm open to hearing more.",
            "Interesting! I never thought about it that way before."
        ];
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
});
exports.generateChatGPTResponse = generateChatGPTResponse;
