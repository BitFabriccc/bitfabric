import { PubSubFabric } from '../dist/index.js';

const apiKey = process.env.BITFABRIC_API_KEY || 'test-api-key';
const topic = process.env.BITFABRIC_TOPIC || 'chat';

const fabric = new PubSubFabric({ roomId: apiKey });
const peerId = await fabric.init();

console.log('bitfabric node subscribe');
console.log('peerId:', peerId);
console.log('roomId(apiKey):', apiKey);
console.log('topic:', topic);
console.log('---');

fabric.subscribe(topic, (msg) => {
  console.log('message:', msg);
});

// keep process alive
await new Promise(() => {});
