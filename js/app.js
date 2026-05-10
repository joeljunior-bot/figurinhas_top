/* ══════════════════════════════════════════════════════════════════════════════
   Troca Figurinhas Copa 2026 — Frontend (Supabase)
══════════════════════════════════════════════════════════════════════════════ */

if (!window.SUPABASE_URL || window.SUPABASE_URL.startsWith('COLE_')) {
  alert('⚠️ Configure suas credenciais do Supabase em js/supabase-config.js');
}
const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const state = {
  user: null,
  view: 'dashboard',
  collection: [],
  colFilter: 'all',
  proposalTab: 'all',
  adminTab: 'stats',
  opportunities: null,
  proposals: null,
  stickerUpdateTimer: {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, ms = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}
function openModal(title, body, footer) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-footer').innerHTML = footer || '';
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }

function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  s.classList.toggle('open');
  o.classList.toggle('hidden', !s.classList.contains('open'));
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.add('hidden');
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
}
function showRegister() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
}

function traduzirErro(msg) {
  const map = {
    'Invalid login credentials': 'E-mail ou senha incorretos',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar',
    'User already registered': 'Este e-mail já está cadastrado',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
  };
  return map[msg] || msg;
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await initApp();
  } catch (e) {
    errEl.textContent = traduzirErro(e.message);
    errEl.classList.remove('hidden');
  }
}

async function doRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl = document.getElementById('reg-error');
  errEl.classList.add('hidden');

  if (!name || !email || password.length < 6) {
    errEl.textContent = 'Preencha nome, e-mail e senha (mín. 6 caracteres).';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { name, phone } }
    });
    if (error) throw error;
    if (!data.session) {
      toast('📧 Verifique seu e-mail para confirmar o cadastro.', 6000);
      showLogin();
      return;
    }
    await initApp();
  } catch (e) {
    errEl.textContent = traduzirErro(e.message);
    errEl.classList.remove('hidden');
  }
}

