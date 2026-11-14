/**
 * HTTPS entrance for phones on the same Wi-Fi:  https://<laptop-ip>:3443  →  http://127.0.0.1:3100
 *
 * Phone browsers only allow a live camera on HTTPS pages. This creates a self-signed
 * certificate for this laptop's Wi-Fi address (with openssl, free) and forwards everything,
 * including the dev server's websocket. The phone shows a one-time "not private" warning
 * because the certificate is self-made; choose "continue" / "visit this website".
 *
 *   node scripts/phone-https.mjs        (npm run phone)
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const TARGET_PORT = Number(process.env.APP_PORT ?? 3100);
const PORT = Number(process.env.PHONE_HTTPS_PORT ?? 3443);

const ip = Object.values(os.networkInterfaces())
  .flat()
  .find((a) => a && a.family === "IPv4" && !a.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address))?.address;
if (!ip) {
  console.error("No Wi-Fi address found. Connect this laptop to Wi-Fi first.");
  process.exit(1);
}

const dir = path.resolve("data/certs");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const keyFile = path.join(dir, "phone-key.pem");
const certFile = path.join(dir, "phone-cert.pem");
const ipFile = path.join(dir, "phone-ip.txt");

if (!fs.existsSync(certFile) || fs.readFileSync(ipFile, "utf8").trim() !== ip) {
  const cnf = path.join(dir, "openssl.cnf");
  fs.writeFileSync(
    cnf,
    `[req]\ndistinguished_name=dn\nx509_extensions=v3\nprompt=no\n[dn]\nCN=LabWala local\n[v3]\nsubjectAltName=IP:${ip},IP:127.0.0.1,DNS:localhost\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n`,
  );
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "397", "-keyout", keyFile, "-out", certFile, "-config", cnf], { stdio: "ignore" });
  fs.writeFileSync(ipFile, ip);
  fs.chmodSync(keyFile, 0o600);
}

const forwardHeaders = (req) => ({
  ...req.headers,
  "x-forwarded-proto": "https",
  "x-forwarded-host": req.headers.host ?? `${ip}:${PORT}`,
  "x-forwarded-for": req.socket.remoteAddress ?? "",
});

const server = https.createServer({ key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }, (req, res) => {
  const upstream = http.request(
    { host: "127.0.0.1", port: TARGET_PORT, method: req.method, path: req.url, headers: forwardHeaders(req) },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
    res.end("LabWala is starting. Refresh in a moment.");
  });
  req.pipe(upstream);
});

// Websocket upgrades (live reload in development)
server.on("upgrade", (req, socket, head) => {
  const up = net.connect(TARGET_PORT, "127.0.0.1", () => {
    const headers = Object.entries(forwardHeaders(req))
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
    if (head?.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
});

server.listen(PORT, "0.0.0.0", () => console.log(`Phone HTTPS ready: https://${ip}:${PORT}  →  http://127.0.0.1:${TARGET_PORT}`));
