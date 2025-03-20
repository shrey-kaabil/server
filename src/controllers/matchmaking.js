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
exports.getActiveMatches = exports.submitGuess = exports.setGuessTimeLimit = exports.getMatch = exports.requestMatch = void 0;
const uuid_1 = require("uuid");
const supabase_1 = require("../utils/supabase");
const constants_1 = require("../config/constants");
// In-memory maps to store match data
const activeMatches = new Map();
const matchQueue = [];
const guessTimers = new Map();
/**
 * Request to join a match
 */
const requestMatch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    // Check if user is already in a match
    for (const [matchId, match] of activeMatches.entries()) {
        if (match.participants.includes(userId)) {
            return res.json({
                matchId,
                playerA: match.playerA,
                playerB: match.playerB,
                isPlayerA: match.playerA === userId
            });
        }
    }
    // Add user to match queue
    matchQueue.push({ userId, joinedAt: Date.now() });
    // If more than one user in queue, create a match
    if (matchQueue.length >= 2) {
        const participant1 = matchQueue.shift();
        const participant2 = matchQueue.shift();
        // Randomly decide player A and B
        const isParticipant1PlayerA = Math.random() > 0.5;
        const playerA = isParticipant1PlayerA ? participant1.userId : participant2.userId;
        const playerB = isParticipant1PlayerA ? participant2.userId : participant1.userId;
        // Create a new match
        const matchId = (0, uuid_1.v4)();
        const match = {
            id: matchId,
            participants: [participant1.userId, participant2.userId],
            playerA,
            playerB,
            isAI: false,
            messages: [],
            guesses: {},
            scores: {}
        };
        activeMatches.set(matchId, match);
        // Save match data to Supabase
        try {
            yield supabase_1.supabase.from('matches').insert({
                id: matchId,
                playerA,
                playerB,
                isAI: false,
                created_at: new Date().toISOString()
            });
        }
        catch (error) {
            console.error('Error saving match to Supabase:', error);
        }
        // Return match details to the user
        return res.json({
            matchId,
            playerA: match.playerA,
            playerB: match.playerB,
            isPlayerA: participant1.userId === playerA
        });
    }
    else {
        // If no other human player, match with AI
        const matchId = (0, uuid_1.v4)();
        const playerA = userId;
        const playerB = `ai-${(0, uuid_1.v4)()}`;
        // Create a new match with AI
        const match = {
            id: matchId,
            participants: [playerA, playerB],
            playerA,
            playerB,
            isAI: true,
            messages: [],
            guesses: {},
            scores: {}
        };
        activeMatches.set(matchId, match);
        // Save match data to Supabase
        try {
            yield supabase_1.supabase.from('matches').insert({
                id: matchId,
                playerA,
                playerB,
                isAI: true,
                created_at: new Date().toISOString()
            });
        }
        catch (error) {
            console.error('Error saving match to Supabase:', error);
        }
        // Return match details to the user
        return res.json({
            matchId,
            playerA: match.playerA,
            playerB: match.playerB,
            isPlayerA: true
        });
    }
});
exports.requestMatch = requestMatch;
/**
 * Get match details
 */
const getMatch = (req, res) => {
    const { matchId } = req.params;
    if (!matchId) {
        return res.status(400).json({ error: 'Match ID is required' });
    }
    const match = activeMatches.get(matchId);
    if (!match) {
        return res.status(404).json({ error: 'Match not found' });
    }
    return res.json({
        id: match.id,
        playerA: match.playerA,
        playerB: match.playerB,
        isAI: match.isAI
    });
};
exports.getMatch = getMatch;
/**
 * Set a timer for a user to make a guess
 */
const setGuessTimeLimit = (matchId, userId) => {
    // Clear any existing timer
    const existingTimerId = `${matchId}-${userId}`;
    if (guessTimers.has(existingTimerId)) {
        clearTimeout(guessTimers.get(existingTimerId));
    }
    // Set a new timer
    const timer = setTimeout(() => {
        // Check if match exists
        const match = activeMatches.get(matchId);
        if (!match)
            return;
        // Check if user already made a guess
        if (match.guesses[userId])
            return;
        // Force a default guess of 'human'
        match.guesses[userId] = 'human';
        // Calculate score - should be 0 since it's an automatic guess
        match.scores[userId] = 0;
        // Notify the client that time is up
        console.log(`Time's up for user ${userId} in match ${matchId}`);
        // Remove the timer from the map
        guessTimers.delete(existingTimerId);
    }, constants_1.GUESS_TIME_LIMIT);
    // Store the timer
    guessTimers.set(existingTimerId, timer);
};
exports.setGuessTimeLimit = setGuessTimeLimit;
/**
 * Submit a guess
 */
const submitGuess = (req, res) => {
    const { matchId } = req.params;
    const { userId, guess } = req.body;
    if (!matchId || !userId || !guess) {
        return res.status(400).json({ error: 'Match ID, user ID, and guess are required' });
    }
    if (guess !== 'human' && guess !== 'ai') {
        return res.status(400).json({ error: 'Guess must be "human" or "ai"' });
    }
    const match = activeMatches.get(matchId);
    if (!match) {
        return res.status(404).json({ error: 'Match not found' });
    }
    // Clear any guess timer for this user
    const timerId = `${matchId}-${userId}`;
    if (guessTimers.has(timerId)) {
        clearTimeout(guessTimers.get(timerId));
        guessTimers.delete(timerId);
    }
    // Record the guess
    match.guesses[userId] = guess;
    // Calculate score
    let score = 0;
    const opponentId = match.participants.find(id => id !== userId);
    if (opponentId) {
        // Find messages from opponent to determine score
        const messagesReceived = match.messages.filter(msg => msg.sender === (userId === match.playerA ? 'playerB' : 'playerA')).length;
        // Check if guess is correct
        const isCorrect = (match.isAI && guess === 'ai') || (!match.isAI && guess === 'human');
        // Calculate score based on formula: 4 - messages received, or 0 if incorrect
        score = isCorrect ? Math.max(0, 4 - messagesReceived) : 0;
        // Save score
        match.scores[userId] = score;
        // Save guess to Supabase
        try {
            supabase_1.supabase.from('guesses').insert({
                match_id: matchId,
                user_id: userId,
                guess,
                correct: isCorrect,
                score,
                created_at: new Date().toISOString()
            }).then();
        }
        catch (error) {
            console.error('Error saving guess to Supabase:', error);
        }
    }
    return res.json({ score });
};
exports.submitGuess = submitGuess;
/**
 * Get active matches (for debugging)
 */
const getActiveMatches = (req, res) => {
    const matches = Array.from(activeMatches.values()).map(match => ({
        id: match.id,
        playerA: match.playerA,
        playerB: match.playerB,
        isAI: match.isAI,
        messageCount: match.messages.length,
        guesses: match.guesses,
        scores: match.scores
    }));
    return res.json({ matches });
};
exports.getActiveMatches = getActiveMatches;
