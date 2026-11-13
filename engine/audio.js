'use strict';
// engine/audio.js: Build 1e. Voice lines and music as real audio files, loaded only when a scene or fight needs them.
// Boot fetches two small lists (data/voice-lines.json, data/music.json) and no audio file. A voice line plays audio/voice/<file> when the list
// has one for that speaker and text; a scene line with no file is read by speech synthesis. Music: one track at a time, loaded when asked for.
// No side effects at load, so the admin pages can load this file too.
const AUDIO={lines:{},music:{tracks:{},use:{}},vtag:'0',mtag:'0',muted:false,ready:false,log:[],voiceEl:null,musicEl:null,musicId:null,wantMusic:null,hooked:false};
try { AUDIO.muted=localStorage.getItem('ffiv-mute')==='1'; } catch(e) {}

// The id of a line: speaker plus a hash of its exact text, so a changed line is a new line and the old file is purged by the Voice Library.
function voiceId(who,text) {
  let h=0x811c9dc5; const s=String(text);
  for(let i=0;i<s.length;i++) { h^=s.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; }
  return String(who).toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+h.toString(16).padStart(8,'0');
}
function logAudio(rec) { AUDIO.log.push(rec); if(AUDIO.log.length>60) AUDIO.log.shift(); }

async function loadAudioLists() {
  const get=async u=>{ try { const r=await fetch(u+'?t='+Date.now(),{cache:'no-store'}); return r.ok?await r.json():null; } catch(e) { return null; } };
  const v=await get('data/voice-lines.json'), m=await get('data/music.json');
  if(v) { AUDIO.lines=v.lines||{}; AUDIO.vtag=String(v.tag||'0'); }
  if(m) { AUDIO.music={tracks:m.tracks||{},use:m.use||{}}; AUDIO.mtag=String(m.tag||'0'); }
  AUDIO.ready=true;
}

// ---------- Voice ----------
function stopVoice() {
  if(AUDIO.voiceEl) { try { AUDIO.voiceEl.pause(); } catch(e) {} AUDIO.voiceEl=null; }
  try { if(window.speechSynthesis) speechSynthesis.cancel(); } catch(e) {}
}
function speakLine(text,rec) {
  try {
    if(!window.speechSynthesis) { rec.ok=false; return; }
    speechSynthesis.speak(new SpeechSynthesisUtterance(text)); rec.via='speech'; rec.ok=true;
  } catch(e) { rec.ok=false; }
}
// who: speaker id; text: the exact line. speech: allow speech synthesis when there is no file (scene lines yes, fight lines no).
function playVoice(who,text,speech) {
  if(AUDIO.muted) return null;
  stopVoice();
  const id=voiceId(who,text), e=AUDIO.lines[id];
  if(e&&e.file) {
    const url='audio/voice/'+e.file+'?v='+AUDIO.vtag, a=new Audio(url), rec={kind:'voice',id,via:'file',url,ok:null};
    AUDIO.voiceEl=a; logAudio(rec);
    a.play().then(()=>{ rec.ok=true; },()=>{ rec.ok=false; if(AUDIO.voiceEl===a&&speech) speakLine(text,rec); });
    return rec;
  }
  if(speech) { const rec={kind:'voice',id,via:'speech',ok:null}; logAudio(rec); speakLine(text,rec); return rec; }
  return null;
}

// ---------- Music ----------
function stopMusic() {
  AUDIO.wantMusic=null; AUDIO.musicId=null;
  if(AUDIO.musicEl) { try { AUDIO.musicEl.pause(); } catch(e) {} AUDIO.musicEl=null; }
}
// use: 'title', 'battle', 'boss' or 'area:<id>'. A use with no track assigned means silence.
function musicFor(use) {
  const id=AUDIO.music.use[use];
  if(!id||!AUDIO.music.tracks[id]) { stopMusic(); return; }
  playMusic(id);
}
function playMusic(id) {
  const t=AUDIO.music.tracks[id]; if(!t) return;
  AUDIO.wantMusic=id;
  if(AUDIO.muted) return;
  if(AUDIO.musicId===id&&AUDIO.musicEl&&!AUDIO.musicEl.paused) return;
  if(AUDIO.musicEl) { try { AUDIO.musicEl.pause(); } catch(e) {} }
  const url='audio/music/'+t.file+'?v='+AUDIO.mtag, a=new Audio(url), rec={kind:'music',id,via:'file',url,ok:null};
  a.loop=true; a.volume=.7; AUDIO.musicEl=a; AUDIO.musicId=id; logAudio(rec);
  a.play().then(()=>{ rec.ok=true; },()=>{ rec.ok=false; hookGesture(); });
}
// Browsers refuse sound before the first tap or key; the wanted track starts on the first one.
function hookGesture() {
  if(AUDIO.hooked) return;
  AUDIO.hooked=true;
  const go=()=>{
    AUDIO.hooked=false; removeEventListener('pointerdown',go,true); removeEventListener('keydown',go,true);
    const id=AUDIO.wantMusic; if(id&&!AUDIO.muted) { AUDIO.musicId=null; playMusic(id); }
  };
  addEventListener('pointerdown',go,true); addEventListener('keydown',go,true);
}
function setMuted(v) {
  AUDIO.muted=!!v;
  try { localStorage.setItem('ffiv-mute',AUDIO.muted?'1':'0'); } catch(e) {}
  if(AUDIO.muted) { stopVoice(); if(AUDIO.musicEl) { try { AUDIO.musicEl.pause(); } catch(e) {} } AUDIO.musicId=null; }
  else if(AUDIO.wantMusic) playMusic(AUDIO.wantMusic);
}
