const http = require('http');

const PORT = process.env.PORT || 8000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('🎧 DJ AFK Discord Bot is running!');
});

server.listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});

// Ping diri sendiri setiap 4 menit agar tidak idle/sleep
setInterval(() => {
  const url = process.env.KOYEB_PUBLIC_DOMAIN
    ? `https://${process.env.KOYEB_PUBLIC_DOMAIN}/`
    : `http://localhost:${PORT}/`;

  http.get(url, (res) => {
    console.log(`Keep-alive self-ping: ${res.statusCode}`);
  }).on('error', () => {
    http.get(`http://localhost:${PORT}/`, () => {}).on('error', () => {});
  });
}, 4 * 60 * 1000);
