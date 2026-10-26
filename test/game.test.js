import test from 'node:test';
import assert from 'node:assert/strict';
import {deck,start,act,view,canPlay} from '../game.js';
const make = n => ({host:'0',players:Array.from({length:n},(_,i)=>({id:String(i),name:`Spiller ${i}`,hand:[]})),status:'waiting'});
test('108 unique cards and seven per player for 2–6 players',()=>{
  assert.equal(deck().length,108); assert.equal(new Set(deck().map(c=>c.id)).size,108);
  for(let n=2;n<=6;n++){const r=make(n);start(r,'0');assert.ok(r.players.every(p=>p.hand.length===7));assert.equal(r.draw.length+n*7+r.discard.length,108);assert.match(r.discard[0].value,/^\d$/);}
});
test('host and minimum player count enforced',()=>{assert.throws(()=>start(make(1),'0'));assert.throws(()=>start(make(2),'1'));});
test('private views never reveal other hands or draw pile',()=>{const r=make(3);start(r,'0');const v=view(r,'0');assert.equal(v.hand.length,7);assert.ok(v.players.every(p=>!('hand'in p)));assert.ok(!('draw'in v));});
test('wrong turns and invalid cards rejected',()=>{const r=make(2);start(r,'0');assert.throws(()=>act(r,String(1-r.turn),{type:'draw'}));assert.throws(()=>act(r,String(r.turn),{type:'play',cardId:'fake'}));});
function fixed(value='5'){const r=make(3);Object.assign(r,{status:'playing',turn:0,direction:1,color:'red',drawn:null,discard:[{id:'top',color:'red',value:'9'}],draw:deck()});r.players[0].hand=[{id:'play',color:'red',value},{id:'keep',color:'blue',value:'7'}];return r;}
test('skip, reverse and draw penalties affect correct player',()=>{for(const [value,turn]of[['skip',2],['reverse',2],['draw2',2]]){const r=fixed(value);act(r,'0',{type:'play',cardId:'play'});assert.equal(r.turn,turn);if(value==='draw2')assert.equal(r.players[1].hand.length,2);}});
test('wild +4 prohibited when matching color exists',()=>{const r=fixed();const p=r.players[0];assert.equal(canPlay(r,p,{color:'wild',value:'draw4'}),false);p.hand=[{id:'w',color:'wild',value:'draw4'},{id:'b',color:'blue',value:'1'}];act(r,'0',{type:'play',cardId:'w',color:'green'});assert.equal(r.color,'green');assert.equal(r.players[1].hand.length,4);});
test('empty hand wins and game can restart',()=>{const r=fixed();r.players[0].hand.pop();act(r,'0',{type:'play',cardId:'play'});assert.equal(r.status,'finished');assert.equal(r.winner,'Spiller 0');start(r,'0');assert.equal(r.status,'playing');});
test('full games preserve cards and terminate',()=>{for(let size=2;size<=6;size++){const r=make(size);start(r,'0');let turns=0;while(r.status==='playing'&&turns++<20000){const p=r.players[r.turn];const v=view(r,p.id);if(v.playable.length)act(r,p.id,{type:'play',cardId:v.playable[0],color:'red'});else act(r,p.id,{type:r.drawn?'pass':'draw'});assert.equal(r.draw.length+r.discard.length+r.players.reduce((n,p)=>n+p.hand.length,0),108);}assert.equal(r.status,'finished');}});
