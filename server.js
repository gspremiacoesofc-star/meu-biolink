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
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'segredo', resave: false, saveUninitialized: true }));

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
                db.run(`UPDATE users SET title = 'GS PREMIAÇÕES' WHERE id = 1`);
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

// Página Principal (Biolink)
app.get('/', (req, res) => {
    db.get(`SELECT * FROM users WHERE id = 1`, (err, usuario) => {
        const title = (usuario && usuario.title) ? usuario.title : 'GS PREMIAÇÕES';
        const logo = (usuario && usuario.logo) ? usuario.logo : '';

        db.all(`SELECT * FROM links WHERE user_id = 1`, (err, links) => {
            const listaLinks = links || [];
            
            let linksHtml = listaLinks.length > 0 
                ? listaLinks.map(l => `<a href="${l.url}" target="_blank" class="link-btn">${l.title}</a>`).join('')
                : '<p style="color:#8d8d99;text-align:center;">Nenhum link cadastrado.</p>';

            let logoHtml = logo 
                ? `<img src="${logo}" alt="Logo" class="profile-img">`
                : `<div class="profile-placeholder">🦅</div>`;

            res.send(`<!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
                <style>
                    body {
                        background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
                        color: #fff;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 20px;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        box-sizing: border-box;
                    }
                    .container {
                        width: 100%;
                        max-width: 450px;
                        text-align: center;
                    }
                    .profile-img, .profile-placeholder {
                        width: 110px;
                        height: 110px;
                        border-radius: 50%;
                        object-fit: cover;
                        border: 3px solid #00b37e;
                        box-shadow: 0 0 20px rgba(0, 179, 126, 0.6);
                        margin: 0 auto 20px auto;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #202024;
                        font-size: 40px;
                    }
                    h1 {
                        font-size: 24px;
                        margin-bottom: 30px;
                        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
                    }
                    .link-btn {
                        display: block;
                        background: rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(10px);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        color: #fff;
                        padding: 15px 20px;
                        margin-bottom: 15px;
                        border-radius: 30px;
                        text-decoration: none;
                        font-weight: bold;
                        font-size: 16px;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                    }
                    .link-btn:hover {
                        background: #00b37e;
                        border-color: #00b37e;
                        transform: translateY(-2px);
                        box-shadow: 0 6px 15px rgba(0, 179, 126, 0.4);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    ${logoHtml}
                    <h1>${title}</h1>
                    <div class="links-container">
                        ${linksHtml}
                    </div>
                </div>
            </body>
            </html>`);
        });
    });
});

// Tela de Login
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

// Painel Administrativo
app.get('/admin/painel', (req, res) => {
    if (!req.session.usuario) return res.redirect('/auth/login');
    const idDoUsuario = req.session.usuario.id || 1;
    
    db.get(`SELECT * FROM users WHERE id = ?`, [idDoUsuario], (err, usuario) => {
        const title = (usuario && usuario.title) ? usuario.title : 'GS PREMIAÇÕES';
        
        db.all(`SELECT * FROM links WHERE user_id = ?`, [idDoUsuario], (err, links) => {
            const listaLinks = links || [];

            res.send(`<!DOCTYPE html>
            <html lang="pt-BR">
            <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Painel Administrativo</title>
            <style>
            body{background:#121214;color:#fff;font-family:sans-serif;padding:20px;margin:0;}
            .container{max-width:600px;margin:0 auto;background:#202024;padding:25px;border-radius:10px;box-shadow:0 4px 15px rgba(0,0,0,0.6);}
            h2, h3{color:#00b37e;margin-top:0;}
            label{display:block;margin-top:12px;margin-bottom:5px;font-size:14px;color:#c4c4cc;}
            input[type="text"], input[type="file"]{width:100%;padding:12px;background:#121214;border:1px solid #29292e;color:#fff;border-radius:6px;box-sizing:border-box;}
            button{margin-top:15px;width:100%;padding:12px;background:#00b37e;border:none;color:#fff;font-weight:bold;border-radius:6px;cursor:pointer;}
            button:hover{background:#00875f;}
            .link-item{background:#121214;padding:12px;margin-top:10px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;border:1px solid #29292e;}
            .link-info strong{color:#fff;font-size:15px;}
            .link-info small{color:#8d8d99;word-break:break-all;}
            .btn-delete{background:#f75a68;color:#fff;padding:6px 12px;border:none;border-radius:4px;cursor:pointer;font-weight:bold;width:auto;margin-top:0;}
            .btn-delete:hover{background:#d93848;}
            a.view-site{display:block;text-align:center;margin-top:20px;color:#00b37e;text-decoration:none;font-weight:bold;}
            a.logout{display:block;margin-top:15px;color:#f75a68;text-align:center;text-decoration:none;}
            </style></head>
            <body>
            <div class="container">
                <h2>Painel GS Premiações</h2>
                <form action="/admin/update-settings" method="POST" enctype="multipart/form-data">
                    <label>Título do Site:</label>
                    <input type="text" name="title" value="${title}" required>
                    <label>Logotipo (Imagem de Perfil):</label>
                    <input type="file" name="logotipo">
                    <button type="submit">Salvar Configurações</button>
                </form>
                
                <hr style="border:0;border-top:1px solid #29292e;margin:25px 0;">
                
                <h3>Adicionar Novo Link</h3>
                <form action="/admin/adicionar-link" method="POST">
                    <label>Título do Link:</label>
                    <input type="text" name="title" placeholder="Ex: Grupo VIP, Instagram" required>
                    <label>URL do Link:</label>
                    <input type="text" name="url" placeholder="https://..." required>
                    <button type="submit">Adicionar Link</button>
                </form>

                <h3 style="margin-top:25px;">Seus Links Cadastrados:</h3>
                ${listaLinks.length > 0 ? listaLinks.map(l => `
                    <div class="link-item">
                        <div class="link-info">
                            <strong>${l.title}</strong><br>
                            <small>${l.url}</small>
                        </div>
                        <form action="/admin/deletar-link/${l.id}" method="POST" style="margin:0;">
                            <button type="submit" class="btn-delete">Excluir</button>
                        </form>
                    </div>
                `).join('') : '<p style="color:#8d8d99;">Nenhum link cadastrado ainda.</p>'}

                <a href="/" target="_blank" class="view-site">Ver site no ar ↗</a>
                <a href="/auth/login" class="logout">Sair do Painel</a>
            </div>
            </body></html>`);
        });
    });
});

app.post('/admin/update-settings', upload.single('logotipo'), (req, res) => {
    if (!req.session.usuario) return res.redirect('/auth/login');
    const { title } = req.body;
    const idDoUsuario = req.session.usuario.id || 1;

    db.get(`SELECT logo FROM users WHERE id = ?`, [idDoUsuario], (err, row) => {
        const logoptAtual = (row && row.logo) ? row.logo : '';
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

app.post('/admin/deletar-link/:id', (req, res) => {
    if (!req.session.usuario) return res.redirect('/auth/login');
    const linkId = req.params.id;
    db.run(`DELETE FROM links WHERE id = ?`, [linkId], () => {
        res.redirect('/admin/painel');
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
             
