const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is alive!');
}).listen(8000, () => {
  console.log('Keep-alive server running on port 8000');
});
