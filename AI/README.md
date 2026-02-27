# BitFabric AI Integration

AI module for communicating with [Brainfuct](https://github.com/draeder/brainfuct) via BitFabric distributed messaging.

## Setup

```bash
npm install
```

## Usage

```bash
npm start
```

## Configuration

The module uses the following credentials:
- **API Key**: `c1aa5e8c0daa2c4f94d71dbcd0be6ab543d01d4f2e4c7cdcb27546cf8050bedc`
- **App ID**: `app_pfhbzhvtgqugtj44`

These are baked into `index.js` for the dedicated AI worker.

## Message Protocol

### AI Request (topic: `ai-request`)
```json
{
  "id": "request-uuid",
  "prompt": "user prompt",
  "context": {}
}
```

### AI Response (topic: `ai-response`)
```json
{
  "requestId": "request-uuid",
  "status": "processing|completed|error",
  "result": "AI response text",
  "timestamp": 1234567890
}
```

## Integration with Brainfuct

This module acts as a bridge between BitFabric's distributed network and Brainfuct's AI capabilities. Messages flow through BitFabric's pub/sub system, allowing any client to submit AI requests and receive responses in real-time.
