'use strict';
// engine/battle.js: Build 1b battle core with placeholders. Rules and state only; drawing and taps are in battle-draw.js.
// Two grey party members (ATTACK, SPECIAL once per fight, BAG, GUARD), one grey monster, one boss with a shield.
// Turn order: each living party member picks a command in turn, then the enemy acts. No randomness, so a fight can be replayed.
// Level-up and difficulty are in place. Second-layer rules sit behind SECOND_LAYER switches, all off in this build.
// Names, numbers and rules are placeholders until intake round 2 (battle rules).

const PARTY_START={hp:30,atk:7,def:1};
const LEVEL_UP={hp:5,atk:1};
const BAG_HEAL=12;
const BAG_START=2;
const MSG_TIME=0.8;                                     // seconds each message stays up before the next one
const DIFFICULTY=[
  {label:'EASY',enemyDmg:0.5},
  {label:'NORMAL',enemyDmg:1},
  {label:'HARD',enemyDmg:1.5}
];
const SECOND_LAYER={weakness:false,statusEffects:false,combos:false};   // all off until intake round 2
const ENEMY_TYPES={
  monster:{name:'MONSTER',hp:20,atk:4,def:0,shield:0,xp:10,boss:false},
  boss:{name:'BOSS',hp:36,atk:6,def:1,shield:2,xp:30,boss:true}
};
const COMMAND_KEYS={up:'special',left:'bag',right:'guard',down:'attack'};

let BATTLE=null;                                        // null outside a fight
let lastResult=null;                                    // 'win' or 'lose' after the last fight (debug handle reads it)

function makeParty() {
  return [1,2].map(n=>({
    name:'GREY '+n, lv:1, xp:0,
    hp:PARTY_START.hp, maxHp:PARTY_START.hp, atk:PARTY_START.atk, def:PARTY_START.def,
    specialUsed:false, guard:false
  }));
}
function levelCost(lv) { return lv*12; }
function aliveParty() { return game.party.filter(m=>m.hp>0); }
function nextActor(from) {
  for(let i=from;i<game.party.length;i++) if(game.party[i].hp>0) return i;
  return -1;
}

// Starts a fight. kind is a key of ENEMY_TYPES. opts (used by the debug handle and by smoke tests):
// ref: the field monster record to remove on a win; enemyHp, enemyAtk: overrides; partyHp: caps current party HP.
function startBattle(kind,opts) {
  opts=opts||{};
  const t=ENEMY_TYPES[kind];
  if(!t||game.mode!=='play') return false;
  const enemy={
    name:t.name, hp:opts.enemyHp||t.hp, maxHp:t.hp, atk:opts.enemyAtk||t.atk, def:t.def,
    shield:t.shield, xp:t.xp, boss:t.boss
  };
  game.party.forEach(m=>{
    m.specialUsed=false; m.guard=false;
    if(opts.partyHp) m.hp=Math.min(m.maxHp,opts.partyHp);
  });
  BATTLE={enemy, ref:opts.ref||null, phase:'busy', actor:0, acting:0, cursor:'attack', queue:[], qt:0, n:0, heard:-1, then:null, result:null, turn:1};
  musicFor(enemy.boss&&AUDIO.music.use.boss?'boss':'battle');
  game.mode='battle';
  game.path=null;
  say(enemy.name+' appears.');
  after(()=>openMenu(nextActor(0)));
  return true;
}

function say(text) { BATTLE.queue.push(text); }
function nextMsg() { BATTLE.queue.shift(); BATTLE.qt=0; BATTLE.n++; }
function after(fn) { BATTLE.then=fn; }

function openMenu(i) {
  BATTLE.phase='menu';
  BATTLE.actor=i;
  BATTLE.acting=i;
  BATTLE.cursor='attack';
}

// One hit on the enemy. mult 1 is an attack, 2 is a special.
function hit(m,mult) {
  const e=BATTLE.enemy;
  let dmg=Math.max(1,m.atk*mult-e.def);
  if(SECOND_LAYER.weakness&&mult>1&&e.weakTo==='special') dmg=Math.round(dmg*1.5);
  if(e.shield>0) {
    e.shield--;
    say('The shield takes the hit. '+(e.shield>0?e.shield+' left.':'Shield down.'));
    return;
  }
  e.hp=Math.max(0,e.hp-dmg);
  say(e.name+' takes '+dmg+'.');
  if(e.hp<=0) say(e.name+' is down.');
}

