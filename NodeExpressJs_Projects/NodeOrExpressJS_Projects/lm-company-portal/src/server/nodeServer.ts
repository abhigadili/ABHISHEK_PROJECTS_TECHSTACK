// ============================================================
// TYPE 1: Pure Node.js HTTP Server (no Express)
// ============================================================
// WHAT: Node.js built-in 'http' module creates a raw HTTP server.
// WHY:  Understanding the underlying http module shows you what
//       Express.js actually wraps and abstracts for you.
// HOW:  http.createServer() takes a callback (req, res) called on
//       every incoming request. You manually parse URLs, set headers,
//       and write response bodies — Express does all of this for you.
// When to use pure Node.js:
//   - Ultra-lightweight scripts or tooling
//   - Learning how HTTP works under the hood
//   - Custom protocols (WebSocket upgrade, streaming)
// When to avoid:
//   - Any real application — use Express (routing, middleware, etc.)
// Interview Tip: Every Express app eventually calls createServer().
//               Express IS a Node.js HTTP request handler.
// ============================================================

import http from 'http';            // built-in, no install needed
import url from 'url';              // built-in URL parser
import { logger } from '../utils/logger';

// The callback receives IncomingMessage (req) and ServerResponse (res)
// These are streams — req is readable, res is writable
const nodeRequestHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse
): void => {

  // Parse the URL to get pathname and query string separately
  const parsedUrl = url.parse(req.url ?? '/', true);
  const pathname  = parsedUrl.pathname ?? '/';

  // Set Content-Type header — tells the browser how to interpret the response
  // Interview Tip: Always set Content-Type. Browsers sniff type if missing,
  //               which can cause security vulnerabilities (MIME sniffing).
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Powered-By', 'Node.js (pure http module)');

  // Manual routing — this is what Express Router replaces
  if (pathname === '/health' && req.method === 'GET') {
    // 200 OK
    res.writeHead(200);
    // res.end() sends the response body and ends the connection
    res.end(JSON.stringify({
      success: true,
      message: 'Node.js HTTP server is healthy',
      // Interview Tip: process.uptime() returns seconds since Node process started
      uptime: `${Math.floor(process.uptime())}s`,
      timestamp: new Date().toISOString(),
      // process.memoryUsage() shows RAM used by the Node.js process
      memory: process.memoryUsage(),
    }));
    return;
  }

  if (pathname === '/about-company' && req.method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      company: {
        name: 'LM Company Portal',
        description: 'Enterprise Node.js + Express.js + MongoDB learning platform',
        tech: ['Node.js', 'Express.js', 'MongoDB', 'Redis', 'JWT', 'TypeScript'],
        // Interview Tip: This pure Node.js server runs alongside Express —
        //               both use the same event loop, zero thread blocking.
      },
    }));
    return;
  }

  // 404 fallback
  res.writeHead(404);
  res.end(JSON.stringify({
    success: false,
    message: `Node.js server: route "${pathname}" not found`,
    hint: 'Try GET /health or GET /about-company',
  }));
};

// Create and export the pure Node.js server
// WHY export: the main server/index.ts will start it on a separate port
export const createNodeServer = (): http.Server => {
  return http.createServer(nodeRequestHandler);
};
