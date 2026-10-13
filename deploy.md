# Deploying to a VPS

Two ways to run this app on one Linux server. Both keep files on Cloudflare R2.

- **Docker Compose** (recommended for a beta or dev site): the app and MariaDB in containers, started with one command, behind the server's own Nginx (or, on a server with no web server, a Caddy container that does HTTPS by itself).
- **By hand**: Node behind Nginx with MariaDB installed on the server. More steps, fewer moving parts once it is running.

Written for Ubuntu 24.04. Replace `example.com` with your domain.

## What you need first

- A VPS with at least 2 GB of RAM (the build needs it; add swap on smaller machines) and a few GB of disk.
- A domain you can add DNS records to (see "Domain and DNS" below).
- Cloudflare R2: one public bucket for media, one private bucket for lesson files, and an API token that can read and write both.
- A Stripe account (live keys) if courses are sold.
- SMTP details from an email provider, with your sending domain verified there (SPF and DKIM records).

## Domain and DNS

Do this before starting the app: the HTTPS certificate can only be issued once the domain points at the server.

### Which addresses you need

| Address | For | Example |
|---|---|---|
| The site | Learners and the admin panel | `beta.example.com` for a beta, `example.com` (and `www.example.com`) for the live site |
| Media | Images served from the public R2 bucket (optional, but better than the `r2.dev` address) | `media.example.com` |
| Email sending | Not an address people visit: DNS records that prove your emails are yours | `example.com` |

### 1. Point the site address at the server

In the DNS settings of whoever manages your domain (the registrar, or Cloudflare if the domain is there), add:

| Type | Name | Value | Notes |
|---|---|---|---|
| A | `beta` (or `@` for the bare domain) | The server's IPv4 address | Required |
| A | `www` | The same address | Only if you want `www.example.com` to work too |
| AAAA | Same names | The server's IPv6 address | Only if the server has one |

Check it from your own computer; it should print the server's address:

```bash
dig +short beta.example.com
```

New records usually work within minutes, occasionally an hour or so.

**If the domain is on Cloudflare:** set the record to "DNS only" (grey cloud) for the first start, so the certificate can be issued. You can switch the proxy on (orange cloud) afterwards; then set SSL/TLS mode to "Full (strict)", otherwise visitors get a redirect loop.

### 2. Tell the app its address

In `.env`:

| Setting | Value |
|---|---|
| `DOMAIN` (Docker with the Caddy container only) | `beta.example.com` — no `https://`. For `www` as well: `example.com, www.example.com` |
| `BETTER_AUTH_URL` | `https://beta.example.com` — with `https://`, no trailing slash, and exactly the address people will type |

HTTPS comes from whichever web server faces the internet: Certbot for the server's Nginx (A4 or step 8), or the Caddy container by itself on first start.

To send `www` visitors to the bare domain with the Caddy container, set `DOMAIN=example.com` and add this block to `docker/Caddyfile`:

```
www.example.com {
	redir https://example.com{uri} permanent
}
```

### 3. Media address (optional)

Needs the domain to be on Cloudflare. In the Cloudflare dashboard open R2, the public bucket, Settings > Custom Domains, and add `media.example.com`; Cloudflare creates the DNS record itself. Then set `R2_PUBLIC_URL=https://media.example.com` in `.env`. Without this, use the bucket's `https://pub-....r2.dev` address (switch on "Public Development URL" in the same settings page). The private lesson bucket gets no public address.

### 4. Email records

Your email provider's dashboard lists the exact records to add for your sending domain. There are three kinds:

| Record | What it does |
|---|---|
| SPF (a TXT record on the domain) | Says which servers may send for your domain |
| DKIM (one or more TXT or CNAME records the provider gives you) | Signs each email so it cannot be forged |
| DMARC (a TXT record named `_dmarc`) | Tells receivers what to do with email that fails the other two. Start with `v=DMARC1; p=none; rua=mailto:you@example.com` |

Wait until the provider shows the domain as verified, then set `EMAIL_FROM` to an address on that domain, e.g. `EdX Learning <no-reply@example.com>`. Without these records most email lands in spam.

### Changing the address later

Moving from `beta.example.com` to `example.com`, or adding a domain to a site that started on an IP address:

