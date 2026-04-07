/**
 * Vercel Serverless Function for OpenSpeedTest.
 *
 * Important: this endpoint must accept POST (upload test) and also respond fast to
 * GET/HEAD/OPTIONS (ping / preflight). We discard request bodies to avoid memory spikes.
 */

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Content-Length,Range");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method === "HEAD") {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method === "GET") {
    res.statusCode = 200;
    return res.end("OK");
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method Not Allowed");
  }

  // Drain the request body, but don't store it.
  req.on("data", () => {});
  req.on("end", () => {
    res.statusCode = 200;
    res.end("OK");
  });
  req.on("error", () => {
    // Even on error, returning 200 keeps the client logic stable.
    res.statusCode = 200;
    res.end("OK");
  });
};

