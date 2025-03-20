import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { filterProfanity } from '../utils/profanityFilter';
import { setGuessTimeLimit } from './matchmaking';
import { DEFAULT_AI_DELAY_MIN, DEFAULT_AI_DELAY_MAX } from '../config/constants';
import { generateChatGPTResponse } from '../utils/openai';

// Store active socket connections by user ID
const activeConnections = new Map<string, Socket>();

// Store socket rooms for matches
const matchRooms = new Map<string, string[]>();

// Interface for a message
interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Date;
}

// Store messages by match ID
interface MatchMessages {
  [matchId: string]: Message[];
}

const messages: MatchMessages = {};

// Export a function to get messages for a specific match
export const getMessagesForMatch = (matchId: string): Message[] => {
  return messages[matchId] || [];
};

// Store conversation history for AI matches
interface ConversationHistory {
  [matchId: string]: { role: 'user' | 'assistant'; content: string }[];
}

const conversationHistory: ConversationHistory = {};

/**
 * Initialize socket.io handlers
 */
export const initializeSocketHandlers = (io: Server) => {
  io.on('connection', (socket: Socket) => {
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
      } else {
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
      const filteredText = filterProfanity(text);
      
      // Create message object
      const message: Message = {
        id: uuidv4(),
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
          setGuessTimeLimit(matchId, participantId);
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
        setTimeout(async () => {
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
            const aiResponseText = await generateChatGPTResponse(
              filteredText,
              matchId,
              conversationHistory[matchId]
            );
            
            // Create AI message object
            const aiResponse: Message = {
              id: uuidv4(),
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
              setGuessTimeLimit(matchId, userId); // Human is always player A in AI matches
              
              // Notify client that the final message has been sent
              io.to(`match:${matchId}`).emit('final-message', { 
                matchId,
                timeLimit: 30 // 30 seconds
              });
            }
          } catch (error) {
            console.error('Error generating AI response:', error);
            
            // Fallback to simple response if API fails
            const fallbackResponse: Message = {
              id: uuidv4(),
              text: "That's interesting. Tell me more about your thoughts on this topic.",
              sender: 'playerB',
              timestamp: new Date()
            };
            
            messages[matchId].push(fallbackResponse);
            io.to(`match:${matchId}`).emit('new-message', { message: fallbackResponse });
          }
        }, DEFAULT_AI_DELAY_MIN + Math.random() * (DEFAULT_AI_DELAY_MAX - DEFAULT_AI_DELAY_MIN)); // Random delay
      }
    });
    
    // Disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      // Find and remove the user from active connections
      let disconnectedUserId: string | undefined;
      
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