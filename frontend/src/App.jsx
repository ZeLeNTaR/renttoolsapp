import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from './api';

function useSeo(title, description) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, [title, description]);
}

function Navbar({ user, setUser }) {
  const navigate = useNavigate();
  const logout = async () => {
    await apiRequest('/logout', { method: 'POST' });
    setUser(null);
    navigate('/');
  };

  return (
    <header className="site-header">
      <div className="container">
        <Link className="brand" to="/">
          <span className="brand-name" style={{ fontSize: '24px', color: '#0d6efd', fontWeight: 'bold' }}>RentToolsApp</span>
        </Link>
        <nav className="nav">
          <Link to="/catalog">Каталог</Link>
          <Link to="/about">О сервисе</Link>
          {user ? (
            <>
              <span className="user-info">Привет, {user.name}</span>
              <Link to="/account" className="btn">Кабинет</Link>
              <button onClick={logout} className="btn">Выйти</button>
            </>
          ) : (
            <>
              <Link to="/login">Войти</Link>
              <Link to="/register" className="btn btn-primary">Регистрация</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function Home() {
  useSeo(
    'Аренда инструментов и бытовой техники — RentToolsApp',
    'Прокат перфораторов, стиральных машин и другого оборудования на день, неделю или месяц. Прозрачные цены и быстрая выдача.'
  );

  return (
    <div className="container">
      <section className="hero">
        <h1>Аренда инструментов и бытовой техники</h1>
        <p>Берите нужную технику на время, а не покупайте. Доставка и самовывоз, прозрачные цены, залог возвращается после сдачи.</p>
        <div className="btn-group">
          <Link to="/catalog" className="btn btn-primary">Перейти в каталог</Link>
        </div>
      </section>

      <h2>Популярные категории</h2>
      <ul>
        <li><Link to="/catalog/tools">Инструменты</Link></li>
        <li><Link to="/catalog/appliances">Бытовая техника</Link></li>
      </ul>

      <h2>Как это работает</h2>
      <ol>
        <li>Выберите товар в <Link to="/catalog">каталоге</Link>.</li>
        <li><Link to="/register">Зарегистрируйтесь</Link> или <Link to="/login">войдите</Link>.</li>
        <li>Укажите дату и время аренды, оформите бронь.</li>
        <li>Заберите заказ или закажите доставку.</li>
      </ol>
    </div>
  );
}

function Catalog({ category }) {
  const [items, setItems] = useState([]);
  const catName = category === 'tools' ? 'Инструменты' : category === 'appliances' ? 'Бытовая техника' : 'Все товары';

  useSeo(
    `${catName} в аренду — RentToolsApp`,
    `Аренда ${catName.toLowerCase()}: прозрачные цены, доставка, залог возвращается после сдачи.`
  );

  useEffect(() => {
    apiRequest(`/items${category ? `?category=${category}` : ''}`).then(setItems).catch(console.error);
  }, [category]);

  return (
    <div className="container">
      <h1>{catName}</h1>
      <div className="btn-group" style={{ marginBottom: 20 }}>
        <Link to="/catalog" className={`btn ${!category ? 'btn-primary' : ''}`}>Все</Link>
        <Link to="/catalog/tools" className={`btn ${category === 'tools' ? 'btn-primary' : ''}`}>Инструменты</Link>
        <Link to="/catalog/appliances" className={`btn ${category === 'appliances' ? 'btn-primary' : ''}`}>Бытовая техника</Link>
      </div>
      <div className="cards">
        {items.map(i => (
          <article key={i.slug} className="card">
            <span className="badge">{i.category === 'tools' ? 'Инструменты' : 'Бытовая техника'}</span>
            <h2><Link to={`/catalog/${i.slug}`}>{i.title}</Link></h2>
            <p>{i.short}</p>
            <div className="price">{i.pricePerDay} ₽ / сутки</div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ItemDetail({ user }) {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const navigate = useNavigate();

  useSeo(
    item ? `${item.title} — аренда в RentToolsApp` : 'Загрузка — RentToolsApp',
    item ? `${item.short} Аренда по цене ${item.pricePerDay} ₽/сутки с доставкой.` : 'Загрузка страницы товара.'
  );

  useEffect(() => {
    apiRequest(`/items/${slug}`).then(setItem).catch(e => setError(e.message));
  }, [slug]);

  const book = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiRequest(`/book/${slug}`, {
        method: 'POST',
        body: JSON.stringify({ start_at: start, end_at: end })
      });
      navigate('/account?booked=1');
    } catch (err) {
      setError(err.message);
    }
  };

  if (!item) return <div className="container"><p>Загрузка...</p></div>;

  return (
    <div className="container">
      <div className="breadcrumbs">
        <Link to="/">Главная</Link><span>/</span>
        <Link to="/catalog">Каталог</Link><span>/</span>
        <Link to={`/catalog/${item.category}`}>{item.category === 'tools' ? 'Инструменты' : 'Бытовая техника'}</Link><span>/</span>
        {item.title}
      </div>
      <article className="detail">
        <span className="badge">{item.category === 'tools' ? 'Инструменты' : 'Бытовая техника'}</span>
        <h1>{item.title}</h1>
        <p>{item.short}</p>
        <div className="price-tag">{item.pricePerDay} ₽ / сутки</div>

        <h2>Условия аренды</h2>
        <p>Стоимость указана за сутки, при частичных сутках округляется вверх. Залог возвращается после сдачи оборудования в исправном состоянии.</p>

        {error && <div className="alert">{error}</div>}

        {user ? (
          <form onSubmit={book} className="booking-form">
            <h2 style={{ marginTop: 0 }}>Оформление брони</h2>
            <div className="field">
              <label htmlFor="start">Дата и время начала</label>
              <input id="start" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="end">Дата и время окончания</label>
              <input id="end" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary">Забронировать</button>
          </form>
        ) : (
          <Link to={`/login?next=/catalog/${slug}`} className="btn btn-primary">Войти и забронировать</Link>
        )}
      </article>
    </div>
  );
}

function About() {
  useSeo(
    'О сервисе RentToolsApp — аренда инструментов',
    'Как работает сервис аренды инструментов и бытовой техники RentToolsApp: условия, доставка, залог.'
  );

  return (
    <div className="container">
      <h1>О сервисе RentToolsApp</h1>
      <p>Мы сдаём в аренду инструменты и бытовую технику для дома, ремонта и дачи.</p>

      <h2>Условия</h2>
      <p>Минимальный срок аренды — 1 сутки. Для дорогих позиций требуется залог.</p>

      <h2>Контакты</h2>
      <p>Телефон: +7 (900) 000-00-00</p>
    </div>
  );
}

function Account({ user }) {
  const [data, setData] = useState({ bookings: [] });
  const [msg, setMsg] = useState('');

  useSeo(
    'Личный кабинет — RentToolsApp',
    'Личный кабинет пользователя RentToolsApp: бронирования и контактные данные.'
  );

  useEffect(() => {
    if (user) {
      apiRequest('/account').then(setData);
      if (window.location.search.includes('booked=1')) {
        setMsg('Бронирование оформлено!');
        window.history.replaceState({}, document.title, '/account');
      }
    }
  }, [user]);

  const cancelBooking = async (id) => {
    if (!window.confirm('Вы уверены, что хотите отменить эту бронь?')) return;
    try {
      await apiRequest(`/bookings/${id}`, { method: 'DELETE' });
      const newData = await apiRequest('/account');
      setData(newData);
    } catch (err) {
      alert(err.message);
    }
  };

  if (!user) return <div className="container"><p>Необходимо <Link to="/login">войти</Link></p></div>;

  return (
    <div className="container">
      <h1>Личный кабинет</h1>
      {msg && <div className="alert alert-success">{msg}</div>}
      <div className="card" style={{ maxWidth: '400px', marginBottom: '20px' }}>
        <h2>{data.user?.name}</h2>
        <p>{data.user?.email}</p>
      </div>
      <h2>Мои бронирования</h2>
      {data.bookings.length === 0 ? (
        <p>У вас пока нет бронирований. Перейдите в <Link to="/catalog">каталог</Link>.</p>
      ) : (
        <div className="cards">
          {data.bookings.map(b => (
            <article key={b.id} className="card">
              <h3><Link to={`/catalog/${b.item_slug}`}>{b.item_title}</Link></h3>
              <p>С {new Date(b.start_at).toLocaleString('ru-RU')}<br />по {new Date(b.end_at).toLocaleString('ru-RU')}</p>
              <div className="price">{b.total_price} ₽</div>
              <button onClick={() => cancelBooking(b.id)} className="btn btn-danger" style={{ marginTop: '12px' }}>
                Отменить бронь
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function AuthForm({ type, setUser }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const next = new URLSearchParams(window.location.search).get('next') || '/account';

  useSeo(
    type === 'register' ? 'Регистрация — RentToolsApp' : 'Вход — RentToolsApp',
    type === 'register'
      ? 'Создайте аккаунт в RentToolsApp, чтобы бронировать инструменты и технику.'
      : 'Войдите в аккаунт RentToolsApp, чтобы бронировать оборудование.'
  );

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await apiRequest(`/${type}`, { method: 'POST', body: JSON.stringify(form) });
      setUser(data.user);
      navigate(next);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container">
      <form className="form" onSubmit={submit}>
        <h1>{type === 'register' ? 'Регистрация' : 'Вход'}</h1>
        {error && <div className="alert">{error}</div>}
        {type === 'register' && (
          <div className="field">
            <label htmlFor="name">Имя</label>
            <input id="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={80} />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="password">Пароль (минимум 8 символов)</label>
          <input id="password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} />
        </div>
        <button className="btn btn-primary" type="submit">
          {type === 'register' ? 'Создать аккаунт' : 'Войти'}
        </button>
      </form>
      <p className="form-footer">
        {type === 'register' ? (
          <>Уже есть аккаунт? <Link to={`/login${next !== '/account' ? '?next=' + encodeURIComponent(next) : ''}`}>Войти</Link></>
        ) : (
          <>Нет аккаунта? <Link to={`/register${next !== '/account' ? '?next=' + encodeURIComponent(next) : ''}`}>Зарегистрироваться</Link></>
        )}
      </p>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    apiRequest('/me').then(d => setUser(d.user)).catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <Navbar user={user} setUser={setUser} />
      <main style={{ flex: 1, padding: '32px 0' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/catalog/tools" element={<Catalog category="tools" />} />
          <Route path="/catalog/appliances" element={<Catalog category="appliances" />} />
          <Route path="/catalog/:slug" element={<ItemDetail user={user} />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<AuthForm type="login" setUser={setUser} />} />
          <Route path="/register" element={<AuthForm type="register" setUser={setUser} />} />
          <Route path="/account" element={<Account user={user} />} />
        </Routes>
      </main>
      <footer className="footer"><div className="container">© RentToolsApp — аренда инструментов и бытовой техники</div></footer>
    </BrowserRouter>
  );
}