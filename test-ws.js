import { WebSocket } from 'ws';
const ws = new WebSocket('wss://livetiming.azurewebsites.net/', {
  headers: {
    'Origin': 'https://livetiming.azurewebsites.net',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) Gecko/20100101 Firefox/150.0'
  }
});
ws.on('open', () => {
  console.log('connected');
  // try sending an init message?
  ws.send(JSON.stringify({ "Command": "Register", "Parameters": "50" }));
});
ws.on('message', m => console.log('msg', m.toString().substring(0, 100)));
ws.on('error', console.error);
