const http = require('http');
http.createServer((req, res) => res.end('alive')).listen(8000);
