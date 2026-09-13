const express = require('express');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { signToken, requireAuth } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

/* ---------------------------------------------------------
   Row mappers: DB (snake_case) -> API (camelCase)
--------------------------------------------------------- */
const mapMember = r => ({
  id: r.id, name: r.name, phone: r.phone, gender: r.gender, plan: r.plan,
  startDate: r.start_date, endDate: r.end_date, status: r.status, notes: r.notes
});
const mapPatient = r => ({
  id: r.id, name: r.name, age: r.age, phone: r.phone, date: r.date, reason: r.reason, notes: r.notes
});
const mapPlan = r => ({
  id: r.id, name: r.name, duration: r.duration, price: r.price, features: r.features
});
const mapCoach = r => ({ id: r.id, name: r.name, specialty: r.specialty, phone: r.phone });
const mapClass = r => ({
  id: r.id, title: r.title, coach: r.coach_id, day: r.day, time: r.time, capacity: r.capacity
});
const mapArticle = r => ({ id: r.id, title: r.title, body: r.body, date: r.date });
const mapSettings = r => ({ name: r.name, phone: r.phone, address: r.address });

/* ---------------------------------------------------------
   Auth
--------------------------------------------------------- */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const admin = db.prepare('SELECT * FROM admin_users WHERE id = 1').get();
  if (!admin || username !== admin.username || !bcrypt.compareSync(String(password || ''), admin.password_hash)) {
    return res.status(401).json({ error: 'نام کاربری یا رمز عبور صحیح نیست.' });
  }
  const token = signToken({ sub: 'admin', username });
  res.json({ token });
});

app.put('/api/auth/password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const admin = db.prepare('SELECT * FROM admin_users WHERE id = 1').get();
  if (!admin || !bcrypt.compareSync(String(currentPassword || ''), admin.password_hash)) {
    return res.status(401).json({ error: 'رمز عبور فعلی صحیح نیست.' });
  }
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' });
  }
  const hash = bcrypt.hashSync(String(newPassword), 10);
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = 1').run(hash);
  res.json({ ok: true });
});

/* ---------------------------------------------------------
   Settings
--------------------------------------------------------- */
app.get('/api/settings', (req, res) => {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json(mapSettings(row));
});

app.put('/api/settings', requireAuth, (req, res) => {
  const { name, phone, address } = req.body || {};
  db.prepare('UPDATE settings SET name = ?, phone = ?, address = ? WHERE id = 1').run(name || '', phone || '', address || '');
  res.json(mapSettings(db.prepare('SELECT * FROM settings WHERE id = 1').get()));
});

/* ---------------------------------------------------------
   Dashboard bootstrap (single call for the admin panel)
--------------------------------------------------------- */
app.get('/api/admin/bootstrap', requireAuth, (req, res) => {
  res.json({
    members: db.prepare('SELECT * FROM members ORDER BY id DESC').all().map(mapMember),
    patients: db.prepare('SELECT * FROM patients ORDER BY id DESC').all().map(mapPatient),
    plans: db.prepare('SELECT * FROM plans ORDER BY sort_order, id').all().map(mapPlan),
    coaches: db.prepare('SELECT * FROM coaches ORDER BY id').all().map(mapCoach),
    classes: db.prepare('SELECT * FROM classes ORDER BY id').all().map(mapClass),
    articles: db.prepare('SELECT * FROM articles ORDER BY id DESC').all().map(mapArticle),
    settings: mapSettings(db.prepare('SELECT * FROM settings WHERE id = 1').get())
  });
});

/* ---------------------------------------------------------
   Public read-only data for the public site
--------------------------------------------------------- */
app.get('/api/public/site', (req, res) => {
  res.json({
    plans: db.prepare('SELECT * FROM plans ORDER BY sort_order, id').all().map(mapPlan),
    coaches: db.prepare('SELECT * FROM coaches ORDER BY id').all().map(mapCoach),
    classes: db.prepare('SELECT * FROM classes ORDER BY id').all().map(mapClass),
    articles: db.prepare('SELECT * FROM articles ORDER BY id DESC').all().map(mapArticle),
    settings: mapSettings(db.prepare('SELECT * FROM settings WHERE id = 1').get()),
    memberCount: db.prepare('SELECT COUNT(*) AS c FROM members').get().c,
    coachCount: db.prepare('SELECT COUNT(*) AS c FROM coaches').get().c
  });
});

/* ---------------------------------------------------------
   Members (gym) — public can create (join form), admin manages
--------------------------------------------------------- */
app.post('/api/members', (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.phone) return res.status(400).json({ error: 'نام و شماره تماس الزامی است.' });
  const startDate = b.startDate || new Date().toLocaleDateString('fa-IR');
  const info = db.prepare(
    'INSERT INTO members (name, phone, gender, plan, start_date, end_date, status, notes) VALUES (?,?,?,?,?,?,?,?)'
  ).run(b.name, b.phone, b.gender || '', b.plan || '', startDate, b.endDate || '', 'active', b.notes || '');
  const row = db.prepare('SELECT * FROM members WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(mapMember(row));
});

app.get('/api/members', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM members ORDER BY id DESC').all().map(mapMember));
});

app.put('/api/members/:id', requireAuth, (req, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'یافت نشد.' });
  db.prepare(
    'UPDATE members SET name=?, phone=?, gender=?, plan=?, start_date=?, end_date=?, status=?, notes=? WHERE id=?'
  ).run(
    b.name ?? existing.name, b.phone ?? existing.phone, b.gender ?? existing.gender,
    b.plan ?? existing.plan, b.startDate ?? existing.start_date, b.endDate ?? existing.end_date,
    b.status ?? existing.status, b.notes ?? existing.notes, req.params.id
  );
  res.json(mapMember(db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id)));
});

