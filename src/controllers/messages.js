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
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketHandlers = void 0;
const uuid_1 = require("uuid");
const profanityFilter_1 = require("../utils/profanityFilter");
const matchmaking_1 = require("./matchmaking");
const constants_1 = require("../config/constants");
const openai_1 = require("../utils/openai");
// Store active socket connections by user ID
const activeConnections = new Map();
// Store socket rooms for matches
const matchRooms = new Map();
const messages = {};
const conversationHistory = {};
/**
 * Initialize socket.io handlers
 */
const initializeSocketHandlers = (io) => {
    io.on('connection', (socket) => {
        console.log(`New socket connection: ${socket.id}`);
        // Join a match room
        socket.on('join-match', ({ userId, matchId }) => {
            // Store user connection
            activeConnections.set(userId, socket);
            // Join socket room for the match
            socket.join(`match:${matchId}`);
            // Add to match rooms tracking
            if (!matchRooms.has(matchId)) {
                matchRooms.set(matchId, []);
            }
            const participants = matchRooms.get(matchId) || [];
            if (!participants.includes(userId)) {
                participants.push(userId);
                matchRooms.set(matchId, participants);
            }
            console.log(`User ${userId} joined match ${matchId}`);
            // Initialize messages array for this match if needed
            if (!messages[matchId]) {
                messages[matchId] = [];
            }
            // Send existing messages to the user
            socket.emit('match-history', { messages: messages[matchId] });
        });
        // Leave a match
        socket.on('leave-match', ({ userId, matchId }) => {
            socket.leave(`match:${matchId}`);
            // Remove from match participants
            const participants = matchRooms.get(matchId) || [];
            const updatedParticipants = participants.filter(id => id !== userId);
            if (updatedParticipants.length === 0) {
                // If no participants left, clean up
                matchRooms.delete(matchId);
                delete messages[matchId];
            }
            else {
                matchRooms.set(matchId, updatedParticipants);
            }
            console.log(`User ${userId} left match ${matchId}`);
        });
        // Send a message
        socket.on('send-message', ({ userId, matchId, text, isPlayerA }) => {
            if (!text || text.trim() === '') {
                return;
            }
            // Enforce 1000 character limit
            if (text.length > 1000) {
                text = text.substring(0, 1000);
            }
            // Filter profanity
            const filteredText = (0, profanityFilter_1.filterProfanity)(text);
            // Create message object
            const message = {
                id: (0, uuid_1.v4)(),
                text: filteredText,
                sender: isPlayerA ? 'playerA' : 'playerB',
                timestamp: new Date()
            };
            // Store message
            if (!messages[matchId]) {
                messages[matchId] = [];
            }
            messages[matchId].push(message);
            // Broadcast to all users in the match
            io.to(`match:${matchId}`).emit('new-message', { message });
            console.log(`Message sent in match ${matchId} by ${userId}`);
            // Check if this is the final message (6th message)
            if (messages[matchId].length === 6) {
                // Set guess time limit for both players
                const participants = matchRooms.get(matchId) || [];
                // For each human participant
                participants.forEach(participantId => {
                    // Determine if this participant is player A
                    const participantIsPlayerA = isPlayerA ? (participantId === userId) : (participantId !== userId);
                    // Set guess time limit
                    (0, matchmaking_1.setGuessTimeLimit)(matchId, participantId);
                });
                // Notify clients that the final message has been sent
                io.to(`match:${matchId}`).emit('final-message', {
                    matchId,
                    timeLimit: 30 // 30 seconds (same as GUESS_TIME_LIMIT in constants but in seconds)
                });
            }
            // If playing against AI, generate and send AI response after a delay
            const participants = matchRooms.get(matchId) || [];
            if (participants.length === 1 && isPlayerA) {
                // This is a human vs AI match
                setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
                    try {
                        // Initialize conversation history for this match if it doesn't exist
                        if (!conversationHistory[matchId]) {
                            conversationHistory[matchId] = [];
                        }
                        // Add user message to history
                        conversationHistory[matchId].push({
                            role: 'user',
                            content: filteredText
                        });
                        // Generate AI response with history context
                        const aiResponseText = yield (0, openai_1.generateChatGPTResponse)(filteredText, matchId, conversationHistory[matchId]);
                        // Create AI message object
                        const aiResponse = {
                            id: (0, uuid_1.v4)(),
                            text: aiResponseText,
                            sender: 'playerB', // AI is always player B
                            timestamp: new Date()
                        };
                        // Add AI response to conversation history
                        conversationHistory[matchId].push({
                            role: 'assistant',
                            content: aiResponseText
                        });
                        // Store AI message
                        messages[matchId].push(aiResponse);
                        // Send to the human player
                        io.to(`match:${matchId}`).emit('new-message', { message: aiResponse });
                        console.log(`AI response sent in match ${matchId}`);
                        // Check if this is the final message (6th message)
                        if (messages[matchId].length === 6) {
                            // Set guess time limit for the human player
                            (0, matchmaking_1.setGuessTimeLimit)(matchId, userId); // Human is always player A in AI matches
                            // Notify client that the final message has been sent
                            io.to(`match:${matchId}`).emit('final-message', {
                                matchId,
                                timeLimit: 30 // 30 seconds
                            });
                        }
                    }
                    catch (error) {
                        console.error('Error generating AI response:', error);
                        // Fallback to simple response if API fails
                        const fallbackResponse = {
                            id: (0, uuid_1.v4)(),
                            text: "That's interesting. Tell me more about your thoughts on this topic.",
                            sender: 'playerB',
                            timestamp: new Date()
                        };
                        messages[matchId].push(fallbackResponse);
                        io.to(`match:${matchId}`).emit('new-message', { message: fallbackResponse });
                    }
                }), constants_1.DEFAULT_AI_DELAY_MIN + Math.random() * (constants_1.DEFAULT_AI_DELAY_MAX - constants_1.DEFAULT_AI_DELAY_MIN)); // Random delay
            }
        });
        // Disconnection
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
            // Find and remove the user from active connections
            let disconnectedUserId;
            activeConnections.forEach((s, userId) => {
                if (s.id === socket.id) {
                    disconnectedUserId = userId;
                }
            });
            if (disconnectedUserId) {
                activeConnections.delete(disconnectedUserId);
            }
        });
    });
};
exports.initializeSocketHandlers = initializeSocketHandlers;
