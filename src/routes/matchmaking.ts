import express, { RequestHandler } from 'express';
import { requestMatch, getMatch, submitGuess, getActiveMatches, fixAIMatches } from '../controllers/matchmaking';

const router = express.Router();

// Request a match - either with human or AI
router.post('/request', requestMatch as unknown as RequestHandler);

// Get match details
router.get('/:matchId', getMatch as unknown as RequestHandler);

// Submit a guess about opponent
router.post('/:matchId/guess', submitGuess as unknown as RequestHandler);

// Debug endpoint to get all active matches
router.get('/debug/active', getActiveMatches as unknown as RequestHandler);

// Debug endpoint to fix AI matches
router.get('/debug/fix-ai', fixAIMatches as unknown as RequestHandler);

export default router; 