const $ = id => document.getElementById(id);
const names = {red:'Rød',yellow:'Gul',green:'Grøn',blue:'Blå',wild:'Valgfri'};
const symbols = {skip:'⊘',reverse:'↻',draw2:'+2',draw4:'+4',wild:'★'};
let state, events, pending, busy = false, toastTimer;
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true,4500); }
async function api(path, data) {
  const response = await fetch('/api/'+path, data === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const result = await response.json(); if (!response.ok) throw Error(result.error); return result;
}
async function perform(fn) { if (busy) return; busy = true; try { await fn(); } catch(e) { toast(e.message); } finally { busy = false; } }
function connect() {
  events?.close(); events = new EventSource('/api/events');
  events.onmessage = event => render(JSON.parse(event.data));
  events.onopen = () => $('connection').textContent = '● Forbundet · Online';
  events.onerror = () => $('connection').textContent = '◌ Genopretter forbindelse…';
}
function lobby(name) {
  $('welcome').hidden = false; $('game').hidden = true; $('login-panel').hidden = true; $('lobby-panel').hidden = false;
  $('greeting').textContent = `Hej, ${name}!`; connect();
}
function cardElement(card, interactive = false) {
  const el = document.createElement(interactive ? 'button' : 'div');
  el.className = `card ${card.color}`;
  const symbol = symbols[card.value] || card.value;
  const label = `${names[card.color]} ${symbol}`; el.setAttribute('aria-label', label);
  for (const cls of ['corner','face','corner bottom']) { const span = document.createElement('span'); span.className = cls; span.textContent = symbol; el.append(span); }
  const color = document.createElement('small'); color.textContent = names[card.color]; el.append(color);
  if (interactive) {
    el.disabled = !state.playable.includes(card.id);
    el.addEventListener('click',() => {
      if (card.color === 'wild') { pending = card.id; $('color-dialog').showModal(); }
      else play(card.id);
    });
  }
  return el;
}
function render(room) {
  state = room; $('welcome').hidden = true; $('game').hidden = false;
  $('copy-code').textContent = room.code;
  $('players').replaceChildren(...room.players.map((p,i) => {
    const el = document.createElement('div'); el.className = `player${p.turn ? ' active' : ''}${p.me ? ' self' : ''}`;
    const avatar = document.createElement('span'); avatar.className = 'avatar'; avatar.textContent = p.name[0].toUpperCase();
    const info = document.createElement('div'); const name = document.createElement('strong'); name.textContent = p.name + (p.me ? ' (dig)' : '');
    const detail = document.createElement('small'); detail.textContent = `${p.host ? 'Vært · ' : ''}${room.status === 'waiting' ? 'Klar til spil' : p.count === 1 ? 'UNO! · 1 kort' : p.count+' kort'}`;
    info.append(name,detail); el.append(avatar,info);
    if (p.turn) { const mark = document.createElement('span'); mark.className = 'turn-dot'; mark.textContent = '●'; el.append(mark); } return el;
  }));
  const waiting = room.status === 'waiting', playing = room.status === 'playing';
  $('waiting').hidden = !waiting; $('cards-area').hidden = waiting; $('hand-section').hidden = waiting;
  $('start').hidden = !room.host || playing; $('start').disabled = room.players.length < 2;
  $('start').textContent = waiting ? `Start spillet (${room.players.length}/6) →` : 'Spil igen →';
  $('actions').hidden = !playing; $('draw').disabled = !room.myTurn || !!room.drawn;
  $('draw-pile').disabled = !room.myTurn || !!room.drawn || !playing;
  $('pass').hidden = !room.myTurn || !room.drawn;
  $('message').textContent = room.message;
  $('turn-label').textContent = waiting ? 'VENTEVÆRELSE · 2–6 SPILLERE' : playing ? room.myTurn ? '✦ DET ER DIN TUR' : `${room.players.find(p => p.turn)?.name} spiller` : 'SPILLET ER SLUT';
  $('color-label').textContent = room.color ? `Aktuel farve: ${names[room.color]}` : '';
  $('discard').replaceChildren(...(room.top ? [cardElement(room.top)] : []));
  $('hand').replaceChildren(...room.hand.map(card => cardElement(card,true)));
  $('hand-count').textContent = `(${room.hand.length})`;
  $('hand-hint').textContent = !playing ? 'Klar til en runde mere?' : room.myTurn ? room.drawn ? 'Spil det trukne kort, eller pas' : 'De fremhævede kort kan spilles' : 'Vent på din tur';
  if (!room.myTurn && $('color-dialog').open) $('color-dialog').close();
}
async function play(cardId,color) { await perform(async () => render(await api('action',{type:'play',cardId,color}))); }
$('login-form').addEventListener('submit',event => { event.preventDefault(); perform(async () => { const me = await api('login',{name:$('name').value,password:$('password').value}); $('password').value = ''; lobby(me.name); const current = await api('me'); if (current.room) render(current.room); }); });
$('create').onclick = () => perform(async () => render(await api('create',{})));
$('join-form').onsubmit = event => { event.preventDefault(); perform(async () => render(await api('join',{code:$('code').value}))); };
$('start').onclick = () => perform(async () => render(await api('start',{})));
for (const id of ['draw','draw-pile']) $(id).onclick = () => perform(async () => render(await api('action',{type:'draw'})));
$('pass').onclick = () => perform(async () => render(await api('action',{type:'pass'})));
$('leave').onclick = () => perform(async () => { await api('leave',{}); state = null; const me = await api('me'); lobby(me.name); });
$('copy-code').onclick = async () => { try { await navigator.clipboard.writeText(state.code); toast('Rumkoden er kopieret!'); } catch { toast(`Din rumkode er ${state.code}`); } };
document.querySelectorAll('[data-color]').forEach(button => button.onclick = () => { $('color-dialog').close(); play(pending,button.dataset.color); });
$('cancel-color').onclick = () => $('color-dialog').close();
api('me').then(me => { lobby(me.name); if (me.room) render(me.room); }).catch(() => {});
