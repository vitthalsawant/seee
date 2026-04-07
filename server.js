const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const START_PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

function setCommonHeaders(res) {
  // OpenSpeedTest can be embedded / called from other origins.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,HEAD,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Content-Length,Range");
  res.setHeader("Access-Control-Max-Age", "86400");

  // Avoid caching artifacts between repeated runs.
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
}

function send(res, statusCode, body) {
  res.statusCode = statusCode;
  if (body === undefined) return res.end();
  if (typeof body === "string" || Buffer.isBuffer(body)) return res.end(body);
  return res.end(JSON.stringify(body));
}

function safeFilePath(urlPathname) {
  const decoded = decodeURIComponent(urlPathname);
  const cleaned = decoded.replace(/\0/g, "");
  const withoutQuery = cleaned.split("?")[0];
  const resolved = path.resolve(ROOT, "." + withoutQuery);
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".ico":
      return "image/x-icon";
    case ".xml":
      return "application/xml; charset=utf-8";
    case ".webmanifest":
      return "application/manifest+json; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function requestHandler(req, res) {
  setCommonHeaders(res);

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;

  if (req.method === "OPTIONS") {
    return send(res, 200);
  }

  // Critical for accurate results: accept POST to /upload and return 200 OK fast.
  if (req.method === "POST" && pathname === "/upload") {
    req.on("data", () => {});
    req.on("end", () => send(res, 200, "OK"));
    req.on("error", () => send(res, 200, "OK"));
    return;
  }

  // Some deployments expect POST to static files to still return 200 OK.
  // We discard the body to avoid memory spikes.
  if (req.method === "POST") {
    req.on("data", () => {});
    req.on("end", () => send(res, 200, "OK"));
    req.on("error", () => send(res, 200, "OK"));
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "Method Not Allowed");
  }

  const filePath = safeFilePath(pathname);
  if (!filePath) return send(res, 404, "Not Found");

  fs.stat(filePath, (err, stat) => {
    if (err) return send(res, 404, "Not Found");

    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      fs.stat(indexPath, (e2) => {
        if (e2) return send(res, 404, "Not Found");
        res.statusCode = 200;
        res.setHeader("Content-Type", contentType(indexPath));
        if (req.method === "HEAD") return res.end();
        fs.createReadStream(indexPath).pipe(res);
      });
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", contentType(filePath));
    res.setHeader("Content-Length", String(stat.size));
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
}

function startServer(port) {
  const server = http.createServer(requestHandler);

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      const fallback = Number(port) + 1;
      console.warn(`Port ${port} is busy. Trying ${fallback}...`);
      setTimeout(() => startServer(fallback), 50);
      return;
    }
    throw err;
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`OpenSpeedTest local server running on http://localhost:${port}`);
    console.log("(Tip) If you want a fixed port: set env var PORT (e.g. PORT=3005).");
  });
}

startServer(START_PORT);

