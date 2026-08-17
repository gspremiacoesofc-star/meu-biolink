const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Garante que a pasta public/uploads exista para evitar erros de imagem
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do Multer para upload de imagens
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'segredo', resave: false, saveUninitialized: true }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Banco de dados SQLite
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Erro ao abrir o banco de dados', err.message);
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        username TEXT, 
        password TEXT, 
        title TEXT, 
        logo TEXT, 
        meta_tags TEXT
    )`, () => {
        db.get(`SELECT * FROM users WHERE id = 1`, (err, row) => {
            if (!row) {
                db.run(`INSERT INTO users (username, password, title, logo, meta_tags) VALUES ('admin', '123456', 'Meu Biolink', '', '')`);
            }
        });
    });
    
    db.run(`CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id INTEGER, 
        title TEXT, 
        url TEXT
    )`);
});

// Rota Principal (Com tratamento seguro contra erros)
app.get('/', (req, res) => {
    db.get(`SELECT * FROM users WHERE id = 1`, (err, usuario) => {
        if (err || !usuario) {
            usuario = { title: 'Meu Biolink', logo: '', meta_tags: '' };
        }
        db.all(`SELECT * FROM links WHERE user_id = 1`, (err, links) => {
            if (err) {
                links = [];
            }
            res.render('index', { usuario: usuario, links: links || [] });
        });
    });
});

// Rotas de Autenticação
app.get('/auth/login', (req, res) => {
    res.render('auth/login', { erro: null });
});

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, usuario) => {
        if (usuario) {
            req.session.usuario = usuario;
            res.redirect('/admin/painel');
        } else {
            res.render('auth/login', { erro: 'Dados incorretos' });
        }
    });
});

// Painel Administrativo
app.get('/admin/painel', (req, res) => {
    if (!req.session.usuario) return res.redirect('/auth/login');
    const idDoUsuario = req.session.usuario.id || 1;
    db.get(`SELECT * FROM users WHERE id = ?`, [idDoUsuario], (err, usuario) => {
        db.all(`SELECT * FROM links WHERE user_id = ?`, [idDoUsuario], (err, links) => {
            res.render('administrador', { usuario: usuario || {}, links: links || [] });
        });
    });
});

// Atualizar Configurações
app.post('/admin/update-settings', upload.single('logotipo'), (req, res) => {
    if (!req.session.usuario) return res.redirect('/auth/login');
    const { title, meta_tags } = req.body;
    const idDoUsuario = req.session.usuario.id || 1;

    db.get(`SELECT logo FROM users WHERE id = ?`, [idDoUsuario], (err, row) => {
        const logoptAtual = row ? row.logo : '';
        const logotipo = req.file ? '/uploads/' + req.file.filename : logoptAtual;

        db.run(`UPDATE users SET title = ?, logo = ?, meta_tags = ? WHERE id = ?`, [title, logotipo, meta_tags, idDoUsuario], () => {
            res.redirect('/admin/painel');
        });
    });
});

// Adicionar Link
app.post('/admin/adicionar-link', (req, res) => {
    if (!req.session.usuario) return res.redirect('/auth/login');
    const { title, url } = req.body;
    const idDoUsuario = req.session.usuario.id || 1;
    db.run(`INSERT INTO links (user_id, title, url) VALUES (?, ?, ?)`, [idDoUsuario, title, url], () => {
        res.redirect('/admin/painel');
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
                 
