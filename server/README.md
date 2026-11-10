# MiniCrafter online edition server

Two small services for the hosted online edition, plus a database. Single-player still needs no server at all.

| Service | File | What it does |
|---|---|---|
| Relay | `rooms.mjs` | Play Together rooms for up to 4 logged-in players (zero dependencies, nothing stored) |
| Accounts | `accounts.mjs` | Register, log in, log out and delete an account (Postgres; only dependency: `pg`) |
| Database | Postgres 16 | Usernames, password hashes and sessions. **Back it up.** |
| Dev server | `dev.mjs` | All of the above on one local address, with accounts in memory |

## Accounts: privacy by design
- Only a username and a password. No email address, no real name, no birthday, no tracking.
- The username is private: other players only see the picked colour-and-animal name.
- Passwords are hashed with scrypt. Sessions are random tokens stored only as SHA-256 hashes and sent as HttpOnly, Secure, SameSite=Lax cookies (30 days).
- Cross-site protection: requests need an allowed Origin, a JSON body and an `X-Minicrafter` header.
- Rate limits: new accounts per address per hour, and wrong passwords per address and per username.
- Deleting an account deletes its sessions too, straight away.

# The Play Together relay

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
For the whole online edition locally, run `node server/dev.mjs` and open http://localhost:8770 (accounts in memory). The game uses `ws://localhost:8787` when served from a plain localhost static server. Tests can pick another relay with `?rooms=ws://host:port`.

## Deploy (Docker, behind a reverse proxy)
```bash
cd server
printf "ALLOWED_ORIGINS=https://your-site.example\nPOSTGRES_PASSWORD=%s\n" "$(openssl rand -hex 24)" > .env
chmod 600 .env
docker compose up -d --build
```
Nothing has a public port. Proxy `/api/` to `minicrafter-accounts:8788` (and never `/internal/`, which only the relay uses), and the `/rooms` path of the game's own site (the game connects to `wss://<its own host>/rooms`) to `minicrafter-rooms:8787` with WebSocket upgrade headers, and turn off access logs for it:
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
`GET /health` returns `ok <rooms>`. The relay holds no data, but **the accounts database does: back up `minicrafter-db`** (for example `pg_dump -U minicrafter -d minicrafter`). To update, copy the files to the server and run `docker compose up -d --build` again.