async function doLogout() {
  await sb.auth.signOut();
  state.user = null;
  state.collection = [];
  state.opportunities = null;
  state.proposals = null;
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  showLogin();
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function navigate(view) {
  state.view = view;
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${view}`)?.classList.remove('hidden');
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  switch (view) {
    case 'dashboard':     renderDashboard(); break;
    case 'collection':    renderCollection(); break;
    case 'missing':       renderMissing(); break;
    case 'duplicates':    renderDuplicates(); break;
    case 'opportunities': loadOpportunities(); break;
    case 'proposals':     loadProposals(); break;
    case 'profile':       renderProfile(); break;
    case 'admin':         loadAdmin(); break;
  }
  window.scrollTo(0, 0);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initApp() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { doLogout(); return; }

  const { data: profile, error } = await sb
    .from('profiles')
    .select('id, name, phone, role')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    toast('Erro ao carregar perfil. Recarregue a página.');
    return;
  }
  state.user = { ...profile, email: user.email };

  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');

  const initials = state.user.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  ['topbar-avatar','sidebar-avatar','profile-avatar'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = initials;
  });
  document.getElementById('sidebar-name').textContent = state.user.name;
  document.getElementById('sidebar-email').textContent = state.user.email;

  if (state.user.role === 'admin') {
    document.getElementById('admin-nav-item').classList.remove('hidden');
  }

  await loadCollection();
  navigate('dashboard');
}

async function loadCollection() {
  const { data: stickers, error: sErr } = await sb.from('stickers').select('*').order('id');
  if (sErr) { toast('Erro: ' + sErr.message); return; }

  const { data: mine } = await sb
    .from('user_stickers').select('sticker_id, quantity').eq('user_id', state.user.id);
  const map = {};
  (mine || []).forEach(m => map[m.sticker_id] = m.quantity);
  state.collection = stickers.map(s => ({ ...s, quantity: map[s.id] || 0 }));
  populateSectionFilters();
}

function populateSectionFilters() {
  const sections = [...new Set(state.collection.map(s => s.section))];
  ['col-section-filter','missing-section-filter','dup-section-filter'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const cur = el.value;
    el.innerHTML = '<option value="all">Todas as seções</option>' +
      sections.map(sec => {
        const item = state.collection.find(c => c.section === sec);
        return `<option value="${sec}">${item?.flag || ''} ${sec} — ${item?.country || sec}</option>`;
      }).join('');
    el.value = cur || 'all';
  });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function renderDashboard() {
  try {
    const { data: stats, error } = await sb.rpc('my_stats');
    if (error) throw error;
    const total = stats.total || 0, owned = stats.owned || 0;
    const percent = total > 0 ? Math.round((owned / total) * 100) : 0;
    document.getElementById('st-total').textContent = total;
    document.getElementById('st-owned').textContent = owned;
    document.getElementById('st-missing').textContent = stats.missing || 0;
    document.getElementById('st-dup').textContent = stats.duplicates || 0;
    document.getElementById('dash-percent').textContent = `${percent}%`;
    document.getElementById('dash-progress-bar').style.width = `${percent}%`;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    document.getElementById('dash-greeting').textContent = `${greeting}, ${state.user.name.split(' ')[0]}! ⚽`;
  } catch (e) { console.error(e); }
}

// ─── Collection ───────────────────────────────────────────────────────────────
function setColFilter(filter, btn) {
  state.colFilter = filter;
  document.querySelectorAll('#view-collection .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCollection();
}
function filterCollection() { renderCollection(); }

function renderCollection() {
  const content = document.getElementById('collection-content');
  if (!content) return;
  const filter = state.colFilter;
  const sec = document.getElementById('col-section-filter')?.value || 'all';
  const typ = document.getElementById('col-type-filter')?.value || 'all';
  const q = (document.getElementById('col-search')?.value || '').toLowerCase();

  let stickers = state.collection;
  if (sec !== 'all') stickers = stickers.filter(s => s.section === sec);
  if (typ !== 'all') stickers = stickers.filter(s => s.type === typ);
  if (q) stickers = stickers.filter(s =>
    s.code.toLowerCase().includes(q) || s.country.toLowerCase().includes(q) ||
    (s.description || '').toLowerCase().includes(q));
  if (filter === 'owned')     stickers = stickers.filter(s => s.quantity >= 1);
  if (filter === 'missing')   stickers = stickers.filter(s => s.quantity === 0);
  if (filter === 'duplicate') stickers = stickers.filter(s => s.quantity > 1);

  if (stickers.length === 0) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h3>Nenhuma figurinha encontrada</h3><p>Tente ajustar os filtros.</p></div>`;
    return;
  }

  const sections = [...new Set(stickers.map(s => s.section))];
  content.innerHTML = sections.map(secName => {
    const items = stickers.filter(s => s.section === secName);
    const sample = items[0];
    const ownedCount = items.filter(s => s.quantity >= 1).length;
    const dupCount = items.filter(s => s.quantity > 1).length;
    return `
      <div class="country-section">
        <div class="country-header" onclick="toggleSection('${secName}')">
          <span class="country-flag">${sample.flag || '🌍'}</span>
          <span class="country-name">${sample.country}</span>
          <div class="country-badge">
            <span class="badge badge-green">${ownedCount}/${items.length}</span>
            ${dupCount > 0 ? `<span class="badge badge-orange">+${dupCount} rep</span>` : ''}
          </div>
          <span class="country-toggle">▼</span>
        </div>
        <div id="sec-${secName}" class="sticker-grid">
          ${items.map(renderStickerCard).join('')}
        </div>
      </div>`;
  }).join('');
}

