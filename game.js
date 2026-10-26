import { randomInt, randomUUID } from 'node:crypto';

export const colors = ['red', 'yellow', 'green', 'blue'];
export function deck() {
  const cards = [];
  const add = (color, value) => cards.push({ id: randomUUID(), color, value });
  for (const color of colors) {
    add(color, '0');
    for (const value of ['1','2','3','4','5','6','7','8','9','skip','reverse','draw2']) {
      add(color, value); add(color, value);
    }
  }
  for (let i = 0; i < 4; i++) { add('wild', 'wild'); add('wild', 'draw4'); }
  return shuffle(cards);
}
export function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomInt(i + 1); [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
export function start(room, playerId) {
  if (room.host !== playerId) throw Error('Kun værten kan starte spillet.');
  if (room.status === 'playing') throw Error('Spillet er allerede i gang.');
  if (room.players.length < 2 || room.players.length > 6) throw Error('Der skal være 2–6 spillere.');
  room.draw = deck();
  for (const p of room.players) p.hand = room.draw.splice(0, 7);
  // Start with a number card so the first turn has no implicit action.
  const first = room.draw.findIndex(c => /^\d$/.test(c.value));
  room.discard = [room.draw.splice(first, 1)[0]];
  room.color = room.discard[0].color;
  room.turn = randomInt(room.players.length); room.direction = 1;
  room.status = 'playing'; room.winner = null; room.drawn = null;
  room.message = `${room.players[room.turn].name} starter. God fornøjelse!`;
}
function next(room, steps = 1) {
  room.turn = (room.turn + room.direction * steps + room.players.length * 4) % room.players.length;
  room.drawn = null;
}
function take(room, player, amount) {
  const taken = [];
  for (let i = 0; i < amount; i++) {
    if (!room.draw.length && room.discard.length > 1) {
      const top = room.discard.pop(); room.draw = shuffle(room.discard); room.discard = [top];
    }
    if (room.draw.length) { const card = room.draw.pop(); player.hand.push(card); taken.push(card); }
  }
  return taken;
}
export function canPlay(room, player, card) {
  const top = room.discard.at(-1);
  if (card.value === 'draw4') return !player.hand.some(c => c.color === room.color);
  return card.color === 'wild' || card.color === room.color || card.value === top.value;
}
export function act(room, playerId, action) {
  if (room.status !== 'playing') throw Error('Spillet er ikke i gang.');
  const player = room.players[room.turn];
  if (player.id !== playerId) throw Error('Vent, til det er din tur.');
  if (action.type === 'draw') {
    if (room.drawn) throw Error('Du har allerede trukket et kort.');
    const cards = take(room, player, 1);
    if (cards.length && canPlay(room, player, cards[0])) {
      room.drawn = cards[0].id; room.message = `${player.name} trak et kort og kan spille det eller passe.`;
    } else { next(room); room.message = `${player.name} trak et kort. Turen går videre.`; }
    return;
  }
  if (action.type === 'pass') {
    if (!room.drawn) throw Error('Du skal trække et kort, før du kan passe.');
    next(room); room.message = `${player.name} passer.`; return;
  }
  if (action.type !== 'play') throw Error('Ukendt handling.');
  const index = player.hand.findIndex(c => c.id === action.cardId);
  if (index < 0) throw Error('Kortet findes ikke på din hånd.');
  const card = player.hand[index];
  if (room.drawn && room.drawn !== card.id) throw Error('Du kan kun spille det kort, du lige trak.');
  if (!canPlay(room, player, card)) throw Error('Kortet passer ikke. +4 kræver, at du ikke har den aktuelle farve.');
  if (card.color === 'wild' && !colors.includes(action.color)) throw Error('Vælg en farve.');
  player.hand.splice(index, 1); room.discard.push(card);
  room.color = card.color === 'wild' ? action.color : card.color;
  let steps = 1;
  if (card.value === 'reverse') { room.direction *= -1; if (room.players.length === 2) steps = 2; }
  if (card.value === 'skip') steps = 2;
  if (card.value === 'draw2' || card.value === 'draw4') {
    const target = room.players[(room.turn + room.direction + room.players.length) % room.players.length];
    take(room, target, card.value === 'draw2' ? 2 : 4); steps = 2;
  }
  room.message = `${player.name} spillede et kort.${player.hand.length === 1 ? ' UNO!' : ''}`;
  if (!player.hand.length) {
    room.status = 'finished'; room.winner = player.name; room.drawn = null;
    room.message = `${player.name} har vundet! 🎉`; return;
  }
  next(room, steps);
}
export function view(room, id) {
  const me = room.players.find(p => p.id === id);
  return {
    code: room.code, status: room.status, host: room.host === id,
    players: room.players.map((p, i) => ({ name: p.name, count: p.hand.length, me: p.id === id, host: p.id === room.host, turn: room.status === 'playing' && i === room.turn })),
    hand: me?.hand ?? [], top: room.discard?.at(-1), color: room.color,
    myTurn: room.status === 'playing' && room.players[room.turn]?.id === id,
    drawn: room.drawn, winner: room.winner, message: room.message,
    playable: room.status === 'playing' && room.players[room.turn]?.id === id
      ? me.hand.filter(c => (!room.drawn || c.id === room.drawn) && canPlay(room, me, c)).map(c => c.id) : []
  };
}
