import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { initializeSocketHandlers } from './controllers/messages';
import matchmakingRoutes from './routes/matchmaking';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Create HTTP server using Express app
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// API Routes
app.use('/api/match', matchmakingRoutes);

// Basic route
app.get('/', (req, res) => {
  res.send('AI or Not API is running');
});

// Initialize Socket.io handlers
initializeSocketHandlers(io);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 