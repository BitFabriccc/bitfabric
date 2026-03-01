import { PubSubFabric } from '../dist/index.js';

const apiKey = process.env.BITFABRIC_API_KEY || 'test-api-key';
const topic = process.env.BITFABRIC_TOPIC || 'chat';
const text = process.argv.slice(2).join(' ') || 'hello';

const fabric = new PubSubFabric({ roomId: apiKey });
const peerId = await fabric.init();

await fabric.publish(topic, { text, t: Date.now(), from: peerId });
console.log('published', { roomId: apiKey, topic, text });

await fabric.destroy();
