const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is alive!');
});

server.listen(8000, () => {
  console.log('Keep-alive server running on port 8000');
});

// Ping diri sendiri setiap 4 menit biar tidak sleep
setInterval(() => {
  const url = process.env.KOYEB_PUBLIC_DOMAIN
    ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}/`
    : 'http://localhost:8000/';

  http.get(url, (res) => {
    console.log(`Self-ping: ${res.statusCode}`);
  }).on('error', () => {
    // ping localhost sebagai fallback
    http.get('http://localhost:8000/', () => {}).on('error', () => {});
  });
}, 4 * 60 * 1000);