// Runs the command picked by the party member whose menu is open.
function chooseCommand(cmd) {
  if(!BATTLE||BATTLE.phase!=='menu') return;
  const m=game.party[BATTLE.actor];
  if(cmd==='special'&&m.specialUsed) { toast('Special is used up for this fight.'); return; }
  if(cmd==='bag'&&game.bag<=0) { toast('The bag is empty.'); return; }
  BATTLE.phase='busy';
  BATTLE.cursor=cmd;
  if(cmd==='attack') { say(m.name+' attacks.'); hit(m,1); }
  else if(cmd==='special') { m.specialUsed=true; say(m.name+' uses SPECIAL.'); hit(m,2); }
  else if(cmd==='bag') {
    game.bag--;
    const low=aliveParty().reduce((a,b)=>(b.hp<a.hp?b:a));
    low.hp=Math.min(low.maxHp,low.hp+BAG_HEAL);
    say('ITEM heals '+low.name+' for '+BAG_HEAL+'.');
  }
  else if(cmd==='guard') { m.guard=true; say(m.name+' guards.'); }
  after(afterPartyAction);
}

function afterPartyAction() {
  if(BATTLE.enemy.hp<=0) return winBattle();
  const next=nextActor(BATTLE.actor+1);
  if(next>=0) openMenu(next);
  else enemyTurn();
}

function enemyTurn() {
  BATTLE.phase='busy';
  BATTLE.acting='enemy';
  const e=BATTLE.enemy;
  if(e.hp>0) {
    const target=aliveParty()[0];
    let dmg=Math.max(1,Math.round(e.atk*DIFFICULTY[game.difficulty].enemyDmg)-target.def);
    if(target.guard) dmg=Math.max(1,Math.floor(dmg/2));
    target.hp=Math.max(0,target.hp-dmg);
    say(e.name+' hits '+target.name+' for '+dmg+'.');
    if(target.hp<=0) say(target.name+' falls.');
  }
  after(afterEnemy);
}

function afterEnemy() {
  game.party.forEach(m=>{ m.guard=false; });
  if(!aliveParty().length) return loseBattle();
  BATTLE.turn++;
  openMenu(nextActor(0));
}

function winBattle() {
  const xp=BATTLE.enemy.xp;
  say('Victory. Each standing member gains '+xp+' XP.');
  game.party.forEach(m=>{
    if(m.hp<=0) return;
    m.xp+=xp;
    while(m.xp>=levelCost(m.lv)) {
      m.xp-=levelCost(m.lv);
      m.lv++;
      m.maxHp+=LEVEL_UP.hp; m.hp=Math.min(m.maxHp,m.hp+LEVEL_UP.hp); m.atk+=LEVEL_UP.atk;
      say(m.name+' reaches level '+m.lv+'.');
    }
  });
  after(()=>{ BATTLE.result='win'; BATTLE.phase='over'; });
}

function loseBattle() {
  say('The party falls.');
  after(()=>{ BATTLE.result='lose'; BATTLE.phase='over'; });
}

// Closes the fight. A win removes the field monster; a loss restores the party and leaves the monster in place.
function endBattle() {
  const r=BATTLE.result;
  if(r==='win'&&BATTLE.ref) BATTLE.ref.alive=false;
  if(r==='lose') game.party.forEach(m=>{ m.hp=m.maxHp; });
  lastResult=r;
  BATTLE=null;
  stopVoice();
  game.mode='play';
  musicFor('area:'+game.area.id);
}

// The A button (or Enter) and taps on the message box. Menu: confirm. Busy: skip the message. Over: leave the fight.
function battleConfirm() {
  if(!BATTLE) return;
  if(BATTLE.phase==='menu') chooseCommand(BATTLE.cursor);
  else if(BATTLE.phase==='busy') { if(BATTLE.queue.length) nextMsg(); }
  else if(BATTLE.phase==='over') endBattle();
}

// A direction picks a slot of the command cross. A confirms it.
function battleDir(d) {
  if(!BATTLE||BATTLE.phase!=='menu') return;
  const c=COMMAND_KEYS[d];
  if(c) BATTLE.cursor=c;
}

// Per-frame: message timing, then whatever step was waiting for the message box to empty.
function battleUpdate(dt) {
  if(!BATTLE) return;
  if(BATTLE.queue.length) {
    if(BATTLE.heard!==BATTLE.n) { BATTLE.heard=BATTLE.n; playVoice('battle',BATTLE.queue[0],false); }   // a fight line plays only if it has a file
    BATTLE.qt+=dt;
    if(BATTLE.qt>=MSG_TIME) nextMsg();
    return;
  }
  if(BATTLE.then) { const f=BATTLE.then; BATTLE.then=null; f(); }
}
