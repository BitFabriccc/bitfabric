# BitFabric Web Console (Vue)

BitFabric is a direct P2P pub/sub messaging system leveraging **Gun** and **Nostr** for decentralized communication. This repository contains the reference web implementation, providing a premium interface for room management, real-time message tracking, and community support.

## Key Features

- **P2P Support Forum**: A real-time, decentralized discussion board allowing users to ask questions and participate in community support.
- **API Key Validation**: Distinguishes between validated pro-tier keys and open free-tier sessions.
- **Strict Topic Enforcement**: Automatically maps unvalidated guest publications to the global `bitfabric-global-tier` pool to ensure network integrity.
- **Real-Time Mesh**: Leverages redundant transports (Gun + Nostr) to ensure sub-second message delivery globally.
- **History Replay**: Automatic persistence and replay of recent messages (via Gun) for seamless cross-session interactions.

## Web Console Development

Run the web console locally:

```bash
npm install
npm run dev
# open http://localhost:5173
```

Build for production:

```bash
npm run build
npm run preview
```

## Security & Validation

The application utilizes a Cloudflare D1 database for API key management:
- **Validated Keys**: Unlock custom Room IDs and custom publication topics.
- **Free Sessions**: Map all publications to the `bitfabric-global-tier` topic.
- **Support Forum**: Operates on a shared, unvalidated namespace (`general-support`) accessible to everyone.

## Email Verification (Optional)

This project supports transactional verification emails via **Resend**:
- **RESEND_API_KEY**: API key from Resend.com.
- **MAIL_FROM**: Example: `BitFabric <no-reply@yourdomain.com>`.

## Project Structure

- **Main UI**: `src/App.vue` (Core logic and layout)
- **Messaging Fabric**: `src/fabric/` (Library entry point)
- **Nostr Integration**: `src/nostr/` (Transport layer)
- **API Functions**: `functions/api/` (Cloudflare Pages Functions)

MIT Licensed.
