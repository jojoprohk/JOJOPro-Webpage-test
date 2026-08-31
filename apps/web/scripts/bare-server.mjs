import { createServer } from "node:http";

const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, path: req.url }));
});

server.listen(3200, "0.0.0.0", () => {
  console.log("BARE_SERVER_READY on 3200");
});