function renderStickerCard(s) {
  const status = s.quantity === 0 ? 'missing' : s.quantity === 1 ? 'owned' : 'duplicate';
  return `
    <div class="sticker-card status-${status}" id="card-${s.id}" title="${s.description || s.code}">
      <div class="sticker-code">${s.code}</div>
      <div class="sticker-flag">${s.flag || ''}</div>
      <div class="sticker-type-badge type-${s.type}">${s.type}</div>
      <div class="sticker-qty-wrap">
        <button class="qty-btn" onclick="changeQty(${s.id}, -1, event)">−</button>
        <span class="qty-display" id="qty-${s.id}">${s.quantity}</span>
        <button class="qty-btn" onclick="changeQty(${s.id}, +1, event)">+</button>
      </div>
    </div>`;
}

function toggleSection(sec) {
  const grid = document.getElementById(`sec-${sec}`);
  const header = grid?.previousElementSibling;
  if (!grid) return;
  const hidden = grid.style.display === 'none';
  grid.style.display = hidden ? '' : 'none';
  header?.classList.toggle('collapsed', !hidden);
}

async function changeQty(stickerId, delta, event) {
  event?.stopPropagation();
  const item = state.collection.find(s => s.id === stickerId);
  if (!item) return;
  const newQty = Math.max(0, item.quantity + delta);
  item.quantity = newQty;

  const qtyEl = document.getElementById(`qty-${stickerId}`);
  const cardEl = document.getElementById(`card-${stickerId}`);
  if (qtyEl) qtyEl.textContent = newQty;
  if (cardEl) cardEl.className = `sticker-card status-${newQty === 0 ? 'missing' : newQty === 1 ? 'owned' : 'duplicate'}`;

  clearTimeout(state.stickerUpdateTimer[stickerId]);
  state.stickerUpdateTimer[stickerId] = setTimeout(async () => {
    const { error } = await sb.from('user_stickers').upsert(
      { user_id: state.user.id, sticker_id: stickerId, quantity: newQty },
      { onConflict: 'user_id,sticker_id' }
    );
    if (error) toast('Erro ao salvar: ' + error.message);
  }, 500);
}

// ─── Missing & Duplicates ─────────────────────────────────────────────────────
function renderMissing() {
  const content = document.getElementById('missing-content');
  const sec = document.getElementById('missing-section-filter')?.value || 'all';
  let stickers = state.collection.filter(s => s.quantity === 0);
  if (sec !== 'all') stickers = stickers.filter(s => s.section === sec);
  document.getElementById('missing-count').textContent = `${stickers.length} figurinha(s) faltando`;
  content.innerHTML = renderStickerGrouped(stickers, 'missing');
}

function renderDuplicates() {
  const content = document.getElementById('duplicates-content');
  const sec = document.getElementById('dup-section-filter')?.value || 'all';
  let stickers = state.collection.filter(s => s.quantity > 1);
  if (sec !== 'all') stickers = stickers.filter(s => s.section === sec);
  const totalDup = stickers.reduce((sum, s) => sum + (s.quantity - 1), 0);
  document.getElementById('dup-count').textContent = `${stickers.length} figurinha(s), ${totalDup} cópia(s) para troca`;
  content.innerHTML = renderStickerGrouped(stickers, 'duplicate');
}

function renderStickerGrouped(stickers, mode) {
  if (stickers.length === 0) {
    const msg = mode === 'missing' ? 'Parabéns! Você tem todas as figurinhas! 🎉' : 'Sem repetidas.';
    return `<div class="empty-state"><div class="empty-icon">${mode === 'missing' ? '🎉' : '✨'}</div><h3>${msg}</h3></div>`;
  }
  const sections = [...new Set(stickers.map(s => s.section))];
  return sections.map(secName => {
    const items = stickers.filter(s => s.section === secName);
    const sample = items[0];
    return `
      <div class="country-section">
        <div class="country-header">
          <span class="country-flag">${sample.flag || '🌍'}</span>
          <span class="country-name">${sample.country}</span>
          <span class="badge badge-gray">${items.length}</span>
        </div>
        <div class="sticker-grid">${items.map(renderStickerCard).join('')}</div>
      </div>`;
  }).join('');
}

