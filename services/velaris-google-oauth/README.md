# Velaris YouTube – Google OAuth / For You (Web 2.2.0)

This independent FastAPI service links the **already authenticated Jellyfin user** to
one Google YouTube account. It supports `youtube.readonly` only.

Security characteristics:
- Google OAuth authorization-code flow with random 10-minute state and PKCE S256.
- Google tokens encrypted at rest with a locally generated Fernet key; account files
  are keyed by **Jellyfin user ID** and never exposed to the browser.
- Client secrets never enter Git or the web server's static directory.
- API endpoints verify the requesting user's Jellyfin token against Jellyfin `/Users/Me`.
- Google OAuth server uses a **fixed callback** (configured in Google Cloud) and
  does not accept user-controlled redirects.
- Service is published on ZimaOS **localhost only** (`127.0.0.1:8791`).
- Tailscale path proxy is **tailnet only**; do not use public Funnel.
- Service user is nonroot uid 10002, writable state is an ignored private folder.

## Install

The OAuth JSON must exist at `secrets/google-oauth.json` in the repo root,
mode `0600`, owned by the local ZimaOS user. Ensure the authorized redirect URI
in Google Cloud is exactly:

`https://zimaos.tailbcd9a8.ts.net/api/youtube/oauth/callback`

Then:

```bash
cd ~/AppData/Velaris-v2
git pull origin main
bash services/velaris-google-oauth/setup-zimaos.sh
sudo docker ps --filter name=velaris-google-oauth
curl -fsS http://127.0.0.1:8791/health
```

The script places a **separate read-only copy** of the OAuth JSON under
`services/velaris-google-oauth/data/oauth-client.json`. The `data/`
directory is gitignored, restricted to uid 10002, and also holds encrypted
refresh tokens and the encryption key. **Do not delete or publish this folder**
or you will lose the account links.

The setup joins `velaris-zimaos-web` to the OAuth bridge's private Docker
network. Restart the web container to apply its newly bind-mounted Nginx
configuration:

```bash
sudo docker restart velaris-zimaos-web
curl -i http://127.0.0.1:8089/api/youtube/health
```

Expected HTTP 200 and JSON status ok. Access to other endpoints without
`X-Velaris-Jellyfin-Token` must return HTTP 401.

## Google callback: Tailscale Serve

The existing Tailscale HTTPS root route to Web 8088 **must stay intact**.
Add a separate mount only for the OAuth path:

```bash
sudo docker exec tailscale tailscale serve --bg --set-path=/api/youtube http://127.0.0.1:8791
sudo docker exec tailscale tailscale serve status
```

Expected:
`https://zimaos.tailbcd9a8.ts.net/api/youtube`
→ `http://127.0.0.1:8791`.

The mount strips the `/api/youtube` prefix when forwarding to FastAPI.
Check the callback mapping without granting access:

```bash
curl -i https://zimaos.tailbcd9a8.ts.net/api/youtube/health
```

Call this from a client that is connected to the same tailnet. Google itself
does not need to connect to the server: the **user's browser** follows the
redirect to the private tailnet URL. Therefore the user's device must have
Tailscale access and Google must accept the chosen redirect URI.

If Serve doesn't accept the mount or Google rejects the `.ts.net` URI,
stop and inspect the configuration; do not overwrite the working root route.
Do not use `tailscale serve reset` or `tailscale funnel`.

## Browser

Open the **current Web app on port 8089**. Go to YouTube → For You
→ Mit Google anmelden. Complete the Google consent in a pop-up, then select
Aktualisieren. My subscriptions loads all returned channels (up to 500 in
this initial implementation). For You currently examines uploads from the
first 30 returned channels and displays the 90 newest found videos.
A future pass can add paginated per-channel scanning and smarter ranking.

Google OAuth applications in Testing mode can require new consent after
seven days; tokens may expire in this mode. The user's Google account must
be added under Google Auth Platform → Test users.

## Diagnostics

```bash
sudo docker logs velaris-google-oauth --tail=75
sudo docker exec tailscale tailscale serve status
sudo docker exec velaris-zimaos-web nginx -t
curl -i http://127.0.0.1:8089/api/youtube/account
```

The final unauthenticated request should return **401**, not 200.
Do not paste the OAuth JSON, tokens, `Authorization` request headers,
URLs containing OAuth `code`, or files in `data/` into chat.