1. Add the DNS record for the new address and wait until `dig` shows it.
2. Change `DOMAIN` (Docker) and `BETTER_AUTH_URL` in `.env`.
3. Restart: `docker compose up -d`, or by hand rerun Certbot for the new name, `pnpm build` and `systemctl restart lms`.
4. Run the upload rule again, since it names the site address: `docker compose exec app pnpm storage:cors` (or `pnpm storage:cors`).
5. In Stripe, change the webhook endpoint to the new address.

Everyone is signed out by the change, and links in emails already sent point at the old address.

## Option A — Docker Compose

### A1. Install Docker and get the code

```bash
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

git clone git@github.com:ruhulameen/lms.git /opt/lms
cd /opt/lms
```

The repository is private, so the server needs an SSH key added to GitHub as a deploy key (`ssh-keygen -t ed25519`, then paste `~/.ssh/id_ed25519.pub` under the repository's Settings > Deploy keys).

### A2. Configure `.env`

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

Fill in the settings described in the table under "4. Configure `.env`" below, with these differences:

| Setting | Value with Docker |
|---|---|
| `DATABASE_URL` | Ignored. The app always uses the database container, as `root` with no password. There is nothing to set for the database. |
| `APP_PORT` | Only if port 3000 is already used on the server (check with `ss -ltnp \| grep :3000`): another free port, e.g. `3100`. |
| `DOMAIN`, `COMPOSE_PROFILES` | Leave unset when the server has its own Nginx (A4). Only for the Caddy container (A5). |
| `BETTER_AUTH_URL` | The same address with its scheme: `https://beta.example.com` (or `http://SERVER_IP` with `DOMAIN=:80`). |
| `SEED_SAMPLES` | `true` to fill a beta site with the sample courses, learners and blog posts; `false` for an empty site with only the admin account. |

For a beta site use Stripe **test** keys (`sk_test_...`) so no real money moves.

### A3. Start it

```bash
docker compose up -d --build
docker compose logs -f app
```

On its first start the app container applies the database migrations, creates the roles and the admin account, builds the site (under a minute on a fast machine, longer on a small VPS; needs about 2 GB of memory) and then serves it. It is ready when the log says `serving on port 3000`. The app now answers on `127.0.0.1:3000` (or `APP_PORT`) on the server only; A4 or A5 puts it on the internet.

Then:

```bash
docker compose exec app pnpm storage:cors     # allow browser uploads to R2, once
```

Set up the Stripe webhook as in step 9 below, put its signing secret in `.env`, and run `docker compose up -d` again. Then run through "10. Check it works".

### A4. Put it behind the server's Nginx

For a server that already runs Nginx (and perhaps other sites). Create `/etc/nginx/sites-available/lms`, with your domain and, if you set one, your `APP_PORT`:

```nginx
server {
    listen 80;
    server_name beta.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d beta.example.com      # apt install -y certbot python3-certbot-nginx, if it is not there yet
```

Certbot adds HTTPS to that site and renews the certificate. Other sites on the server are not touched.

### A5. Or, with no web server on the machine: Caddy

On a server where nothing else uses ports 80 and 443, add to `.env`:

```
COMPOSE_PROFILES=caddy
DOMAIN=beta.example.com
```

and run `docker compose up -d`. A Caddy container takes ports 80 and 443 and gets the HTTPS certificate by itself. Do not use this next to an existing Nginx: both want the same ports.

### A6. Everyday commands

| To | Run |
|---|---|
| Update to the latest code | `git pull && docker compose up -d --build` |
| Apply a change in `.env` | `docker compose up -d` |
| See the log | `docker compose logs -f app` |
| Stop everything | `docker compose down` |
| Back up the database | `docker compose exec db mariadb-dump --single-transaction -uroot lms \| gzip > lms-$(date +%F).sql.gz` |
| Start again from an empty database | `docker compose down -v` — this deletes every account, order and course |

An update rebuilds the site inside the new container, so the site is down while that runs (about half a minute on a fast machine).

### A7. Trying it on your own computer

Keep your `pnpm dev` settings in `.env` and put the Docker ones in a second file, `.env.docker`: a copy of `.env` plus `ENV_FILE=.env.docker`, `APP_PORT=8080` (3000 is the dev server's), `BETTER_AUTH_URL=http://localhost:8080`, and `SMTP_HOST=` left empty so no real email is sent.

```bash
docker compose --env-file .env.docker -p lms-trial up -d --build
# open http://localhost:8080
docker compose --env-file .env.docker -p lms-trial down -v     # remove it again, database included
```

## Option B — By hand

## 1. Prepare the server

Log in as root (or a sudo user), then:

```bash
apt update && apt upgrade -y
apt install -y nginx mariadb-server git curl ufw

# Firewall: SSH and web only.
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw enable

# A user that owns and runs the app.
adduser --disabled-password --gecos "" lms
```

Install Node.js 24 (the version the project is developed on) and pnpm:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
corepack enable
```

`corepack` picks up the pnpm version pinned in `package.json`.

## 2. Create the database

```bash
mariadb-secure-installation
mariadb
```

```sql
CREATE DATABASE lms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'lms'@'localhost' IDENTIFIED BY 'a-long-random-password';
GRANT ALL PRIVILEGES ON lms.* TO 'lms'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Get the code

```bash
su - lms
git clone git@github.com:ruhulameen/lms.git app
cd app
```

The repository is private, so the `lms` user needs an SSH key added to GitHub as a deploy key (`ssh-keygen -t ed25519`, then paste `~/.ssh/id_ed25519.pub` under the repository's Settings > Deploy keys).

## 4. Configure `.env`

Create the file before installing: `pnpm install` generates the database client and reads it.

```bash
cp .env.example .env
chmod 600 .env
nano .env
```

| Setting | Value in production |
|---|---|
| `DATABASE_URL` | `mysql://lms:a-long-random-password@localhost:3306/lms` |
| `BETTER_AUTH_SECRET` | Output of `openssl rand -base64 32`. Keep it; changing it signs everyone out. |
| `BETTER_AUTH_URL` | `https://example.com` — no trailing slash. Links in emails, Stripe return pages and the upload rule all use it. |
| `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | The first admin account. Use a strong password; change it after first login. |
| `SEED_SAMPLE_PASSWORD` | Leave empty. Sample content is not created in production. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | From the Cloudflare R2 dashboard. |
| `R2_BUCKET`, `R2_PUBLIC_URL` | The public bucket and its address (a custom domain such as `https://media.example.com` is better than `r2.dev`). |
| `R2_PRIVATE_BUCKET` | The private bucket for lesson videos and files. |
| `STRIPE_SECRET_KEY` | Live secret key (`sk_live_...`). |
| `STRIPE_WEBHOOK_SECRET` | Filled in at step 9. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | From your email provider. With `SMTP_HOST` empty, emails are only printed to the log. |

## 5. Install, migrate, seed, build

```bash
pnpm install --frozen-lockfile
pnpm migrate:deploy
NODE_ENV=production pnpm db:seed
pnpm build
```

- Install everything, not `--prod`: the build and the database tools are development dependencies.
- `migrate:deploy` creates the tables. Never run `pnpm migrate` or `pnpm db:push` on the server.
- The seed creates the `student`, `instructor` and `admin` roles, the permission list and the admin account. With `NODE_ENV=production` it skips the sample courses, learners and posts. It is safe to run again.
- The Stripe, SMTP and R2 values can also be entered in the admin panel under Settings, where they are stored encrypted. A value saved there wins; an empty one falls back to this file. Only `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` have to be here.
- Do not change `BETTER_AUTH_SECRET` once keys have been saved in Settings: they are encrypted with it and would have to be entered again.

## 6. Allow browser uploads to R2

Uploads go straight from the browser to R2, so both buckets need a rule that allows your site's address:

```bash
pnpm storage:cors
```

Run it again if `BETTER_AUTH_URL` ever changes.

## 7. Run the app as a service

Back as root, create `/etc/systemd/system/lms.service`:

```ini
[Unit]
Description=LMS (Next.js)
After=network.target mariadb.service

[Service]
User=lms
WorkingDirectory=/home/lms/app
Environment=NODE_ENV=production
ExecStart=/usr/bin/pnpm start --hostname 127.0.0.1 --port 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now lms
systemctl status lms
journalctl -u lms -f      # live log
```

The app reads `.env` from its folder by itself. If `systemctl status` cannot find pnpm, check its path with `which pnpm` and use that in `ExecStart`.

## 8. Nginx and HTTPS

Create `/etc/nginx/sites-available/lms`:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
```

The `X-Forwarded-For` line matters: sign-in rate limiting and the activity log take the visitor's address from it.

```bash
ln -s /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

apt install -y certbot python3-certbot-nginx
certbot --nginx -d example.com -d www.example.com
```

Certbot adds the HTTPS settings and renews the certificate by itself. Large files do not pass through Nginx (they go to R2), so no upload size setting is needed.

## 9. Stripe webhook

In the Stripe dashboard, under Developers > Webhooks, add an endpoint:

- URL: `https://example.com/api/stripe/webhook`
- Events:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `refund.created`
  - `refund.updated`
  - `refund.failed`

Copy the endpoint's signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET` in `.env`, then `systemctl restart lms`.

## 10. Check it works

- Open `https://example.com` and sign in at `/login` with the seeded admin account; change its password and switch on two-factor.
- Upload an image in Media and a video in a lesson (tests both R2 buckets and the upload rule).
- Request a password reset (tests email and that links use your domain).
- Buy a course with a real card for a small amount, then refund it from the order page (tests Stripe and the webhook).

## Updating (by hand)

```bash
su - lms
cd app
git pull
pnpm install --frozen-lockfile
pnpm migrate:deploy
pnpm build
exit
systemctl restart lms
```

The site keeps serving the old version until the restart, but pages can misbehave for the minute the build is running, because the build replaces the files the running app reads. Do updates at a quiet time.

## Backups (by hand)

Everything that cannot be recreated is in the database and the two R2 buckets.

```bash
# As root: nightly database dump at 03:00, kept for 14 days.
mkdir -p /var/backups/lms
cat > /etc/cron.d/lms-backup <<'EOF'
0 3 * * * root mariadb-dump --single-transaction lms | gzip > /var/backups/lms/lms-$(date +\%F).sql.gz && find /var/backups/lms -name '*.sql.gz' -mtime +14 -delete
EOF
```

Copy the dumps off the server as well (to R2 or another machine): a backup on the same disk does not survive losing the server. Keep a copy of `.env` somewhere safe too.

## Known gaps

- **No scheduled jobs yet.** Two tasks have no trigger of their own: closing unpaid orders after they expire (it happens when someone opens or pays the order) and retrying failed emails (it happens when the next email is sent). Until a scheduled job is added, a quiet site can leave both waiting.
- **Highcharts licence.** The admin charts use Highcharts, which needs a paid licence on a commercial site.
- **The Docker database has no password.** It runs as `root` with an empty password to keep the dev and beta setup simple. Only the app container can reach it (no port is published), but set a real user and password in `docker-compose.yml` before the site holds real customer data.
- **Docker updates have downtime.** The Compose setup builds the site when the container starts, so each update takes the site down for about half a minute to a couple of minutes, depending on the server. Fine for beta; for production, build inside the image instead.
- **One server, one process.** This guide runs a single Node process, which is enough for a small site. Sessions, rate limits and the email queue are all kept in the database, so running several processes later needs no extra service.

## Troubleshooting

| Problem | Where to look |
|---|---|
| 502 Bad Gateway | The app is not running: `systemctl status lms`, `journalctl -u lms -n 100` (by hand) or `docker compose logs app` (Docker; it also shows for the half minute the app is building). |
| `address already in use` or `port is already allocated` when starting Docker | Another program has that port. For port 80 or 443: the server has its own web server, so remove `COMPOSE_PROFILES=caddy` and follow A4. For 3000: set `APP_PORT` to a free port. |
| Build is killed or runs out of memory | Add swap: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`. |
| Signed in, then signed out straight away | `BETTER_AUTH_URL` does not match the address in the browser (http vs https, or www vs no www). |
| Uploads fail in the browser | Run `pnpm storage:cors` again; check the R2 token can write to both buckets. |
| Images from R2 do not show | The public address is wrong: check Settings > File storage (or `R2_PUBLIC_URL` in `.env`) against the bucket's address in Cloudflare. |
| Orders stay "pending" after payment | The webhook is not arriving: check the endpoint's delivery log in Stripe and `STRIPE_WEBHOOK_SECRET`. |
| No emails arrive | `journalctl -u lms | grep '\[email\]'` shows send failures; failed emails are also in the `email_outbox` table with the error. |