// ─── Opportunities ────────────────────────────────────────────────────────────
async function loadOpportunities() {
  const content = document.getElementById('opportunities-content');
  content.innerHTML = '<div class="loading-spinner">Analisando trocas possíveis...</div>';
  try {
    const { data, error } = await sb.rpc('get_opportunities');
    if (error) throw error;
    const opps = (data || [])
      .map(r => ({
        user: { id: r.user_id, name: r.user_name, phone: r.user_phone },
        iOffer: r.i_offer || [],
        iReceive: r.i_receive || [],
      }))
      .filter(o => o.iOffer.length > 0 && o.iReceive.length > 0)
      .map(o => ({ ...o, score: Math.min(o.iOffer.length, o.iReceive.length) }))
      .sort((a, b) => b.score - a.score);
    state.opportunities = opps;
    renderOpportunities();
  } catch (e) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Erro</h3><p>${e.message}</p></div>`;
  }
}

function renderOpportunities() {
  const content = document.getElementById('opportunities-content');
  const opps = state.opportunities || [];
  if (opps.length === 0) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">🤝</div>
      <h3>Nenhuma troca possível agora</h3>
      <p>Adicione mais figurinhas repetidas. As trocas aparecem quando outros usuários precisam das suas e você precisa das deles.</p></div>`;
    return;
  }

  content.innerHTML = opps.map((opp, idx) => `
    <div class="opp-card">
      <div class="opp-header">
        <div class="avatar">${opp.user.name.substring(0, 2).toUpperCase()}</div>
        <div class="opp-user-info">
          <div class="opp-user-name">${opp.user.name}</div>
          <div class="opp-score">Você oferece ${opp.iOffer.length} • Recebe ${opp.iReceive.length} figurinha(s)</div>
        </div>
      </div>
      <div class="opp-stickers">
        <div class="opp-sticker-row">
          <div class="opp-sticker-label">📤 Você oferece (suas repetidas que ele precisa):</div>
          <div class="opp-sticker-list">
            ${opp.iOffer.slice(0, 15).map(s => `<span class="sticker-chip chip-give">${s.flag || ''} ${s.code}</span>`).join('')}
            ${opp.iOffer.length > 15 ? `<span class="sticker-chip chip-give">+${opp.iOffer.length - 15}</span>` : ''}
          </div>
        </div>
        <div class="opp-sticker-row" style="margin-top:8px">
          <div class="opp-sticker-label">📥 Você recebe (repetidas dele que você precisa):</div>
          <div class="opp-sticker-list">
            ${opp.iReceive.slice(0, 15).map(s => `<span class="sticker-chip chip-receive">${s.flag || ''} ${s.code}</span>`).join('')}
            ${opp.iReceive.length > 15 ? `<span class="sticker-chip chip-receive">+${opp.iReceive.length - 15}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="opp-actions">
        <button class="btn btn-primary btn-sm" onclick="openProposalModal(${idx})">📬 Propor Troca</button>
        ${opp.user.phone ? `<a class="btn btn-whatsapp btn-sm" href="https://wa.me/55${opp.user.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Olá ${opp.user.name}! Vi que podemos trocar figurinhas da Copa 2026. Combinamos?`)}" target="_blank">📲 WhatsApp</a>` : ''}
      </div>
    </div>`).join('');
}

function openProposalModal(idx) {
  const opp = state.opportunities[idx];
  const offerItems = opp.iOffer.slice(0, 10);
  const receiveItems = opp.iReceive.slice(0, 10);
  const body = `
    <p style="margin-bottom:12px;color:var(--text2)">Enviando proposta para <strong>${opp.user.name}</strong></p>
    <div class="opp-sticker-row" style="margin-bottom:12px">
      <div class="opp-sticker-label">📤 Você oferece:</div>
      <div class="opp-sticker-list" style="margin-top:6px">${offerItems.map(s => `<span class="sticker-chip chip-give">${s.flag || ''} ${s.code}</span>`).join('')}</div>
    </div>
    <div class="opp-sticker-row" style="margin-bottom:16px">
      <div class="opp-sticker-label">📥 Você recebe:</div>
      <div class="opp-sticker-list" style="margin-top:6px">${receiveItems.map(s => `<span class="sticker-chip chip-receive">${s.flag || ''} ${s.code}</span>`).join('')}</div>
    </div>
    <div class="form-group">
      <label>Mensagem (opcional)</label>
      <input type="text" id="proposal-msg" placeholder="Ex: Podemos trocar hoje?" style="width:100%">
    </div>`;
  const footer = `
    <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="sendProposal('${opp.user.id}', ${idx})">Enviar</button>`;
  openModal('Proposta de Troca', body, footer);
}

async function sendProposal(toUserId, idx) {
  const opp = state.opportunities[idx];
  const message = document.getElementById('proposal-msg')?.value || '';
  const offerItems = opp.iOffer.slice(0, 10);
  const receiveItems = opp.iReceive.slice(0, 10);

  try {
    const { data: existing } = await sb
      .from('trade_proposals')
      .select('id')
      .or(`and(from_user_id.eq.${state.user.id},to_user_id.eq.${toUserId}),and(from_user_id.eq.${toUserId},to_user_id.eq.${state.user.id})`)
      .eq('status', 'pendente')
      .limit(1);
    if (existing && existing.length) throw new Error('Já existe uma proposta pendente com este usuário');

    const { data: proposal, error: pErr } = await sb
      .from('trade_proposals')
      .insert({ from_user_id: state.user.id, to_user_id: toUserId, message })
      .select().single();
    if (pErr) throw pErr;

    const items = [
      ...offerItems.map(s => ({ trade_proposal_id: proposal.id, sticker_id: s.id, direction: 'give', quantity: 1 })),
      ...receiveItems.map(s => ({ trade_proposal_id: proposal.id, sticker_id: s.id, direction: 'receive', quantity: 1 })),
    ];
    const { error: iErr } = await sb.from('trade_items').insert(items);
    if (iErr) throw iErr;

    closeModal();
    toast('✅ Proposta enviada!');
    state.proposals = null;
  } catch (e) { toast('Erro: ' + e.message); }
}

// ─── Proposals ────────────────────────────────────────────────────────────────
async function loadProposals() {
  const content = document.getElementById('proposals-content');
  content.innerHTML = '<div class="loading-spinner">Carregando propostas...</div>';
  try {
    const { data, error } = await sb
      .from('trade_proposals')
      .select(`
        id, from_user_id, to_user_id, status, message, created_at, updated_at,
        from_user:profiles!trade_proposals_from_user_id_fkey (name, phone),
        to_user:profiles!trade_proposals_to_user_id_fkey (name, phone),
        items:trade_items (id, sticker_id, direction, quantity, sticker:stickers(code, country, flag, type))
      `)
      .or(`from_user_id.eq.${state.user.id},to_user_id.eq.${state.user.id}`)
      .order('updated_at', { ascending: false });
    if (error) throw error;

    state.proposals = (data || []).map(p => ({
      ...p,
      from_name: p.from_user?.name, from_phone: p.from_user?.phone,
      to_name: p.to_user?.name, to_phone: p.to_user?.phone,
      items: (p.items || []).map(i => ({
        ...i, code: i.sticker?.code, country: i.sticker?.country,
        flag: i.sticker?.flag, type: i.sticker?.type,
      })),
    }));
    renderProposals();
  } catch (e) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
  }
}

function setProposalTab(tab, btn) {
  state.proposalTab = tab;
  document.querySelectorAll('#view-proposals .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProposals();
}

function renderProposals() {
  const content = document.getElementById('proposals-content');
  if (!state.proposals) return;
  let proposals = state.proposals;
  const myId = state.user.id;
  if (state.proposalTab === 'received') proposals = proposals.filter(p => p.to_user_id === myId);
  if (state.proposalTab === 'sent')     proposals = proposals.filter(p => p.from_user_id === myId);

  if (proposals.length === 0) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">📬</div><h3>Nenhuma proposta</h3><p>Acesse "Trocas Possíveis" para enviar a primeira.</p></div>`;
    return;
  }

  content.innerHTML = proposals.map(p => {
    const iSent = p.from_user_id === myId;
    const other = iSent ? p.to_name : p.from_name;
    const otherPhone = iSent ? p.to_phone : p.from_phone;
    const giveItems    = p.items.filter(i => (iSent ? i.direction === 'give' : i.direction === 'receive'));
    const receiveItems = p.items.filter(i => (iSent ? i.direction === 'receive' : i.direction === 'give'));

    const actions = [];
    if (p.status === 'pendente' && !iSent) {
      actions.push(`<button class="btn btn-success btn-sm" onclick="updateProposal(${p.id}, 'aceita')">✅ Aceitar</button>`);
      actions.push(`<button class="btn btn-outline btn-sm" onclick="updateProposal(${p.id}, 'recusada')">❌ Recusar</button>`);
    }
    if (p.status === 'aceita' && iSent) {
      actions.push(`<button class="btn btn-primary btn-sm" onclick="updateProposal(${p.id}, 'concluída')">🏁 Marcar Concluída</button>`);
    }
    if (p.status === 'pendente' && iSent) {
      actions.push(`<button class="btn btn-outline btn-sm" onclick="updateProposal(${p.id}, 'cancelada')">🗑️ Cancelar</button>`);
    }
    if (otherPhone && ['pendente','aceita'].includes(p.status)) {
      actions.push(`<a class="btn btn-whatsapp btn-sm" href="https://wa.me/55${otherPhone.replace(/\D/g,'')}?text=${encodeURIComponent(`Oi ${other}! Sobre nossa troca de figurinhas Copa 2026...`)}" target="_blank">📲 WhatsApp</a>`);
    }

    return `
      <div class="proposal-card">
        <div class="proposal-header">
          <div class="proposal-users">${iSent ? `Você → <strong>${other}</strong>` : `<strong>${other}</strong> → Você`}</div>
          <span class="status-badge status-${p.status}">${p.status}</span>
        </div>
        ${p.message ? `<div class="proposal-message">"${p.message}"</div>` : ''}
        <div class="proposal-date">📅 ${new Date(p.updated_at).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</div>
        <div class="proposal-items">
          <div class="proposal-section">
            <div class="proposal-section-label">📤 ${iSent ? 'Você oferece' : `${other} oferece`}:</div>
            <div class="proposal-chips">${giveItems.map(i => `<span class="sticker-chip chip-give">${i.flag || ''} ${i.code}</span>`).join('') || '<span style="color:var(--text2);font-size:0.8rem">—</span>'}</div>
          </div>
          <div class="proposal-section" style="margin-top:8px">
            <div class="proposal-section-label">📥 ${iSent ? 'Você recebe' : `${other} recebe`}:</div>
            <div class="proposal-chips">${receiveItems.map(i => `<span class="sticker-chip chip-receive">${i.flag || ''} ${i.code}</span>`).join('') || '<span style="color:var(--text2);font-size:0.8rem">—</span>'}</div>
          </div>
        </div>
        ${actions.length ? `<div class="proposal-actions">${actions.join('')}</div>` : ''}
      </div>`;
  }).join('');
}

