const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});

const upload = multer({ storage });

app.use(express.static('public'));
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT, title TEXT, logo TEXT, meta_tags TEXT)');
    db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, row) => {
        if (!row) {
            db.run('INSERT INTO users (username, password, title, logo, meta_tags) VALUES (?, ?, ?, ?, ?)', ['admin', '123456', 'GS Premiações', '', '']);
        }
    });
    db.run('CREATE TABLE IF NOT EXISTS links (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT, url TEXT)');
});

app.set('view engine', 'ejs');
app.set('views', __dirname);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'segredo', resave: false, saveUninitialized: true }));

app.get('/', (req, res) => {
    db.get('SELECT * FROM users WHERE id = 1', (err, usuario) => {
        db.all('SELECT * FROM links WHERE user_id = 1', (err, links) => {
            res.render('index', { usuario: usuario || { title: 'GS Premiações', logotipo: '' }, links: links || [] });
        });
    });
});

app.get('/auth/login', (req, res) => res.render('auth/login', { erro: null }));
app.post('/auth/login', (req, res) => {
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [req.body.username, req.body.password], (err, usuario) => {
        if (usuario) {
            req.session.usuario = usuario;
            res.redirect('/admin/painel de controle');
        } else {
            res.render('auth/login', { erro: 'Dados incorretos' });
        }
    });
});

app.get('/admin/painel de controle', (req, res) => {
    const idDoUsuario = req.session.usuario?.id || 1;
    db.get('SELECT * FROM users WHERE id = ?', [idDoUsuario], (err, usuario) => {
        db.all('SELECT * FROM links WHERE user_id = ?', [idDoUsuario], (err, links) => {
            res.render('administrador', { usuario: usuario || { title: 'GS Premiações', logotipo: '' }, links: links || [] });
        });
    });
});

app.post('/admin/update-settings', upload.single('logotipo'), (req, res) => {
    const { title, meta_tags } = req.body;
    const idDoUsuario = req.session.usuario?.id || 1;
    db.get('SELECT logo FROM users WHERE id = ?', [idDoUsuario], (err, linha) => {
        const logotipoAtual = linha?.logo || '';
        const logotipo = req.file ? '/uploads/' + req.file.filename : logotipoAtual;
        db.run('UPDATE users SET title = ?, logo = ?, meta_tags = ? WHERE id = ?', [title, logotipo, meta_tags, idDoUsuario], () => {
            res.redirect('/admin/painel de controle');
        });
    });
});

app.post('/admin/adicionar-link', (req, res) => {
    const idDoUsuario = req.session.usuario?.id || 1;
    db.run('INSERT INTO links (user_id, title, url) VALUES (?, ?, ?)', [idDoUsuario, req.body.title, req.body.url], () => {
        res.redirect('/admin/painel de controle');
    });
});

app.listen(PORT, HOST, () => {
    console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});
                 
