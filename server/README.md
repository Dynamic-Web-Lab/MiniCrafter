# MiniCrafter Rooms (Play Together relay)

A tiny relay that lets up to 4 players share one world in the online edition. Single-player still needs no server at all.

## Why a relay (and not direct peer-to-peer)
- **No IP addresses shared between kids:** every player talks only to the relay.
- **The host is in charge:** rooms have a 4-character code, and the host must let each player in. They can remove players and lock the room.
- **No chat:** the game sends picked names ("Blue Fox"), emoji and game data only. Nothing typed by a player is ever sent.
- **Nothing stored or logged:** rooms live in memory and disappear when the host leaves.
- **Limits:** 4 players per room, 500 rooms, 256 KB per message, 120 messages per second per player, 10 wrong codes per minute per address, and idle connections close after 2 minutes. Only allowed web origins can connect.
- **Zero dependencies:** one file (`rooms.mjs`), plain Node 18+.

## Run locally
```bash
node server/rooms.mjs          # listens on :8787
```
The game uses `ws://localhost:8787` automatically when served from localhost (Play Together is always on there for development). Tests can pick another relay with `?rooms=ws://host:port`.

## Deploy (Docker, behind a reverse proxy)
```bash
cd server
echo "ALLOWED_ORIGINS=https://your-site.example" > .env   # the site that hosts the game
docker compose up -d --build
```
The relay has no public port. Proxy the `/rooms` path of the game's own site (the game connects to `wss://<its own host>/rooms`) to `minicrafter-rooms:8787` with WebSocket upgrade headers, and turn off access logs for it:
```nginx
location /rooms {
  proxy_pass http://minicrafter-rooms:8787;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header X-Real-IP $remote_addr;
  proxy_read_timeout 300s;
}
```
`GET /health` returns `ok <rooms>`. It holds no data, so it needs no backups. To update it, copy `rooms.mjs` to the server and run `docker compose up -d --build` again.