async function updateProposal(id, status) {
  const labels = { aceita: 'aceitar', recusada: 'recusar', concluída: 'marcar como concluída', cancelada: 'cancelar' };
  if (!confirm(`Deseja ${labels[status]} esta proposta?`)) return;
  try {
    if (status === 'concluída') {
      const { error } = await sb.rpc('complete_trade', { proposal_id: id });
      if (error) throw error;
      await loadCollection();
      state.opportunities = null;
    } else {
      const { error } = await sb
        .from('trade_proposals')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    }
    toast(`✅ Proposta ${status}!`);
    state.proposals = null;
    await loadProposals();
  } catch (e) { toast('Erro: ' + e.message); }
}

// ─── Profile ──────────────────────────────────────────────────────────────────
function renderProfile() {
  document.getElementById('prof-name').value = state.user.name || '';
  document.getElementById('prof-email').value = state.user.email || '';
  document.getElementById('prof-phone').value = state.user.phone || '';
  document.getElementById('prof-current-pass').value = '';
  document.getElementById('prof-new-pass').value = '';
  document.getElementById('prof-error').classList.add('hidden');
  document.getElementById('prof-success').classList.add('hidden');
}

async function saveProfile(event) {
  event.preventDefault();
  const name = document.getElementById('prof-name').value.trim();
  const phone = document.getElementById('prof-phone').value.trim();
  const password = document.getElementById('prof-current-pass').value;
  const newPassword = document.getElementById('prof-new-pass').value;
  const errEl = document.getElementById('prof-error');
  const sucEl = document.getElementById('prof-success');
  errEl.classList.add('hidden'); sucEl.classList.add('hidden');

  try {
    const { error } = await sb.from('profiles').update({ name, phone }).eq('id', state.user.id);
    if (error) throw error;

    if (password && newPassword) {
      const { error: signErr } = await sb.auth.signInWithPassword({ email: state.user.email, password });
      if (signErr) throw new Error('Senha atual incorreta');
      const { error: updErr } = await sb.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;
    }

    state.user = { ...state.user, name, phone };
    document.getElementById('sidebar-name').textContent = name;
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    ['topbar-avatar','sidebar-avatar','profile-avatar'].forEach(id => {
      document.getElementById(id).textContent = initials;
    });
    sucEl.textContent = '✅ Perfil atualizado!';
    sucEl.classList.remove('hidden');
    document.getElementById('prof-current-pass').value = '';
    document.getElementById('prof-new-pass').value = '';
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove('hidden');
  }
}

