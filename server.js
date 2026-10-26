import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { start, act, view } from './game.js';

const sessions = new Map(), rooms = new Map(), streams = new Map(), attempts = new Map();
const password = process.env.GAME_PASSWORD || 'FjordskolenKruså';
const files = { '/': ['index.html','text/html; charset=utf-8'], '/app.js': ['app.js','text/javascript; charset=utf-8'], '/style.css': ['style.css','text/css; charset=utf-8'] };
function send(res, status, body) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'}); res.end(JSON.stringify(body)); }
function publish(room) {
  for (const p of room.players) for (const stream of streams.get(p.id) || []) stream.write(`data: ${JSON.stringify(view(room, p.id))}\n\n`);
}
async function body(req) {
  let value = ''; for await (const chunk of req) { value += chunk; if (value.length > 4096) throw Error('Forespørgslen er for stor.'); }
  try { return JSON.parse(value || '{}'); } catch { throw Error('Ugyldige data.'); }
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  const path = new URL(req.url, 'http://localhost').pathname;
  try {
    if (req.method === 'GET' && files[path]) {
      const [file, type] = files[path]; res.writeHead(200, {'Content-Type':type}); res.end(await readFile(new URL(`public/${file}`, import.meta.url))); return;
    }
    if (path === '/health') return send(res, 200, {ok:true});
    const token = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('uno_session='))?.slice(12);
    let session = sessions.get(token);
    if (req.method === 'POST' && path === '/api/login') {
      const key = req.socket.remoteAddress;
      const rate = attempts.get(key) || {count:0, until:Date.now()+60000};
      if (rate.until < Date.now()) { rate.count = 0; rate.until = Date.now()+60000; }
      attempts.set(key, rate);
      if (++rate.count > 30) return send(res,429,{error:'For mange forsøg. Vent et minut.'});
      const data = await body(req);
      const given = Buffer.from(String(data.password ?? '')), expected = Buffer.from(password);
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return send(res,401,{error:'Forkert adgangskode.'});
      const name = String(data.name || '').trim().slice(0,24);
      if (!name) throw Error('Skriv dit navn.');
      if (!session) {
        const token = randomBytes(32).toString('hex'); session = {id:randomUUID(),name,room:null}; sessions.set(token,session);
        res.setHeader('Set-Cookie',`uno_session=${token}; HttpOnly; SameSite=Strict; Path=/${process.env.COOKIE_SECURE === '1' ? '; Secure' : ''}`);
      } else if (!session.room) session.name = name;
      return send(res,200,{name:session.name});
    }
    if (!session) return send(res,401,{error:'Log ind for at spille.'});
    if (req.method === 'GET' && path === '/api/me') return send(res,200,{name:session.name,room:session.room ? view(rooms.get(session.room),session.id) : null});
    if (req.method === 'GET' && path === '/api/events') {
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});
      res.write(': connected\n\n');
      if (!streams.has(session.id)) streams.set(session.id,new Set()); streams.get(session.id).add(res);
      if (session.room) res.write(`data: ${JSON.stringify(view(rooms.get(session.room),session.id))}\n\n`);
      const timer = setInterval(() => res.write(': heartbeat\n\n'),20000);
      req.on('close',() => { clearInterval(timer); streams.get(session.id)?.delete(res); }); return;
    }
    if (req.method !== 'POST') return send(res,404,{error:'Siden findes ikke.'});
    if (req.headers.origin && req.headers.origin !== `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`) return send(res,403,{error:'Ugyldig oprindelse.'});
    const data = await body(req);
    if (path === '/api/create' || path === '/api/join') {
      if (session.room) throw Error('Du er allerede i et rum.');
      let room;
      if (path === '/api/create') {
        let code; do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
        room = {code,host:session.id,players:[],status:'waiting',message:'Del rumkoden, og vent på dine venner.'}; rooms.set(code,room);
      } else {
        room = rooms.get(String(data.code || '').trim().toUpperCase());
        if (!room) throw Error('Rumkoden findes ikke.');
        if (room.status !== 'waiting') throw Error('Spillet er allerede startet.');
        if (room.players.length >= 6) throw Error('Rummet er fuldt (maks. 6 spillere).');
        if (room.players.some(p => p.name.toLocaleLowerCase() === session.name.toLocaleLowerCase())) throw Error('Navnet er allerede i brug i dette rum.');
      }
      room.players.push({id:session.id,name:session.name,hand:[]}); session.room = room.code; publish(room); return send(res,200,view(room,session.id));
    }
    const room = rooms.get(session.room);
    if (!room) throw Error('Deltag først i et rum.');
    if (path === '/api/leave') {
      if (room.status === 'playing') {
        room.status = 'finished'; room.winner = null; room.message = `${session.name} forlod rummet. Værten kan starte et nyt spil.`;
      }
      room.players = room.players.filter(p => p.id !== session.id); session.room = null;
      if (!room.players.length) rooms.delete(room.code);
      else { if (room.host === session.id) room.host = room.players[0].id; publish(room); }
      return send(res,200,{ok:true});
    }
    if (path === '/api/start') start(room,session.id);
    else if (path === '/api/action') act(room,session.id,data);
    else return send(res,404,{error:'Ukendt handling.'});
    publish(room); send(res,200,view(room,session.id));
  } catch (error) { send(res,400,{error:error.message}); }
});
server.listen(Number(process.env.PORT || 3000),'0.0.0.0', () => {
  const port = server.address().port;
  console.log(`\nFJORD UNO — denne pc er vært\n\nPå denne pc: http://localhost:${port}`);
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const address of interfaces || []) {
      if (address.family === 'IPv4' && !address.internal) console.log(`Andre på samme netværk: http://${address.address}:${port}`);
    }
  }
  console.log('\nAdgangskoden er den fælles kode. Opret et rum, og del rumkoden.\nHold dette vindue åbent, mens I spiller. Stop med Ctrl+C.\nHvis andre ikke kan forbinde: tillad Node.js på det private netværk i firewallen.\nGæste-/skole-Wi-Fi kan blokere forbindelser mellem pc’er.\n');
});
