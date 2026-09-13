# سامانه مدیریت باشگاه و مرکز حرکات اصلاحی نصرتی

سیستم مدیریت باشگاه بدنسازی و مرکز حرکات اصلاحی — شامل سایت عمومی (فارسی، راست‌چین) و پنل مدیریت.

## امکانات

**سایت عمومی**
- معرفی خدمات باشگاه و حرکات اصلاحی
- طرح‌های اشتراک با قیمت‌گذاری
- معرفی مربیان و برنامه هفتگی کلاس‌ها
- مطالب آموزشی
- فرم ثبت‌نام باشگاه (با صدور کارت عضویت قابل چاپ)
- فرم معرفی مراجعه‌کننده به پزشک (با صدور معرفی‌نامه رسمی قابل چاپ)
- تقویم‌های شمسی (جلالی) در تمام فرم‌های تاریخ

**پنل مدیریت**
- داشبورد با آمار کلی
- مدیریت اعضای باشگاه (افزودن، ویرایش، حذف، وضعیت اشتراک)
- مدیریت مراجعه‌کنندگان حرکات اصلاحی
- مدیریت طرح‌های اشتراک، مربیان، کلاس‌ها و مطالب
- ویرایش اطلاعات مرکز
- تغییر رمز عبور مدیر
- خروجی Excel/CSV و گزارش چاپی/PDF

## معماری

| بخش | فناوری |
|---|---|
| بک‌اند | Node.js + Express |
| پایگاه داده | SQLite (ماژول داخلی `node:sqlite` — بدون وابستگی بومی) |
| احراز هویت | JWT + bcrypt |
| فرانت‌اند | HTML/CSS/JS خالص (بدون مرحله build) |
| استقرار | Docker + nginx میزبان + Let's Encrypt |

```
server/        بک‌اند (index.js: API، db.js: پایگاه داده، auth.js: احراز هویت)
public/        فرانت‌اند (index.html + assets/logo.png)
scripts/       اسکریپت‌های استقرار
deploy/nginx/  قالب پیکربندی nginx
data/          پایگاه داده SQLite (در .gitignore — پشتیبان بگیرید)
```

---

## اجرای محلی (بدون Docker)

```bash
npm install
npm start
```

سپس `http://localhost:3000` را باز کنید.

ورود پیش‌فرض مدیریت: `admin` / `Nosrati1405!`
(پس از اولین ورود، از مسیر «اطلاعات مرکز ← تغییر رمز عبور مدیر» آن را تغییر دهید.)

---

## Deployment on a VPS

### First-time setup (one command)

On a fresh Ubuntu/Debian server, after pointing your domain's A record at it:

```bash
git clone <your-repo-url> /opt/nosrati-gym
cd /opt/nosrati-gym
./scripts/bootstrap-vps.sh
```

That single script installs Docker, writes `.env` (generating a random admin
password and printing it), starts the container, then configures the host's
nginx with a Let's Encrypt certificate for your domain.

To skip the prompts:

```bash
DOMAIN=gym.example.com LETSENCRYPT_EMAIL=admin@example.com ./scripts/bootstrap-vps.sh
```

### Running alongside other projects

This deployment is designed for a VPS that already hosts other projects. The
container publishes only on `127.0.0.1:${APP_HTTP_PORT}` (auto-picked as a free
port), and TLS is terminated by the **host's** nginx, which every project
shares. Nothing here binds port 80 or 443, and the SSL script only ever writes
files named for this project's domain or prefixed `nosrati-`.

### Day-to-day

```bash
make logs        # follow the app logs
make ps          # container status
make restart     # restart the app
make backup      # snapshot the database into backups/
make down        # stop
make deploy      # rebuild and restart after pulling new code
```

### Deploying without building on the server

If the server's network can't pull from Docker Hub reliably, build the image on
your own machine and ship it:

```bash
# on your machine
./scripts/build-images.sh
scp dist/nosrati-gym-image.tar.gz USER@SERVER:/opt/nosrati-gym/

# on the server
./scripts/load-images.sh
make up-prebuilt          # or ./scripts/bootstrap-vps.sh for a first-time setup
```

For an ARM server: `PLATFORM=linux/arm64 ./scripts/build-images.sh`

### Renewing SSL

Automatic, via certbot's own systemd timer. The renewal hook installed by
`make ssl` reloads nginx after each renewal.

---

## پشتیبان‌گیری

تمام داده‌ها (اعضا، مراجعه‌کنندگان، طرح‌ها، مربیان، کلاس‌ها، مطالب، تنظیمات و
رمز عبور مدیر) در یک فایل `data/nosrati.db` ذخیره می‌شوند.

```bash
make backup
```

فایل پشتیبان در `backups/` ساخته می‌شود. آن را خارج از سرور هم نگه دارید.

بازیابی:

```bash
docker compose down
cp backups/nosrati-YYYYmmdd-HHMMSS.db data/nosrati.db
docker compose up -d
```

## نکته پزشکی

این سامانه خدمات ورزشی، تمرینی و حرکات اصلاحی را مدیریت می‌کند و جایگزین
تشخیص، درمان یا نظر پزشک نیست.
