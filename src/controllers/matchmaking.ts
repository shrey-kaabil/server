import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../utils/supabase';
import { GUESS_TIME_LIMIT } from '../config/constants';
import { getMessagesForMatch } from './messages';

// Store active matches in memory for quick access
interface Match {
  id: string;
  participants: string[];
  playerA: string;
  playerB: string;
  isAI: boolean;
  messages: any[];
  guesses: Record<string, 'human' | 'ai'>;
  scores: Record<string, number>;
}

interface MatchQueue {
  userId: string;
  joinedAt: number;
}

// In-memory maps to store match data
const activeMatches = new Map<string, Match>();
const matchQueue: MatchQueue[] = [];
const guessTimers = new Map<string, NodeJS.Timeout>();

/**
 * Request to join a match
 */
export const requestMatch = async (req: Request, res: Response) => {
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
    const participant1 = matchQueue.shift()!;
    const participant2 = matchQueue.shift()!;
    
    // Randomly decide player A and B
    const isParticipant1PlayerA = Math.random() > 0.5;
    const playerA = isParticipant1PlayerA ? participant1.userId : participant2.userId;
    const playerB = isParticipant1PlayerA ? participant2.userId : participant1.userId;
    
    // Create a new match
    const matchId = uuidv4();
    const match: Match = {
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
      await supabase.from('matches').insert({
        id: matchId,
        playerA,
        playerB,
        isAI: false,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving match to Supabase:', error);
    }
    
    // Return match details to the user
    return res.json({ 
      matchId, 
      playerA: match.playerA, 
      playerB: match.playerB,
      isPlayerA: participant1.userId === playerA,
      type: 'human-human'
    });
  } else {
    // If no other human player, match with AI
    const matchId = uuidv4();
    const playerA = userId;
    const playerB = `ai-${uuidv4()}`;
    
    // Create a new match with AI
    const match: Match = {
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
      await supabase.from('matches').insert({
        id: matchId,
        playerA,
        playerB,
        isAI: true,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving match to Supabase:', error);
    }
    
    // Return match details to the user
    return res.json({ 
      matchId, 
      playerA: match.playerA, 
      playerB: match.playerB,
      isPlayerA: true,
      type: 'human-ai'
    });
  }
};

/**
 * Get match details
 */
export const getMatch = async (req: Request, res: Response) => {
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

/**
 * Set a timer for a user to make a guess
 */
export const setGuessTimeLimit = (matchId: string, userId: string) => {
  // Clear any existing timer
  const existingTimerId = `${matchId}-${userId}`;
  
  if (guessTimers.has(existingTimerId)) {
    clearTimeout(guessTimers.get(existingTimerId)!);
  }
  
  // Set a new timer
  const timer = setTimeout(() => {
    // Check if match exists
    const match = activeMatches.get(matchId);
    if (!match) return;
    
    // Check if user already made a guess
    if (match.guesses[userId]) return;
    
    // Force a default guess of 'human'
    match.guesses[userId] = 'human';
    
    // Calculate score - should be 0 since it's an automatic guess
    match.scores[userId] = 0;
    
    // Notify the client that time is up
    console.log(`Time's up for user ${userId} in match ${matchId}`);
    
    // Remove the timer from the map
    guessTimers.delete(existingTimerId);
    
  }, GUESS_TIME_LIMIT);
  
  // Store the timer
  guessTimers.set(existingTimerId, timer);
};

/**
 * Submit a guess about opponent
 */
export const submitGuess = async (req: Request, res: Response) => {
  const { matchId } = req.params;
  const { userId, guess } = req.body;
  
  console.log('\n======== SUBMIT GUESS ENDPOINT START ========');
  console.log('Request timestamp:', new Date().toISOString());
  console.log('Request params:', { matchId });
  console.log('Request body:', { userId, guess });
  
  if (!matchId || !userId || !guess) {
    console.log('Error: Missing required fields');
    return res.status(400).json({ error: 'Match ID, user ID, and guess are required' });
  }
  
  if (guess !== 'human' && guess !== 'ai') {
    console.log('Error: Invalid guess value');
    return res.status(400).json({ error: 'Guess must be "human" or "ai"' });
  }
  
  const match = activeMatches.get(matchId);
  
  if (!match) {
    console.log('Error: Match not found');
    return res.status(404).json({ error: 'Match not found' });
  }
  
  console.log('Match found:', {
    id: match.id,
    participants: match.participants,
    playerA: match.playerA,
    playerB: match.playerB,
    isAI: match.isAI
  });
  
  // Clear any guess timer for this user
  const timerId = `${matchId}-${userId}`;
  if (guessTimers.has(timerId)) {
    clearTimeout(guessTimers.get(timerId)!);
    guessTimers.delete(timerId);
    console.log(`Cleared guess timer for ${userId}`);
  }
  
  // Record the guess
  match.guesses[userId] = guess;
  console.log(`Recorded guess for ${userId}: ${guess}`);
  
  // Calculate score
  let score = 0;
  let opponentType = 'human'; // Set a default value
  
  const opponentId = match.participants.find(id => id !== userId);
  console.log('Opponent ID:', opponentId);
  
  if (opponentId) {
    // Auto-detect AI player based on ID pattern
    const hasAIPlayer = match.participants.some(id => id.startsWith('ai-')) || 
                      match.playerB.startsWith('ai-');
    if (hasAIPlayer && !match.isAI) {
      match.isAI = true;
      console.log(`Auto-fixed match ${matchId} - set isAI to true (has AI player ID)`);
    }
  
    // Get messages from the messages object, not from match.messages
    const messagesForMatch = getMessagesForMatch(matchId) || [];
    console.log('Total messages for match:', messagesForMatch.length);
    console.log('Full messages data:', messagesForMatch);
    
    // Find messages from opponent to determine score
    const messagesReceived = messagesForMatch.filter((msg: any) => 
      msg.sender === (userId === match.playerA ? 'playerB' : 'playerA')
    ).length;
    
    console.log('***************************************************');
    console.log('*                                                 *');
    console.log('*               SCORE DEBUG LOG                   *');
    console.log('*                                                 *');
    console.log('***************************************************');
    console.log(`* MATCH ID: ${matchId}`);
    console.log(`* USER ID: ${userId}`);
    console.log(`* GUESS: ${guess}`);
    console.log(`* MESSAGES RECEIVED: ${messagesReceived}`);
    console.log(`* OPPONENT TYPE: ${match.isAI ? 'ai' : 'human'}`);
    
    // Determine the actual opponent type
    opponentType = match.isAI ? 'ai' : 'human';
    
    // Check if guess is correct - simplified logic to directly compare
    const isCorrect = guess === opponentType;
    console.log(`* IS CORRECT GUESS: ${isCorrect}`);
    
    // Fixed score calculation - important part!
    // We MUST ensure messagesReceived is at least 1 to prevent giving 4 stars
    const safeMessagesCount = Math.max(1, Math.min(messagesReceived, 3));
    const calculatedScore = 4 - safeMessagesCount;
    score = isCorrect ? calculatedScore : 0;
    
    console.log(`* CALCULATION: 4 - ${safeMessagesCount} = ${calculatedScore}`);
    console.log(`* FINAL SCORE: ${score}`);
    console.log('***************************************************');
    
    // Save score
    match.scores[userId] = score;
    
    // Save guess to Supabase
    try {
      supabase.from('guesses').insert({
        match_id: matchId,
        user_id: userId,
        guess,
        correct: isCorrect,
        score,
        created_at: new Date().toISOString()
      }).then();
    } catch (error) {
      console.error('Error saving guess to Supabase:', error);
    }
  } else {
    console.log('No opponent found, defaulting to human opponent');
  }
  
  // Return score and opponent type regardless of whether an opponent was found
  // This ensures we always have an opponentType in the response
  const finalIsCorrect = guess === opponentType;
  
  const response = { 
    score,
    opponentType,
    isCorrect: finalIsCorrect
  };
  
  console.log('***************************************************');
  console.log('*                                                 *');
  console.log('*              RESPONSE BEING SENT                *');
  console.log('*                                                 *');
  console.log('***************************************************');
  console.log(`* SCORE: ${score}`);
  console.log(`* OPPONENT TYPE: ${opponentType}`);
  console.log(`* IS CORRECT: ${finalIsCorrect}`); 
  console.log(`* FULL RESPONSE: ${JSON.stringify(response)}`);
  console.log('***************************************************');
  
  return res.json(response);
};

/**
 * Get active matches (for debugging)
 */
export const getActiveMatches = (req: Request, res: Response) => {
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

/**
 * Debug function to fix matches with AI
 */
export const fixAIMatches = (req: Request, res: Response) => {
  let fixedCount = 0;
  
  // Look through all active matches
  activeMatches.forEach((match, matchId) => {
    // Check if any player ID starts with "ai-" but isAI is false
    const hasAIPlayer = match.participants.some(id => id.startsWith('ai-')) || 
                      match.playerB.startsWith('ai-');
                      
    if (hasAIPlayer && !match.isAI) {
      // Fix the match
      match.isAI = true;
      fixedCount++;
      console.log(`Fixed match ${matchId} - set isAI to true`);
    }
  });
  
  return res.json({ 
    message: `Fixed ${fixedCount} matches`,
    matches: Array.from(activeMatches.values()).map(m => ({
      id: m.id,
      isAI: m.isAI,
      playerA: m.playerA,
      playerB: m.playerB
    }))
  });
}; 