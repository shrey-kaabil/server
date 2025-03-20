# AI or Not - Backend Server

This is the backend server for the AI or Not game, handling game logic, matchmaking, and real-time communication.

## Tech Stack

- Node.js with Express
- TypeScript
- Socket.io for real-time communication
- Supabase for database
- Jest for testing (planned)

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account and credentials

## Project Structure

```
server/
├── src/
│   ├── config/      # Configuration files
│   ├── controllers/ # Business logic
│   ├── routes/      # API endpoints
│   ├── utils/       # Utility functions
│   └── index.ts     # Entry point
├── package.json
└── .env
```

## Installation

1. Clone the repository (if you haven't already):
   ```bash
   git clone <repository-url>
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   ```bash
   cp .env.example .env
   ```
   - Update the following variables in `.env`:
     ```
     PORT=5000
     NODE_ENV=development
     CLIENT_URL=http://localhost:3000
     SUPABASE_URL=your_supabase_url
     SUPABASE_KEY=your_supabase_key
     ```

## Running the Server

### Development Mode
```bash
npm run dev
```
This will start the server with hot-reload enabled at http://localhost:5000

### Production Mode
```bash
npm run build
npm start
```

## API Endpoints

### Game Routes
- `POST /api/game/create` - Create a new game session
- `GET /api/game/:id` - Get game session details
- `POST /api/game/:id/message` - Send a message in game

### Matchmaking Routes
- `POST /api/matchmaking/queue` - Join matchmaking queue
- `DELETE /api/matchmaking/queue` - Leave matchmaking queue

## WebSocket Events

### Client -> Server
- `join_game` - Join a game session
- `send_message` - Send a message in game
- `make_guess` - Make a guess about opponent's identity

### Server -> Client
- `game_start` - Game session started
- `receive_message` - New message received
- `game_end` - Game session ended
- `guess_result` - Result of player's guess

## Error Handling

The server uses a standardized error response format:
```typescript
{
  status: number;
  message: string;
  error?: any;
}
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests (when implemented)
4. Submit a pull request

## Known Issues

- TypeScript errors in route handlers in `routes/matchmaking.ts` (these don't affect functionality)
- Socket connection may need reconnection handling improvements

## License

MIT License - see LICENSE file for details 