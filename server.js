const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

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
                db.run(`INSERT INTO users (username, password, title, logo, meta_tags) VALUES ('admin', '123456', 'GS PREMIAÇÕES', '', '')`);
            } else {
                db.run(`UPDATE users SET title = 'GS PREMIAÇÕES' WHERE id = 1 AND (title = 'Meu Biolink' OR title = '')`);
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

// Rota Principal
app.get('/', (req, res) => {
    db.get(`SELECT * FROM users WHERE id = 1`, (err, usuario) => {
        if (err || !usuario) {
            usuario = { title: 'GS PREMIAÇÕES', logo: '', meta_tags: '' };
        }
        db.all(`SELECT * FROM links WHERE user_id = 1`, (err, links) => {
            res.render('index', { usuario: usuario, links: links || [] });
        });
    });
});

// Rotas de Autenticação
app.get('/auth/login', (req, res) => {
    res.send(`<!DOCTYPE html>
    <html lang="pt-BR">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Login - GS Premiações</title>
    <style>body{background:#121214;color:#fff;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;}
    .box{background:#202024;padding:30px;border-radius:8px;width:100%;max-width:350px;box-shadow:0 4px 12px rgba(0,0,0,0.5);}
    h2{text-align:center;margin-bottom:20px;color:#00b37e;}
    input{width:100%;padding:12px;margin-bottom:12px;background:#121214;border:1px solid #29292e;color:#fff;border-radius:6px;box-sizing:border-box;}
    button{width:100%;padding:12px;background:#00b37e;border:none;color:#fff;font-weight:bold;border-radius:6px;cursor:pointer;}
    button:hover{background:#00875f;}</style></head>
    <body><div class="box"><h2>Painel Admin</h2><form method="POST"><input type="text" name="username" placeholder="Usuário" required><input type="password" name="password" placeholder="Senha" required><button type="submit">Entrar</button></form></div></body></html>`);
});

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, usuario) => {
        if (usuario) {
            req.session.usuario = usuario;
            res.redirect('/admin/painel');
        } else {
            res.send(`<script>alert('Dados incorretos!'); window.location.href='/auth/login';</script>`);
        }
    });
});

// Painel Administrativo Estilizado
app.get('/admin/painel', (req, res) => {
    if (!req.session.usuario) return res.redirect('/auth/login');
    const idDoUsuario = req.session.usuario.id || 1;
    db.get(`SELECT * FROM users WHERE id = ?`, [idDoUsuario], (err, usuario) => {
        db.all(`SELECT * FROM links WHERE user_id = ?`, [idDoUsuario], (err, links) => {
            res.send(`<!DOCTYPE html>
            <html lang="pt-BR">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Painel Administrativo</title>
            <style>body{background:#121214;color:#fff;font-family:sans-serif;padding:20px;margin:0;}
            .container{max-width:600px;margin:0 auto;background:#202024;padding:25px;border-radius:10px;box-shadow:0 4px 15px rgba(0,0,0,0.6);}
            h2, h3{color:#00b37e;margin-top:0;}
            label{display:block;margin-top:12px;margin-bottom:5px;font-size:14px;color:#c4c4cc;}
            input[type="text"], input[type="file"]{width:100%;padding:12px;background:#121214;border:1px solid #29292e;color:#fff;border-radius:6px;box-sizing:border-box;}
            button{margin-top:15px;width:100%;padding:12px;background:#00b37e;border:none;color:#fff;font-weight:bold;border-radius:6px;cursor:pointer;}
            button:hover{background:#00875f;}
            .link-item{background:#121214;padding:10px 15px;margin-top:8px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;border:1px solid #29292e;}
            a{color:#00b37e;text-decoration:none;}
            .logout{display:inline-block;margin-top:20px;color:#f75a68;text-align:center;width:100%;}</style></head>
            <body><div class="container">
            <h2>Painel GS Premiações</h2>
            <form action="/admin/update-settings" method="POST" enctype="multipart/form-data">
                <label>Título do Site:</label>
                <input type="text" name="title" value="${usuario ? usuario.title : 'GS PREMIAÇÕES'}" required>
                <label>Logotipo (Imagem de Perfil):</label>
                <input type="file" name="logotipo">
                <button type="submit">Salvar Configurações</button>
            </form>
            <hr style="border:0;border-top:1px solid #29292e;margin:25px 0;">
            <h3>Adicionar Novo Link</h3>
            <form action="/admin/adicionar-link" method="POST">
                <label>Título do Link (ex: Grupo VIP, WhatsApp):</label>
                <input type="text" name="title" required>
                <label>URL do Link (ex: https://...):</label>
                <input type="text" name="url" required>
                <button type="submit">Adicionar Link</button>
            </form>
            <h3 style="margin-top:25px;">Seus Links Cadastrados:</h3>
            ${links && links.length > 0 ? links.map(l => `<div class="link-item"><span><strong>${l.title}</strong><br><small>${l.url}</small></span></div>`).join('') : '<p style="color:#8d8d99;">Nenhum link cadastrado ainda.</p>'}
            <a href="/" target="_blank" style="display:block;text-align:center;margin-top:20px;">Ver site no ar ↗</a>
            <a href="/auth/login" class="logout">Sair do Painel</a>
            </div></body></html>`);
        });
    });
});

app.post('/admin/update-settings', upload.single('logotipo'), (req, res) => {
    if (!req.session.usuario) return res.redirect('/auth/login');
    const { title } = req.body;
    const idDoUsuario = req.session.usuario.id || 1;

    db.get(`SELECT logo FROM users WHERE id = ?`, [idDoUsuario], (err, row) => {
        const logoptAtual = row ? row.logo : '';
        const logotipo = req.file ? '/uploads/' + req.file.filename : logoptAtual;

        db.run(`UPDATE users SET title = ?, logo = ? WHERE id = ?`, [title, logotipo, idDoUsuario], () => {
            res.redirect('/admin/painel');
        });
    });
});

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
            
