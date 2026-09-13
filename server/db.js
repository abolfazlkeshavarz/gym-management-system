const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'nosrati.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  gender TEXT,
  plan TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  age INTEGER,
  phone TEXT,
  date TEXT,
  reason TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  duration INTEGER,
  price INTEGER,
  features TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS coaches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  specialty TEXT,
  phone TEXT
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  coach_id INTEGER,
  day TEXT,
  time TEXT,
  capacity INTEGER,
  FOREIGN KEY (coach_id) REFERENCES coaches(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  date TEXT
);
`);

function seedIfEmpty() {
  const settingsCount = db.prepare('SELECT COUNT(*) AS c FROM settings').get().c;
  if (settingsCount === 0) {
    db.prepare('INSERT INTO settings (id, name, phone, address) VALUES (1, ?, ?, ?)').run(
      'باشگاه و مرکز حرکات اصلاحی نصرتی',
      '۰۹۱۲ ۰۰۰ ۰۰۰۰',
      'آدرس مرکز را در پنل مدیریت وارد کنید.'
    );
  }

  const adminCount = db.prepare('SELECT COUNT(*) AS c FROM admin_users').get().c;
  if (adminCount === 0) {
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'Nosrati1405!';
    const hash = bcrypt.hashSync(initialPassword, 10);
    db.prepare('INSERT INTO admin_users (id, username, password_hash) VALUES (1, ?, ?)').run('admin', hash);
    if (!process.env.ADMIN_INITIAL_PASSWORD) {
      console.log('==> No ADMIN_INITIAL_PASSWORD set; seeded default admin password "Nosrati1405!". Change it from the settings panel.');
    }
  }

  const planCount = db.prepare('SELECT COUNT(*) AS c FROM plans').get().c;
  if (planCount === 0) {
    const insertPlan = db.prepare('INSERT INTO plans (name, duration, price, features, sort_order) VALUES (?,?,?,?,?)');
    insertPlan.run('اشتراک ماهانه بدنسازی', 30, 1200000, 'دسترسی آزاد به سالن بدنسازی\nیک جلسه ارزیابی اولیه رایگان\nبرنامه تمرینی پایه', 1);
    insertPlan.run('طرح ترکیبی VIP', 30, 2200000, 'دسترسی به باشگاه و کلاس‌های گروهی\nدو جلسه حرکات اصلاحی در ماه\nپیگیری اختصاصی مربی', 2);
    insertPlan.run('بسته حرکات اصلاحی', 60, 2800000, 'ارزیابی کامل وضعیت بدنی\n۸ جلسه حرکات اصلاحی اختصاصی\nگزارش پیشرفت دوره‌ای', 3);
  }

  const coachCount = db.prepare('SELECT COUNT(*) AS c FROM coaches').get().c;
  if (coachCount === 0) {
    const insertCoach = db.prepare('INSERT INTO coaches (name, specialty, phone) VALUES (?,?,?)');
    insertCoach.run('محمد نصرتی', 'بدنسازی و پرورش اندام', '09120000010');
    insertCoach.run('زهرا کریمی', 'حرکات اصلاحی و پاسچر', '09120000011');
    insertCoach.run('رضا صادقی', 'تمرینات عملکردی', '09120000012');
    insertCoach.run('نگار حسینی', 'کلاس‌های گروهی', '09120000013');
  }

  const classCount = db.prepare('SELECT COUNT(*) AS c FROM classes').get().c;
  if (classCount === 0) {
    const coachIds = db.prepare('SELECT id FROM coaches ORDER BY id').all().map(r => r.id);
    const insertClass = db.prepare('INSERT INTO classes (title, coach_id, day, time, capacity) VALUES (?,?,?,?,?)');
    insertClass.run('بدنسازی پایه', coachIds[0], 'شنبه', '۱۸:۰۰ - ۱۹:۰۰', 15);
    insertClass.run('حرکات اصلاحی گروهی', coachIds[1], 'یکشنبه', '۱۷:۰۰ - ۱۸:۰۰', 10);
    insertClass.run('تمرینات عملکردی', coachIds[2], 'سه‌شنبه', '۱۹:۰۰ - ۲۰:۰۰', 12);
    insertClass.run('کلاس گروهی بانوان', coachIds[3], 'چهارشنبه', '۱۶:۰۰ - ۱۷:۰۰', 14);
  }

  const memberCount = db.prepare('SELECT COUNT(*) AS c FROM members').get().c;
  if (memberCount === 0) {
    const insertMember = db.prepare('INSERT INTO members (name, phone, plan, start_date, end_date, status) VALUES (?,?,?,?,?,?)');
    insertMember.run('علی محمدی', '09120000001', 'اشتراک ماهانه بدنسازی', '1405/05/01', '1405/06/01', 'active');
    insertMember.run('سارا احمدی', '09120000002', 'طرح ترکیبی VIP', '1405/04/15', '1405/05/15', 'expiring');
  }

  const articleCount = db.prepare('SELECT COUNT(*) AS c FROM articles').get().c;
  if (articleCount === 0) {
    const insertArticle = db.prepare('INSERT INTO articles (title, body, date) VALUES (?,?,?)');
    insertArticle.run('چرا ارزیابی وضعیت بدنی مهم است؟', 'ارزیابی اولیه به شناخت بهتر الگوهای حرکتی و طراحی برنامه متناسب با شرایط مراجعه‌کننده کمک می‌کند.', '۱۴۰۵/۰۵/۲۵');
    insertArticle.run('نقش تمرینات اصلاحی در کیفیت حرکت', 'تمرینات اصلاحی با هدف بهبود کنترل، هماهنگی و کیفیت اجرای حرکت برنامه‌ریزی می‌شوند.', '۱۴۰۵/۰۵/۲۰');
    insertArticle.run('اصول شروع صحیح برنامه بدنسازی', 'شروع اصولی تمرین بدنسازی با ارزیابی، تعیین هدف و برنامه‌ریزی تدریجی همراه است.', '۱۴۰۵/۰۵/۱۰');
  }
}

seedIfEmpty();

module.exports = db;
