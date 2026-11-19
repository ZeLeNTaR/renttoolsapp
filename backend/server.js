const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { supabase } = require('./db'); // <-- ИЗМЕНЕНО

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.set('trust proxy', 1);

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));

const requireAuth = (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Не авторизован' });
  next();
};

app.post('/api/register', async (req, res) => { // <-- async
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Проверьте поля: имя, email, пароль ≥ 8 символов' });
  }
  const normalizedEmail = String(email).trim().toLowerCase();

  // Проверка существования пользователя
  const { data: existing, error: findError } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle(); // maybeSingle вернёт null, если ничего не найдено

  if (findError) return res.status(500).json({ error: findError.message });
  if (existing) return res.status(400).json({ error: 'Этот email уже зарегистрирован' });

  const hash = bcrypt.hashSync(password, 12);

  // Вставка нового пользователя
  const { data: newUser, error: insertError } = await supabase
    .from('users')
    .insert({ email: normalizedEmail, password_hash: hash, name: String(name).trim() })
    .select('id, email, name')
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });

  req.session.user = { id: newUser.id, email: newUser.email, name: newUser.name };
  res.json({ user: req.session.user });
});

app.post('/api/login', async (req, res) => { // <-- async
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, password_hash, name')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  req.session.user = { id: user.id, email: user.email, name: user.name };
  res.json({ user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.get('/api/items', async (req, res) => { // <-- async
  const { category } = req.query;
  let query = supabase
    .from('items')
    .select('slug, title, short, category, price_per_day')
    .order('id');

  if (category) {
    query = query.eq('category', category);
  }

  const { data: items, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  res.json(items.map(i => ({ ...i, pricePerDay: i.price_per_day }))); // Приводим к прежнему формату
});

app.get('/api/items/:slug', async (req, res) => { // <-- async
  const { data: item, error } = await supabase
    .from('items')
    .select('slug, title, short, category, price_per_day')
    .eq('slug', req.params.slug)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!item) return res.status(404).json({ error: 'Товар не найден' });
  res.json({ ...item, pricePerDay: item.price_per_day });
});

app.post('/api/book/:slug', requireAuth, async (req, res) => { // <-- async
  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('slug, title, price_per_day')
    .eq('slug', req.params.slug)
    .maybeSingle();

  if (itemError) return res.status(500).json({ error: itemError.message });
  if (!item) return res.status(404).json({ error: 'Товар не найден' });

  const { start_at, end_at } = req.body;
  if (!start_at || !end_at) return res.status(400).json({ error: 'Укажите даты' });
  const start = new Date(start_at);
  const end = new Date(end_at);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return res.status(400).json({ error: 'Некорректные даты' });
  if (end <= start) return res.status(400).json({ error: 'Время окончания должно быть позже начала' });

  // Проверка пересечения
  const { data: overlap, error: overlapError } = await supabase
    .from('bookings')
    .select('id')
    .eq('item_slug', item.slug)
    .gt('end_at', start_at)
    .lt('start_at', end_at)
    .limit(1)
    .maybeSingle();

  if (overlapError) return res.status(500).json({ error: overlapError.message });
  if (overlap) return res.status(400).json({ error: 'На выбранные даты эта позиция уже забронирована' });

  const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  const total = item.price_per_day * days;

  const { error: insertError } = await supabase
    .from('bookings')
    .insert({
      user_id: req.session.user.id,
      item_slug: item.slug,
      item_title: item.title,
      price_per_day: item.price_per_day,
      start_at,
      end_at,
      total_price: total,
    });

  if (insertError) return res.status(500).json({ error: insertError.message });
  res.json({ ok: true });
});

app.delete('/api/bookings/:id', requireAuth, async (req, res) => { // <-- async
  const bookingId = req.params.id;

  // Сначала проверяем владельца
  const { data: booking, error: findError } = await supabase
    .from('bookings')
    .select('user_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (findError) return res.status(500).json({ error: findError.message });
  if (!booking) return res.status(404).json({ error: 'Бронь не найдена' });
  if (booking.user_id !== req.session.user.id) return res.status(403).json({ error: 'Нет прав для отмены этой брони' });

  const { error: deleteError } = await supabase
    .from('bookings')
    .delete()
    .eq('id', bookingId);

  if (deleteError) return res.status(500).json({ error: deleteError.message });
  res.json({ ok: true });
});

app.get('/api/account', requireAuth, async (req, res) => { // <-- async
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, item_slug, item_title, price_per_day, start_at, end_at, total_price, created_at')
    .eq('user_id', req.session.user.id)
    .order('id', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ user: req.session.user, bookings });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, '0.0.0.0', () => console.log(`Backend listening on port ${PORT}`));