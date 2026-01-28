# bitfabric

BitFabric is a direct pub/sub system using Gun and Nostr for messaging. All application data flows through Gun and Nostr relays.

## Web Console (Vue + Vite)

Run the web console:

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

The console lets you join a room and publish/subscribe to topics using Gun + Nostr.

## Library

- Core pub/sub fabric lives in [src/fabric](src/fabric/README.md)
- Nostr helper lives in [src/nostr/nostrClient.js](src/nostr/nostrClient.js)

MIT licensed.