app.delete('/api/members/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/* ---------------------------------------------------------
   Patients (corrective-exercise referrals)
--------------------------------------------------------- */
app.post('/api/patients', (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.reason) return res.status(400).json({ error: 'نام و دلیل مراجعه الزامی است.' });
  const date = b.date || new Date().toLocaleDateString('fa-IR');
  const info = db.prepare(
    'INSERT INTO patients (name, age, phone, date, reason, notes) VALUES (?,?,?,?,?,?)'
  ).run(b.name, b.age || null, b.phone || '', date, b.reason, b.notes || '');
  const row = db.prepare('SELECT * FROM patients WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(mapPatient(row));
});

app.get('/api/patients', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM patients ORDER BY id DESC').all().map(mapPatient));
});

app.delete('/api/patients/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

app.delete('/api/patients', requireAuth, (req, res) => {
  db.prepare('DELETE FROM patients').run();
  res.status(204).end();
});

/* ---------------------------------------------------------
   Plans
--------------------------------------------------------- */
app.get('/api/plans', (req, res) => {
  res.json(db.prepare('SELECT * FROM plans ORDER BY sort_order, id').all().map(mapPlan));
});

app.post('/api/plans', requireAuth, (req, res) => {
  const b = req.body || {};
  const info = db.prepare('INSERT INTO plans (name, duration, price, features) VALUES (?,?,?,?)')
    .run(b.name || '', b.duration || 0, b.price || 0, b.features || '');
  res.status(201).json(mapPlan(db.prepare('SELECT * FROM plans WHERE id = ?').get(info.lastInsertRowid)));
});

app.put('/api/plans/:id', requireAuth, (req, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'یافت نشد.' });
  db.prepare('UPDATE plans SET name=?, duration=?, price=?, features=? WHERE id=?')
    .run(b.name ?? existing.name, b.duration ?? existing.duration, b.price ?? existing.price, b.features ?? existing.features, req.params.id);
  res.json(mapPlan(db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id)));
});

app.delete('/api/plans/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM plans WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/* ---------------------------------------------------------
   Coaches
--------------------------------------------------------- */
app.get('/api/coaches', (req, res) => {
  res.json(db.prepare('SELECT * FROM coaches ORDER BY id').all().map(mapCoach));
});

app.post('/api/coaches', requireAuth, (req, res) => {
  const b = req.body || {};
  const info = db.prepare('INSERT INTO coaches (name, specialty, phone) VALUES (?,?,?)')
    .run(b.name || '', b.specialty || '', b.phone || '');
  res.status(201).json(mapCoach(db.prepare('SELECT * FROM coaches WHERE id = ?').get(info.lastInsertRowid)));
});

app.put('/api/coaches/:id', requireAuth, (req, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM coaches WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'یافت نشد.' });
  db.prepare('UPDATE coaches SET name=?, specialty=?, phone=? WHERE id=?')
    .run(b.name ?? existing.name, b.specialty ?? existing.specialty, b.phone ?? existing.phone, req.params.id);
  res.json(mapCoach(db.prepare('SELECT * FROM coaches WHERE id = ?').get(req.params.id)));
});

app.delete('/api/coaches/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE classes SET coach_id = NULL WHERE coach_id = ?').run(req.params.id);
  db.prepare('DELETE FROM coaches WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/* ---------------------------------------------------------
   Classes
--------------------------------------------------------- */
app.get('/api/classes', (req, res) => {
  res.json(db.prepare('SELECT * FROM classes ORDER BY id').all().map(mapClass));
});

app.post('/api/classes', requireAuth, (req, res) => {
  const b = req.body || {};
  const info = db.prepare('INSERT INTO classes (title, coach_id, day, time, capacity) VALUES (?,?,?,?,?)')
    .run(b.title || '', b.coach || null, b.day || '', b.time || '', b.capacity || 0);
  res.status(201).json(mapClass(db.prepare('SELECT * FROM classes WHERE id = ?').get(info.lastInsertRowid)));
});

app.put('/api/classes/:id', requireAuth, (req, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'یافت نشد.' });
  db.prepare('UPDATE classes SET title=?, coach_id=?, day=?, time=?, capacity=? WHERE id=?')
    .run(b.title ?? existing.title, b.coach ?? existing.coach_id, b.day ?? existing.day, b.time ?? existing.time, b.capacity ?? existing.capacity, req.params.id);
  res.json(mapClass(db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id)));
});

app.delete('/api/classes/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/* ---------------------------------------------------------
   Articles
--------------------------------------------------------- */
app.get('/api/articles', (req, res) => {
  res.json(db.prepare('SELECT * FROM articles ORDER BY id DESC').all().map(mapArticle));
});

app.post('/api/articles', requireAuth, (req, res) => {
  const b = req.body || {};
  const date = new Date().toLocaleDateString('fa-IR');
  const info = db.prepare('INSERT INTO articles (title, body, date) VALUES (?,?,?)')
    .run(b.title || '', b.body || '', date);
  res.status(201).json(mapArticle(db.prepare('SELECT * FROM articles WHERE id = ?').get(info.lastInsertRowid)));
});

app.put('/api/articles/:id', requireAuth, (req, res) => {
  const b = req.body || {};
  const existing = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'یافت نشد.' });
  db.prepare('UPDATE articles SET title=?, body=? WHERE id=?')
    .run(b.title ?? existing.title, b.body ?? existing.body, req.params.id);
  res.json(mapArticle(db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id)));
});

app.delete('/api/articles/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM articles WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

/* --------------------------------------------------------- */
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Nosrati Gym Management server running at http://localhost:${PORT}`);
});
