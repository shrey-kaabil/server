"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const matchmaking_1 = require("../controllers/matchmaking");
const router = express_1.default.Router();
// Request a match - either with human or AI
router.post('/request', matchmaking_1.requestMatch);
// Get match details
router.get('/:matchId', matchmaking_1.getMatch);
// Submit a guess about opponent
router.post('/:matchId/guess', matchmaking_1.submitGuess);
// Debug endpoint to get all active matches
router.get('/debug/active', matchmaking_1.getActiveMatches);
exports.default = router;