// ─── Admin ────────────────────────────────────────────────────────────────────
async function loadAdmin() {
  setAdminTab(state.adminTab || 'stats', document.querySelector('.admin-tabs .tab-btn'));
}
function setAdminTab(tab, btn) {
  state.adminTab = tab;
  document.querySelectorAll('.admin-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAdminTab(tab);
}

async function renderAdminTab(tab) {
  const content = document.getElementById('admin-content');
  content.innerHTML = '<div class="loading-spinner">Carregando...</div>';
  try {
    if (tab === 'stats') {
      const [u, s, t, pend] = await Promise.all([
        sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'user'),
        sb.from('stickers').select('*', { count: 'exact', head: true }),
        sb.from('trade_proposals').select('*', { count: 'exact', head: true }).eq('status', 'concluída'),
        sb.from('trade_proposals').select('*', { count: 'exact', head: true }).eq('status', 'pendente'),
      ]);
      content.innerHTML = `
        <div class="admin-stat-grid">
          <div class="admin-stat-card"><div class="admin-stat-num">${u.count || 0}</div><div class="admin-stat-label">Usuários</div></div>
          <div class="admin-stat-card"><div class="admin-stat-num">${s.count || 0}</div><div class="admin-stat-label">Figurinhas</div></div>
          <div class="admin-stat-card"><div class="admin-stat-num">${t.count || 0}</div><div class="admin-stat-label">Trocas Concluídas</div></div>
          <div class="admin-stat-card"><div class="admin-stat-num">${pend.count || 0}</div><div class="admin-stat-label">Pendentes</div></div>
        </div>`;
    } else if (tab === 'users') {
      const { data: users, error } = await sb.from('profiles').select('id, name, phone, role, created_at').order('created_at', { ascending: false });
      if (error) throw error;
      content.innerHTML = `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>WhatsApp</th><th>Função</th><th>Cadastro</th></tr></thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td><strong>${u.name}</strong></td>
                  <td>${u.phone || '—'}</td>
                  <td><span class="badge ${u.role === 'admin' ? 'badge-orange' : 'badge-gray'}">${u.role}</span></td>
                  <td>${new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    } else if (tab === 'stickers') {
      content.innerHTML = `
        <div class="admin-form">
          <h3>➕ Adicionar Figurinha</h3>
          <div class="admin-form-grid">
            <div class="form-group"><label>Código</label><input type="text" id="adm-code" placeholder="BRA21"></div>
            <div class="form-group"><label>Seção</label><input type="text" id="adm-section" placeholder="BRA"></div>
            <div class="form-group"><label>País</label><input type="text" id="adm-country" placeholder="Brasil"></div>
            <div class="form-group"><label>Número</label><input type="number" id="adm-number" placeholder="21"></div>
            <div class="form-group"><label>Tipo</label><select id="adm-type"><option value="comum">Comum</option><option value="escudo">Escudo</option><option value="brilhante">Brilhante</option><option value="especial">Especial</option></select></div>
            <div class="form-group"><label>Flag</label><input type="text" id="adm-flag" placeholder="🇧🇷"></div>
            <div class="form-group col-full"><label>Descrição</label><input type="text" id="adm-desc" placeholder="Descrição"></div>
          </div>
          <button class="btn btn-primary" onclick="adminAddSticker()">Adicionar</button>
        </div>
        <p style="color:var(--text2);font-size:0.85rem;margin-bottom:12px">Total: <strong id="adm-total">—</strong> figurinhas</p>
        <div id="adm-sticker-list"><div class="loading-spinner">Carregando...</div></div>`;
      loadAdminStickers();
    }
  } catch (e) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>${e.message}</h3></div>`;
  }
}

async function loadAdminStickers() {
  const { data, error } = await sb.from('stickers').select('*').order('id');
  if (error) { toast('Erro: ' + error.message); return; }
  document.getElementById('adm-total').textContent = data.length;
  document.getElementById('adm-sticker-list').innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Código</th><th>País</th><th>Seção</th><th>Tipo</th><th>Ações</th></tr></thead>
        <tbody>
          ${data.slice(0, 200).map(s => `
            <tr>
              <td><strong>${s.flag || ''} ${s.code}</strong></td>
              <td>${s.country}</td>
              <td>${s.section}</td>
              <td><span class="sticker-type-badge type-${s.type}">${s.type}</span></td>
              <td><button class="btn btn-danger btn-xs" onclick="adminDeleteSticker(${s.id}, '${s.code}')">Remover</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      ${data.length > 200 ? `<p style="text-align:center;padding:12px;color:var(--text2);font-size:0.85rem">Mostrando 200 de ${data.length}</p>` : ''}
    </div>`;
}

async function adminAddSticker() {
  const sticker = {
    code: document.getElementById('adm-code').value.trim().toUpperCase(),
    section: document.getElementById('adm-section').value.trim().toUpperCase(),
    country: document.getElementById('adm-country').value.trim(),
    number: parseInt(document.getElementById('adm-number').value) || 0,
    type: document.getElementById('adm-type').value,
    flag: document.getElementById('adm-flag').value.trim(),
    description: document.getElementById('adm-desc').value.trim(),
  };
  if (!sticker.code || !sticker.section || !sticker.country) { toast('Preencha código, seção e país'); return; }
  const { error } = await sb.from('stickers').insert(sticker);
  if (error) { toast('Erro: ' + error.message); return; }
  toast('✅ Figurinha adicionada!');
  ['adm-code','adm-section','adm-country','adm-number','adm-flag','adm-desc'].forEach(id => document.getElementById(id).value = '');
  loadAdminStickers();
}

async function adminDeleteSticker(id, code) {
  if (!confirm(`Remover ${code}?`)) return;
  const { error } = await sb.from('stickers').delete().eq('id', id);
  if (error) { toast('Erro: ' + error.message); return; }
  toast(`✅ ${code} removida`);
  loadAdminStickers();
}

// ─── Atalhos ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.getElementById('login-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('reg-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });

// ─── Boot ─────────────────────────────────────────────────────────────────────
(async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    try { await initApp(); return; }
    catch { await sb.auth.signOut(); }
  }
  document.getElementById('auth-screen').classList.remove('hidden');
})();

sb.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
  }
});
