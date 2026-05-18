const SUPABASE_URL = 'https://xcgbwokqnuvwcgvfjjbf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjZ2J3b2txbnV2d2NndmZqamJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTMyNTUsImV4cCI6MjA5NDYyOTI1NX0.NWwSa21rLZBEq9T8p-0I50e-6ddQMZbjlE-0hWbVSic';

let usuarioLogado = false;

const output = document.getElementById('output');
const input = document.getElementById('cmd');

const commands = {
  help: () => [
    {t:'system', v:'comandos disponíveis:'},
    {t:'cmd-line', cmd:'post [título] [texto...]', desc:'cria um novo post'},
    {t:'cmd-line', cmd:'deletepost [título]', desc:'apaga um post'},
    {t:'cmd-line', cmd:'login [email] [senha]', desc:'autenticar'},
    {t:'cmd-line', cmd:'logout', desc:'encerrar sessão'},
    {t:'cmd-line', cmd:'clear', desc:'limpa o terminal'},
    {t:'cmd-line', cmd:'whoami', desc:'usuário atual'},
    {t:'cmd-line', cmd:'echo [texto]', desc:'repete o texto'},
    {t:'cmd-line', cmd:'ls', desc:'lista arquivos'},
    {t:'cmd-line', cmd:'scan', desc:'escaneia a rede'},
    {t:'cmd-line', cmd:'connect', desc:'tenta conexão'},
  ],
  whoami: () => [
    {t:'result', v: usuarioLogado ? 'admin — autenticado' : 'guest — acesso não autorizado'}
  ],
  ls: () => [
    {t:'result', v:'drwxr-x  docs/'},
    {t:'result', v:'-rw-r--  config.sys'},
    {t:'result', v:'-rw-r--  [REDACTED]'},
  ],
  scan: () => [
    {t:'system', v:'escaneando rede local...'},
    {t:'result', v:'192.168.0.1   — gateway'},
    {t:'result', v:'192.168.0.47  — dispositivo desconhecido'},
    {t:'error',  v:'192.168.0.99  — acesso bloqueado'},
  ],
  connect: () => [
    {t:'error', v:'erro: credenciais insuficientes'},
    {t:'result', v:'use: connect [host] [porta]'},
  ],
  login: async (args) => {
    const [email, senha] = args;
    if (!email || !senha) {
      return [{t:'error', v:'uso: login [email] [senha]'}];
    }
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
      },
      body: JSON.stringify({ email, password: senha }),
    });
    const data = await res.json();
    if (data.access_token) {
      usuarioLogado = true;
      return [{t:'system', v:'login realizado.'}];
    } else {
      return [{t:'error', v:'credenciais inválidas.'}];
    }
  },
  logout: () => {
    usuarioLogado = false;
    return [{t:'system', v:'sessão encerrada.'}];
  },
  deletepost: (args) => {
    if (!usuarioLogado) {
      return [{t:'error', v:'acesso negado. use: login [email] [senha]'}];
    }
    const titulo = args.join(' ').trim();
    if (!titulo) {
      return [{t:'error', v:'uso correto: deletepost [título]'}];
    }
    const posts = document.querySelectorAll('.post');
    let encontrado = false;
    posts.forEach(post => {
      if (post.querySelector('.post-title').textContent.trim() === titulo) {
        post.remove();
        encontrado = true;
      }
    });
    if (encontrado) {
      deletarPost(titulo);
      return [{t:'system', v:`post "${titulo}" removido.`}];
    } else {
      return [{t:'error', v:`post "${titulo}" não encontrado.`}];
    }
  },
  post: (args) => {
    if (!args.length) {
      return [{t:'error', v:'uso correto: post [título] [texto...]'}];
    }
    const titulo = args[0];
    const corpo = args.slice(1).join(' ');
    if (!corpo) {
      return [{t:'error', v:'uso correto: post [título] [texto...]'}];
    }
    const data = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    const postEl = document.createElement('div');
    postEl.className = 'post';
    postEl.innerHTML = `
      <span class="post-date">${data}</span>
      <h2 class="post-title">${titulo}</h2>
      <p class="post-body">${corpo}</p>
    `;
    document.querySelector('.posts').prepend(postEl);
    salvarPost(data, titulo, corpo);
    return [{t:'system', v:`post "${titulo}" publicado.`}];
  },
};

async function salvarPost(data, titulo, corpo) {
  await fetch(`${SUPABASE_URL}/rest/v1/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ data, titulo, corpo }),
  });
}

async function deletarPost(titulo) {
  await fetch(`${SUPABASE_URL}/rest/v1/posts?titulo=eq.${encodeURIComponent(titulo)}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
}

async function carregarPosts() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?order=criado_em.desc`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  const dados = await res.json();
  dados.forEach(p => {
    const postEl = document.createElement('div');
    postEl.className = 'post';
    postEl.innerHTML = `
      <span class="post-date">${p.data}</span>
      <h2 class="post-title">${p.titulo}</h2>
      <p class="post-body">${p.corpo}</p>
    `;
    document.querySelector('.posts').appendChild(postEl);
  });
}
carregarPosts();

const ws = new WebSocket(
  `wss://${SUPABASE_URL.replace('https://', '')}/realtime/v1/websocket?apikey=${SUPABASE_KEY}&vsn=1.0.0`
);

ws.onopen = () => {
  ws.send(JSON.stringify({
    topic: 'realtime:public:posts',
    event: 'phx_join',
    payload: {},
    ref: '1'
  }));
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.event === 'INSERT') {
    const p = msg.payload.record;
    const postEl = document.createElement('div');
    postEl.className = 'post';
    postEl.innerHTML = `
      <span class="post-date">${p.data}</span>
      <h2 class="post-title">${p.titulo}</h2>
      <p class="post-body">${p.corpo}</p>
    `;
    document.querySelector('.posts').prepend(postEl);
  }
  if (msg.event === 'DELETE') {
    const titulo = msg.payload.old_record.titulo;
    document.querySelectorAll('.post').forEach(post => {
      if (post.querySelector('.post-title').textContent.trim() === titulo) {
        post.remove();
      }
    });
  }
};

function addLine(text, type = 'result', cmd = null, desc = null) {
  const div = document.createElement('div');
  div.className = `line ${type}`;
  if (type === 'cmd-line') {
    div.innerHTML = `<span class="cmd-name">${cmd}</span> — ${desc}`;
  } else {
    div.textContent = text;
  }
  output.appendChild(div);
}

addLine('s.p.l.i.t — sistema iniciado.', 'system');
addLine('digite help para ver os comandos.', 'result');

input.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const raw = input.value.trim();
  if (!raw) return;
  addLine(`guest@split:~$ ${raw}`, 'cmd');
  input.value = '';
  const [cmd, ...args] = raw.split(' ');
  if (cmd === 'clear') { output.innerHTML = ''; return; }
  if (cmd === 'echo') { addLine(args.join(' '), 'result'); return; }
  if (commands[cmd]) {
    Promise.resolve(commands[cmd](args)).then(result => {
      result.forEach(r => addLine(r.v, r.t, r.cmd, r.desc));
    });
  } else {
    addLine(`comando não encontrado: ${cmd}`, 'error');
  }
});

document.querySelector('.terminal').addEventListener('click', () => input.focus());