# 🏆 Troca Figurinhas — Copa do Mundo 2026

Sistema web (estático + Supabase) para controle e troca de figurinhas do álbum da Copa do Mundo 2026.
100 % responsivo, mobile-first, pronto para hospedar no GitHub Pages.

## ✨ Funcionalidades

- 👤 Cadastro e login de usuários (Supabase Auth)
- 📋 Coleção pessoal com 980 figurinhas pré-cadastradas (1 intro + 19 FWC + 48 países × 20)
- ❌ Filtros: faltantes, repetidas, por seção e tipo
- 🤝 Cálculo automático de oportunidades de troca entre usuários
- 📬 Sistema de propostas (pendente / aceita / recusada / cancelada / concluída)
- 📲 Botão direto para WhatsApp
- ⚙️ Painel administrativo (gerenciar usuários e figurinhas)
- 📱 Bottom-nav mobile + sidebar desktop

## 🚀 Como configurar

### 1. Criar projeto no Supabase

1. Crie uma conta gratuita em <https://supabase.com>
2. **New Project** → escolha um nome, senha do banco e região
3. Aguarde alguns minutos até o projeto ficar pronto

### 2. Executar o schema SQL

1. No painel do Supabase: **SQL Editor** → **New query**
2. Cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql)
3. Clique em **Run** (vai criar tabelas, policies, RPCs e inserir as 980 figurinhas)

### 3. Configurar credenciais

1. No Supabase: **Project Settings → API**
2. Copie **Project URL** e **anon public** key
3. Cole em [`js/supabase-config.js`](js/supabase-config.js):

```js
window.SUPABASE_URL  = 'https://xxxxx.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGc...';
```

### 4. (Opcional) Desativar confirmação de e-mail

Para um MVP em grupo de amigos, você pode desabilitar a confirmação:
**Authentication → Providers → Email** → desmarcar **Confirm email**.

### 5. Promover seu usuário a admin

Cadastre-se pela aplicação e depois execute no SQL Editor:

```sql
update public.profiles
   set role = 'admin'
 where id = (select id from auth.users where email = 'seu@email.com');
```

## 🌐 Deploy no GitHub Pages

```bash
cd /Users/joelbueno/troca-figurinhas
git init
git add .
git commit -m "feat: sistema de troca de figurinhas Copa 2026"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/troca-figurinhas.git
git push -u origin main
```

Depois no GitHub:

1. **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main` / `(root)`
4. Salvar — em alguns segundos sua URL ficará disponível
   (`https://SEU-USUARIO.github.io/troca-figurinhas/`)

## 🧪 Rodar localmente

Como é puro HTML/CSS/JS, basta um servidor estático qualquer:

```bash
# Python (já vem instalado no Mac)
python3 -m http.server 8000

# Ou se tiver Node.js
npx serve
```

Acesse <http://localhost:8000>.

## 🗂️ Estrutura

```
troca-figurinhas/
├── index.html              ← entry point
├── css/style.css           ← estilo único (mobile-first)
├── js/
│   ├── supabase-config.js  ← suas credenciais
│   └── app.js              ← toda a lógica da SPA
├── supabase/
│   └── schema.sql          ← rodar uma vez no Supabase
└── README.md
```

## 🔐 Segurança

- Autenticação via Supabase Auth (JWT gerenciado)
- Row Level Security ativo em **todas** as tabelas
- Cada usuário só lê/edita sua própria coleção
- Apenas admins podem editar a base de figurinhas
- Trocas só ficam visíveis para os dois usuários envolvidos
- A chave **anon** é segura para expor no front (RLS faz a proteção real)

## 🎨 Design

- Tema visual inspirado nos países-sede (México 🇲🇽 EUA 🇺🇸 Canadá 🇨🇦)
- Cores: azul profundo, vermelho vibrante e dourado
- 100 % responsivo, com bottom-nav no celular e sidebar no desktop
- Suporte a área segura do iPhone (notch + barra inferior)

---

Feito com ⚽ para a Copa do Mundo 2026.
