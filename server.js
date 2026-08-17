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
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT, title TEXT, logo TEXT, meta_tags TEXT)`);
    db.get(`SELECT * FROM users WHERE username = 'admin'`, (err, row) => {
        if (!row) {
            db.run(`INSERT INTO users (username, password, title, logo, meta_tags) VALUES ('admin', '123456', 'GS Premiações', '', '')`);
        }
    });
    db.run(`CREATE TABLE IF NOT EXISTS links (id INTEGER PRIMARY KEY, user_id INTEGER, title TEXT, url TEXT)`);
});

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'segredo', resave: false, saveUninitialized: true }));

app.get('/', (req, res) => {
    db.get(`SELECT * FROM users WHERE id = 1`, (err, user) => {
        db.all(`SELECT * FROM links WHERE user_id = 1`, (err, links) => {
            res.render('index', { user: user || { title: 'GS Premiações', logo: '' }, links: links || [] });
        });
    });
});

app.get('/auth/login', (req, res) => res.render('login', { error: null }));
app.post('/auth/login', (req, res) => {
    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [req.body.username, req.body.password], (err, user) => {
        if (user) { req.session.user = user; res.redirect('/admin/dashboard'); }
        else { res.render('login', { error: 'Dados inválidos' }); }
    });
});

app.get('/admin/dashboard', (req, res) => {
    const userId = req.session.user ? req.session.user.id : 1;
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
        db.all(`SELECT * FROM links WHERE user_id = ?`, [userId], (err, links) => {
            res.render('admin', { user: user || { title: 'GS Premiações', logo: '' }, links: links || [] });
        });
    });
});

app.post('/admin/update-settings', upload.single('logo'), (req, res) => {
    const { title, meta_tags } = req.body;
    const userId = req.session.user ? req.session.user.id : 1;
    
    db.get(`SELECT logo FROM users WHERE id = ?`, [userId], (err, row) => {
        const currentLogo = row ? row.logo : '';
        const logo = req.file ? req.file.filename : currentLogo;

        db.run(`UPDATE users SET title = ?, logo = ?, meta_tags = ? WHERE id = ?`, 
            [title, logo, meta_tags, userId], () => {
                res.redirect('/admin/dashboard');
        });
    });
});

app.post('/admin/add-link', (req, res) => {
    const userId = req.session.user ? req.session.user.id : 1;
    db.run(`INSERT INTO links (user_id, title, url) VALUES (?, ?, ?)`, [userId, req.body.title, req.body.url], () => res.redirect('/admin/dashboard'));
});

app.post('/admin/delete-link/:id', (req, res) => {
    const userId = req.session.user ? req.session.user.id : 1;
    db.run(`DELETE FROM links WHERE id = ? AND user_id = ?`, [req.params.id, userId], () => res.redirect('/admin/dashboard'));
});

app.listen(PORT, HOST, () => console.log(`Rodando na porta ${PORT}`));
