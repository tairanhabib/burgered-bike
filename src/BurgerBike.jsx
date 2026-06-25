import React, { useState, useRef, useEffect } from "react";
import { supabase, configured } from "./lib/supabase";

/*  THE BURGER BIKE — Boston sightings board + live tracker
    The map is a real lat/lon projection of greater Boston: every Bluebikes
    dock (pulled live from the official GBFS feed), the Charles + harbor, the
    bridges, colleges, the T lines, and landmarks — all in the diner palette.  */

const RELEASE_DATE = new Date("2026-06-17T09:00:00"); // set this to the day you let the bike loose

// ---- map geometry (one shared projection for everything) ------------------
const W = 480, PAD = 12;
const BBOX = { latMin:42.300, latMax:42.420, lonMin:-71.170, lonMax:-71.000 };
const COSLAT = Math.cos(((BBOX.latMin+BBOX.latMax)/2) * Math.PI/180);
const H = Math.round(W * (BBOX.latMax-BBOX.latMin) / ((BBOX.lonMax-BBOX.lonMin)*COSLAT));
function project(lat, lon){
  const x = PAD + ((lon-BBOX.lonMin)/(BBOX.lonMax-BBOX.lonMin)) * (W-2*PAD);
  const y = PAD + ((BBOX.latMax-lat)/(BBOX.latMax-BBOX.latMin)) * (H-2*PAD);
  return [x, y];
}
function inBox(lat, lon){ return lat>=BBOX.latMin-0.004 && lat<=BBOX.latMax+0.004 && lon>=BBOX.lonMin-0.004 && lon<=BBOX.lonMax+0.004; }

// ---- the city, in real coordinates ----------------------------------------
const CHARLES = [[42.3585,-71.1290],[42.3540,-71.1106],[42.3543,-71.0917],[42.3560,-71.0760],[42.3614,-71.0707],[42.3665,-71.0640]];
const MYSTIC  = [[42.3920,-71.0900],[42.3900,-71.0700],[42.3850,-71.0560],[42.3800,-71.0470]];
const HARBOR  = [[42.420,-71.045],[42.376,-71.049],[42.363,-71.050],[42.357,-71.050],[42.351,-71.043],[42.343,-71.035],[42.330,-71.028],[42.300,-71.020]];

const TLINES = [
  { c:"#DA291C", pts:[[42.3954,-71.1418],[42.3967,-71.1218],[42.3884,-71.1191],[42.3736,-71.1190],[42.3654,-71.1037],[42.3623,-71.0862],[42.3613,-71.0707],[42.3564,-71.0624],[42.3522,-71.0552],[42.3425,-71.0568],[42.3301,-71.0573]] }, // Red
  { c:"#00843D", pts:[[42.3489,-71.0954],[42.3479,-71.0879],[42.3500,-71.0775],[42.3519,-71.0707],[42.3537,-71.0643],[42.3564,-71.0624],[42.3597,-71.0593],[42.3631,-71.0586],[42.3655,-71.0622],[42.3705,-71.0766]] }, // Green
  { c:"#ED8B00", pts:[[42.3839,-71.0700],[42.3736,-71.0698],[42.3655,-71.0622],[42.3631,-71.0586],[42.3589,-71.0578],[42.3556,-71.0603],[42.3525,-71.0628],[42.3473,-71.0757],[42.3415,-71.0834],[42.3364,-71.0890],[42.3268,-71.1010]] }, // Orange
  { c:"#003DA5", pts:[[42.3613,-71.0620],[42.3597,-71.0593],[42.3589,-71.0578],[42.3592,-71.0517],[42.3691,-71.0395],[42.3743,-71.0301]] }, // Blue
];

const BRIDGES  = [ {n:"Longfellow",lat:42.3614,lon:-71.0707},{n:"Harvard Br.",lat:42.3543,lon:-71.0917},{n:"BU Br.",lat:42.3540,lon:-71.1106},{n:"Zakim",lat:42.3690,lon:-71.0640} ];
const COLLEGES = [ {n:"MIT",lat:42.3601,lon:-71.0942},{n:"Harvard",lat:42.3770,lon:-71.1167},{n:"BU",lat:42.3505,lon:-71.1054},{n:"Northeastern",lat:42.3398,lon:-71.0892},{n:"Tufts",lat:42.4075,lon:-71.1190} ];
const LANDMARKS= [ {n:"Boston Common",lat:42.3551,lon:-71.0657},{n:"Public Garden",lat:42.3540,lon:-71.0697},{n:"BPL",lat:42.3494,lon:-71.0779},{n:"Fenway Park",lat:42.3467,lon:-71.0972},{n:"TD Garden",lat:42.3662,lon:-71.0622},{n:"Faneuil Hall",lat:42.3600,lon:-71.0568},{n:"State House",lat:42.3588,lon:-71.0638},{n:"Bunker Hill",lat:42.3763,lon:-71.0608},{n:"Aquarium",lat:42.3592,lon:-71.0494} ];

// fallback dock scatter (real-ish core coords) if the live feed is blocked
const FALLBACK_STATIONS = [
  [42.3736,-71.1190],[42.3654,-71.1037],[42.3623,-71.0862],[42.3782,-71.0975],[42.3884,-71.1191],[42.3967,-71.1218],[42.3805,-71.1040],[42.3700,-71.1170],
  [42.3530,-71.1310],[42.3490,-71.1300],[42.3505,-71.1054],[42.3450,-71.0970],[42.3489,-71.0954],[42.3430,-71.1010],
  [42.3500,-71.0810],[42.3494,-71.0779],[42.3473,-71.0757],[42.3410,-71.0750],[42.3450,-71.0700],[42.3398,-71.0892],
  [42.3551,-71.0657],[42.3560,-71.0570],[42.3588,-71.0638],[42.3650,-71.0540],[42.3613,-71.0707],[42.3600,-71.0568],[42.3522,-71.0552],
  [42.3510,-71.0430],[42.3490,-71.0400],[42.3763,-71.0608],[42.3743,-71.0301],[42.3691,-71.0395],[42.3662,-71.0622],
  [42.3364,-71.0890],[42.3268,-71.1010],[42.3310,-71.1040],[42.3200,-71.0950],
];

// sighting neighborhoods, now in lat/lon so pins land on the real map
const HOODS = [
  { id:"davis",     label:"Davis Sq",            lat:42.3967, lon:-71.1218, side:"north", keys:["davis"] },
  { id:"cambridge", label:"Cambridge",           lat:42.3654, lon:-71.1037, side:"north", keys:["cambridge","kendall","central"] },
  { id:"mit",       label:"MIT / Harvard Bridge", lat:42.3580, lon:-71.0930, side:"river", keys:["mit","harvard bridge","smoot"] },
  { id:"allston",   label:"Allston",             lat:42.3530, lon:-71.1310, side:"south", keys:["allston","brighton"] },
  { id:"fenway",    label:"Fenway",              lat:42.3450, lon:-71.0970, side:"south", keys:["fenway","kenmore"] },
  { id:"esplanade", label:"the Esplanade",       lat:42.3560, lon:-71.0730, side:"south", keys:["esplanade"] },
  { id:"backbay",   label:"Back Bay",            lat:42.3500, lon:-71.0810, side:"south", keys:["back bay","backbay","newbury"] },
  { id:"common",    label:"the Common",          lat:42.3551, lon:-71.0657, side:"south", keys:["common","beacon hill"] },
  { id:"downtown",  label:"Downtown",            lat:42.3560, lon:-71.0570, side:"south", keys:["downtown","financial"] },
  { id:"northend",  label:"North End",           lat:42.3650, lon:-71.0540, side:"south", keys:["north end"] },
  { id:"southend",  label:"South End",           lat:42.3410, lon:-71.0750, side:"south", keys:["south end","southend"] },
  { id:"seaport",   label:"Seaport",             lat:42.3510, lon:-71.0430, side:"south", keys:["seaport","fort point"] },
];

const GUESS_OPTS = ["Davis Sq","Allston","Back Bay","the Common","Seaport","Fenway"];

const BADGES = [
  { id:"first",   emoji:"🩸", name:"First Blood", desc:"Log your first sighting",            test:e=>e.length>=1 },
  { id:"double",  emoji:"🍔", name:"Double Take", desc:"Spot it twice",                      test:e=>e.length>=2 },
  { id:"hat",     emoji:"🎩", name:"Hat Trick",   desc:"Three sightings",                    test:e=>e.length>=3 },
  { id:"explore", emoji:"🧭", name:"Explorer",    desc:"Two different neighborhoods",        test:e=>new Set(e.map(x=>x.hoodId).filter(Boolean)).size>=2 },
  { id:"cross",   emoji:"🌉", name:"Cross-River", desc:"Both sides of the Charles",          test:e=>{const s=new Set(e.map(x=>x.side));return s.has("north")&&s.has("south");} },
  { id:"owl",     emoji:"🦉", name:"Night Owl",   desc:"Spot it after midnight (12–5am)",    test:e=>e.some(x=>x.hour>=0&&x.hour<5) },
];

function resolveHood(where){ if(!where) return null; const w=where.toLowerCase(); return HOODS.find(h=>h.keys.some(k=>w.includes(k)))||null; }
function jitter(id){ let n=0; for(const c of String(id)) n=(n*31+c.charCodeAt(0))%101; return { x:((n%7)-3)*2.2, y:(((n>>3)%7)-3)*2.2 }; }
function timeAgo(t){ const s=(Date.now()-t)/1000; if(s<90) return "just now"; const m=s/60; if(m<60) return `${Math.round(m)} min ago`; const h=m/60; if(h<24) return `${Math.round(h)} hr ago`; return `${Math.round(h/24)} days ago`; }
function formatStamp(t){ const d=t.toLocaleDateString(undefined,{weekday:"short"}).toUpperCase(); const tm=t.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"}); return `${d} · ${tm}`; }

async function compress(file, max=1200, q=0.7){
  try{
    const img = await createImageBitmap(file);
    const s = Math.min(1, max/Math.max(img.width, img.height));
    const w = Math.round(img.width*s), h = Math.round(img.height*s);
    const c = document.createElement("canvas"); c.width=w; c.height=h;
    c.getContext("2d").drawImage(img,0,0,w,h);
    return await new Promise(res=>c.toBlob(res,"image/jpeg",q));
  }catch(e){ return file; }
}

async function loadSightings(){
  if(!supabase) return [];
  const { data, error } = await supabase.from("sightings_public").select("*").order("created_at",{ascending:false});
  if(error){ console.error(error); return []; }
  return (data||[]).map(r=>({ id:r.id, img:r.image_url, where:r.where_spotted, spotter:r.spotter||"—", t:new Date(r.created_at) }));
}

function ding(){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext; const ctx=new Ctx();
    const o=ctx.createOscillator(), g=ctx.createGain(); o.connect(g); g.connect(ctx.destination);
    o.type="sine"; o.frequency.setValueAtTime(990,ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1480,ctx.currentTime+0.05);
    g.gain.setValueAtTime(0.0001,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.22,ctx.currentTime+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.45);
    o.start(); o.stop(ctx.currentTime+0.45);
  }catch(e){}
}

function BikeDoodle({ bg="#EAD3A0" }){
  return (
    <svg viewBox="0 0 200 130" role="img" aria-label="The blue burger bike" style={{width:"100%",height:"100%",display:"block",background:bg}}>
      <g stroke="#2A1D12" strokeWidth="5" fill="none"><circle cx="52" cy="92" r="26"/><circle cx="150" cy="92" r="26"/></g>
      <g stroke="#2A1D12" strokeWidth="1.5" opacity="0.5"><line x1="52" y1="66" x2="52" y2="118"/><line x1="26" y1="92" x2="78" y2="92"/><line x1="150" y1="66" x2="150" y2="118"/><line x1="124" y1="92" x2="176" y2="92"/></g>
      <g stroke="#2E6BD6" strokeWidth="6" fill="none" strokeLinecap="round"><path d="M52 92 L96 56 L150 92"/><path d="M96 56 L78 92"/><path d="M96 56 L120 50"/><path d="M52 92 L78 92"/></g>
      <rect x="88" y="48" width="20" height="6" rx="3" fill="#2A1D12"/><rect x="118" y="44" width="6" height="14" rx="3" fill="#2A1D12"/>
      <g transform="translate(123 22)"><ellipse cx="0" cy="16" rx="15" ry="6" fill="#C98A3A"/><rect x="-15" y="11" width="30" height="6" fill="#6FA63C"/><rect x="-13" y="7" width="26" height="6" rx="2" fill="#7A3B1E"/><path d="M-16 7 a16 9 0 0 1 32 0 z" fill="#F0B544"/><circle cx="-6" cy="2" r="1.4" fill="#FBE8C0"/><circle cx="3" cy="0" r="1.4" fill="#FBE8C0"/><circle cx="9" cy="3" r="1.4" fill="#FBE8C0"/></g>
    </svg>
  );
}

function BostonMap({ sightings }){
  const [stations,setStations]=useState(FALLBACK_STATIONS);
  const [live,setLive]=useState(false);
  useEffect(()=>{ let on=true;
    fetch("https://gbfs.bluebikes.com/gbfs/en/station_information.json")
      .then(r=>r.json())
      .then(j=>{ const s=j?.data?.stations; if(on && Array.isArray(s) && s.length){ setStations(s.map(x=>[x.lat,x.lon])); setLive(true); } })
      .catch(()=>{});
    return ()=>{ on=false; };
  },[]);

  const docks = stations.filter(([la,lo])=>inBox(la,lo));
  const resolved = sightings.map(s=>({s,h:resolveHood(s.where)})).filter(x=>x.h);
  const pts = [...resolved].reverse().map(x=>{ const [px,py]=project(x.h.lat,x.h.lon); const j=jitter(x.s.id); return {x:px+j.x,y:py+j.y,s:x.s}; });
  const trail = pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const latest = pts.length ? pts[pts.length-1] : null;
  const poly = arr => arr.map(([la,lo])=>project(la,lo).map(n=>n.toFixed(1)).join(",")).join(" ");
  const harborPts = [...HARBOR.map(([la,lo])=>project(la,lo).map(n=>n.toFixed(1)).join(",")), `${W},${H}`, `${W},0`].join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of greater Boston showing ${docks.length} Bluebikes docks and ${pts.length} bike sightings`} style={{width:"100%",height:"auto",display:"block"}}>
      <rect x="0" y="0" width={W} height={H} fill="#FBF1DA"/>

      {/* water */}
      <polygon points={harborPts} fill="#9FC0EC" stroke="#2E6BD6" strokeWidth="1.5"/>
      <polyline points={poly(CHARLES)} fill="none" stroke="#2E6BD6" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points={poly(CHARLES)} fill="none" stroke="#9FC0EC" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points={poly(MYSTIC)} fill="none" stroke="#2E6BD6" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/>
      <text {...labelAt(42.3555,-71.0900)} fontFamily="'DM Mono',monospace" fontSize="8" fill="#2E6BD6" opacity="0.85">CHARLES R.</text>
      <text {...labelAt(42.3880,-71.0640)} fontFamily="'DM Mono',monospace" fontSize="7.5" fill="#2E6BD6" opacity="0.8">MYSTIC R.</text>
      <text {...labelAt(42.345,-71.020)} fontFamily="'DM Mono',monospace" fontSize="9" fill="#FFF" opacity="0.9" letterSpacing="1">BOSTON HARBOR</text>

      {/* T lines */}
      {TLINES.map((ln,i)=>(<polyline key={i} points={poly(ln.pts)} fill="none" stroke={ln.c} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"/>))}

      {/* bluebikes docks */}
      {docks.map(([la,lo],i)=>{ const [x,y]=project(la,lo); return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="1.6" fill="#3E6FAE" opacity="0.62"/>; })}

      {/* bridges */}
      {BRIDGES.map((b,i)=>{ const [x,y]=project(b.lat,b.lon); return (
        <g key={"br"+i}><rect x={x-3} y={y-3} width="6" height="6" fill="none" stroke="#2A1D12" strokeWidth="1" transform={`rotate(45 ${x} ${y})`}/>
        <text x={x+6} y={y+3} fontFamily="'DM Mono',monospace" fontSize="6.5" fill="#5a452f">{b.n}</text></g>
      );})}

      {/* colleges */}
      {COLLEGES.map((c,i)=>{ const [x,y]=project(c.lat,c.lon); return (
        <g key={"co"+i}><rect x={x-3.5} y={y-3.5} width="7" height="7" fill="#F2B100" stroke="#2A1D12" strokeWidth="1.2" transform={`rotate(45 ${x} ${y})`}/>
        <text x={x+6} y={y+3} fontFamily="'DM Mono',monospace" fontSize="8" fontWeight="500" fill="#2A1D12">{c.n}</text></g>
      );})}

      {/* landmarks */}
      {LANDMARKS.map((m,i)=>{ const [x,y]=project(m.lat,m.lon); return (
        <g key={"lm"+i}><circle cx={x} cy={y} r="2.6" fill="#6FA63C" stroke="#2A1D12" strokeWidth="1.1"/>
        <text x={x+5} y={y+3} fontFamily="'DM Mono',monospace" fontSize="7" fill="#3f3320">{m.n}</text></g>
      );})}

      {/* the bike's trail + sightings */}
      {pts.length>1 && <polyline points={trail} fill="none" stroke="#D63A2F" strokeWidth="1.8" strokeDasharray="4 3" opacity="0.7"/>}
      {pts.map((p,i)=>{ const isLatest=latest&&i===pts.length-1; return (
        <g key={p.s.id}>
          {isLatest && <circle cx={p.x} cy={p.y} r="9" fill="none" stroke="#D63A2F" strokeWidth="2" className="pulse"/>}
          <circle cx={p.x} cy={p.y} r="5" fill={isLatest?"#D63A2F":"#F2B100"} stroke="#2A1D12" strokeWidth="1.6"/>
          <circle cx={p.x} cy={p.y} r="1.6" fill="#FFF8EC"/>
          {isLatest && <text x={p.x+10} y={p.y+12} fontFamily="'DM Mono',monospace" fontSize="9" fill="#D63A2F" fontWeight="500">here now</text>}
        </g>
      );})}

      {/* legend */}
      <g fontFamily="'DM Mono',monospace" fontSize="7.5" fill="#5a452f">
        <rect x="8" y={H-46} width="150" height="38" rx="6" fill="#FFF8EC" stroke="#2A1D12" strokeWidth="1" opacity="0.92"/>
        <circle cx="16" cy={H-36} r="2.6" fill="#D63A2F" stroke="#2A1D12" strokeWidth="1"/><text x="23" y={H-33}>bike sighting</text>
        <circle cx="16" cy={H-26} r="1.6" fill="#3E6FAE"/><text x="23" y={H-23}>{live?`${docks.length} live Bluebikes docks`:`Bluebikes docks (${docks.length})`}</text>
        <line x1="12" y1={H-15} x2="20" y2={H-15} stroke="#DA291C" strokeWidth="2"/><line x1="22" y1={H-15} x2="30" y2={H-15} stroke="#00843D" strokeWidth="2"/><line x1="32" y1={H-15} x2="40" y2={H-15} stroke="#ED8B00" strokeWidth="2"/><line x1="42" y1={H-15} x2="50" y2={H-15} stroke="#003DA5" strokeWidth="2"/>
        <text x="55" y={H-12}>the T</text>
      </g>
    </svg>
  );
}
function labelAt(lat,lon){ const [x,y]=project(lat,lon); return { x:x.toFixed(1), y:y.toFixed(1) }; }

export default function BurgerBike(){
  const [sightings,setSightings]=useState([]);
  const [loading,setLoading]=useState(true);
  const [myEntries,setMyEntries]=useState([]);
  const [preview,setPreview]=useState(null);
  const [file,setFile]=useState(null);
  const [where,setWhere]=useState("");
  const [spotter,setSpotter]=useState("");
  const [email,setEmail]=useState("");
  const [sending,setSending]=useState(false);
  const [bellTap,setBellTap]=useState(0);
  const [guess,setGuess]=useState(null);
  const [tally,setTally]=useState({ "Davis Sq":4,"Allston":7,"Back Bay":5,"the Common":3,"Seaport":2,"Fenway":6 });
  const fileInput=useRef(null);

  useEffect(()=>{ let on=true; loadSightings().then(s=>{ if(on){ setSightings(s); setLoading(false); } }); return ()=>{ on=false; }; },[]);
  const [,setTick]=useState(0);
  useEffect(()=>{ const id=setInterval(()=>setTick(t=>t+1),60000); return ()=>clearInterval(id); },[]);

  const count=sightings.length;
  const latest=sightings[0];
  const daysLoose=Math.max(0,Math.floor((Date.now()-RELEASE_DATE)/86400000));
  const hoodsVisited=new Set(sightings.map(s=>resolveHood(s.where)?.id).filter(Boolean)).size;
  const spotterCount=new Set(sightings.map(s=>s.spotter).filter(n=>n&&n!=="—")).size;
  const guessMax=Math.max(1,...Object.values(tally));

  function pickPhoto(e){ const f=e.target.files?.[0]; if(!f) return; setFile(f); const r=new FileReader(); r.onload=()=>setPreview(r.result); r.readAsDataURL(f); }

  async function submit(){
    if(!preview){ fileInput.current?.focus(); return; }
    if(!supabase){ alert("Add your Supabase keys to .env.local first, then restart the dev server."); return; }
    setSending(true); ding();
    try{
      const blob=await compress(file);
      const path=`${crypto.randomUUID()}.jpg`;
      const up=await supabase.storage.from("sightings").upload(path,blob,{contentType:"image/jpeg"});
      if(up.error) throw up.error;
      const { data:{ publicUrl } }=supabase.storage.from("sightings").getPublicUrl(path);
      const ins=await supabase.from("sightings").insert({ image_url:publicUrl, where_spotted:where.trim(), spotter:spotter.trim(), email:email.trim() });
      if(ins.error) throw ins.error;
      const t=new Date(); const hood=resolveHood(where);
      setMyEntries(prev=>[...prev,{ hoodId:hood?.id||null, side:hood?.side||null, hour:t.getHours(), where:where.trim() }]);
      setPreview(null); setFile(null); setWhere(""); setSpotter(""); setEmail("");
      alert("Rung in! 🔔 It'll appear on the board once it's approved.");
    }catch(e){ console.error(e); alert("Something hiccuped on the upload — try again?"); }
    finally{ setSending(false); }
  }

  function castGuess(opt){ setTally(prev=>{ const n={...prev}; if(guess) n[guess]=Math.max(0,(n[guess]||0)-1); n[opt]=(n[opt]||0)+1; return n; }); setGuess(opt); ding(); }
  function ringBell(){ setBellTap(n=>n+1); ding(); }

  return (
    <div className="bb-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Hanken+Grotesk:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        .bb-root{ --bun:#F6E7C6; --bun-deep:#EAD3A0; --paper:#FFF8EC; --char:#2A1D12;
          --ketchup:#D63A2F; --mustard:#F2B100; --bike:#2E6BD6; --lettuce:#6FA63C;
          --disp:'Fredoka','Trebuchet MS',system-ui,sans-serif; --body:'Hanken Grotesk',system-ui,sans-serif; --mono:'DM Mono',ui-monospace,monospace;
          background:var(--bun); color:var(--char); font-family:var(--body); min-height:100vh;
          background-image:radial-gradient(var(--bun-deep) 1px, transparent 1.4px); background-size:22px 22px; }
        .bb-wrap{ max-width:560px; margin:0 auto; padding:18px 16px 64px; }
        @media(min-width:820px){ .bb-wrap{ max-width:940px; } }

        .setup{ background:var(--char); color:#FFE8B0; font-family:var(--mono); font-size:13px; border-radius:11px; padding:11px 14px; margin-bottom:14px; }

        .topbar{ display:flex; gap:14px; align-items:flex-start; justify-content:space-between; }
        .bb-eyebrow{ font-family:var(--mono); font-size:12px; letter-spacing:.18em; text-transform:uppercase; color:var(--ketchup); margin:0 0 6px; }
        .bb-h1{ font-family:var(--disp); font-weight:700; line-height:.95; font-size:clamp(40px,11vw,64px); margin:0; letter-spacing:-.01em; }
        .bb-h1 .blue{ color:var(--bike); }
        .bb-lede{ font-size:16px; max-width:34ch; margin:12px 0 0; color:#4a3725; }
        .bell-btn{ background:none; border:0; cursor:pointer; padding:0; display:inline-flex; filter:drop-shadow(0 6px 0 rgba(42,29,18,.12)); }
        .bell-svg{ width:80px; height:80px; transform-origin:50% 18%; }
        @media(prefers-reduced-motion:no-preference){ .bell-svg.ring{ animation:ring .5s ease; } .pulse{ animation:pulse 1.6s ease-out infinite; transform-origin:center; } }
        @keyframes ring{ 0%,100%{transform:rotate(0)} 20%{transform:rotate(-11deg)} 45%{transform:rotate(8deg)} 70%{transform:rotate(-4deg)} }
        @keyframes pulse{ 0%{opacity:.9; r:5} 100%{opacity:0; r:14} }

        .alive{ margin-top:18px; display:flex; align-items:center; gap:9px; flex-wrap:wrap;
          background:#13361f; color:#EAF7EC; border:2px solid var(--char); border-radius:13px; padding:11px 14px; font-size:14.5px; box-shadow:0 6px 0 rgba(42,29,18,.16); }
        .alive b{ font-family:var(--disp); }
        .live-dot{ width:10px; height:10px; border-radius:50%; background:#46e07a; box-shadow:0 0 0 0 rgba(70,224,122,.7); }
        @media(prefers-reduced-motion:no-preference){ .live-dot{ animation:blip 1.5s infinite; } }
        @keyframes blip{ 0%{box-shadow:0 0 0 0 rgba(70,224,122,.7)} 70%{box-shadow:0 0 0 9px rgba(70,224,122,0)} 100%{box-shadow:0 0 0 0 rgba(70,224,122,0)} }

        .stats{ margin-top:12px; display:grid; grid-template-columns:repeat(4,1fr); gap:9px; }
        .stat{ background:var(--paper); border:2px solid var(--char); border-radius:11px; padding:9px 6px; text-align:center; box-shadow:0 4px 0 rgba(42,29,18,.12); }
        .stat b{ display:block; font-family:var(--disp); font-weight:700; font-size:23px; color:var(--ketchup); line-height:1; }
        .stat span{ font-family:var(--mono); font-size:9.5px; letter-spacing:.06em; text-transform:uppercase; color:#7a6646; }

        .promo{ margin-top:16px; display:flex; gap:14px; align-items:flex-start; background:var(--bike); color:#F2F7FF; border:2px solid var(--char); border-radius:14px; padding:14px 16px; box-shadow:0 6px 0 rgba(42,29,18,.16); }
        .promo-badge{ flex:none; font-family:var(--disp); font-weight:700; font-size:15px; background:var(--mustard); color:var(--char); border:2px solid var(--char); border-radius:50%; width:54px; height:54px; display:grid; place-items:center; transform:rotate(-8deg); box-shadow:0 3px 0 var(--char); }
        .promo-h{ font-family:var(--disp); font-weight:600; font-size:17px; margin:0 0 4px; line-height:1.15; }
        .promo-sub{ font-size:13.5px; margin:0 0 6px; color:#dce8ff; }
        .promo-fine{ font-family:var(--mono); font-size:10.5px; letter-spacing:.04em; margin:0; color:#b9cef3; }

        .sect-h{ font-family:var(--disp); font-weight:600; font-size:21px; margin:30px 0 12px; display:flex; align-items:center; gap:8px; }

        .card{ background:var(--paper); border:2px solid var(--char); border-radius:16px; box-shadow:0 8px 0 rgba(42,29,18,.14); overflow:hidden; }
        .card-head{ background:var(--ketchup); color:#FFF1E2; padding:10px 16px; font-family:var(--mono); font-size:13px; letter-spacing:.16em; text-transform:uppercase; display:flex; justify-content:space-between; }
        .card-body{ padding:16px; display:grid; gap:14px; }
        .mapcard{ padding:10px; }

        .dropzone{ border:2.5px dashed var(--bun-deep); border-radius:13px; background:#FFFDF6; aspect-ratio:4/3; display:grid; place-items:center; cursor:pointer; overflow:hidden; text-align:center; }
        .dropzone:hover{ border-color:var(--mustard); } .dropzone:focus-within{ outline:3px solid var(--bike); outline-offset:2px; }
        .dropzone img{ width:100%; height:100%; object-fit:cover; }
        .dz-emoji{ font-size:34px; } .dz-main{ font-family:var(--disp); font-weight:600; font-size:18px; margin:8px 0 2px; } .dz-sub{ font-size:13px; color:#7a6646; padding:0 16px; }

        .field label{ display:block; font-family:var(--mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#7a6646; margin-bottom:5px; }
        .field input{ width:100%; box-sizing:border-box; font-family:var(--body); font-size:16px; padding:11px 13px; border-radius:11px; color:var(--char); border:2px solid var(--bun-deep); background:#FFFDF6; }
        .field input:focus{ outline:none; border-color:var(--bike); }
        .chips{ display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
        .chip{ font-family:var(--mono); font-size:11px; padding:5px 9px; border-radius:20px; border:1.5px solid var(--bun-deep); background:#FFFDF6; color:#5a452f; cursor:pointer; }
        .chip:hover{ border-color:var(--mustard); } .chip.on{ background:var(--mustard); border-color:var(--char); color:var(--char); font-weight:500; }

        .ring-in{ width:100%; cursor:pointer; font-family:var(--disp); font-weight:700; font-size:19px; color:var(--char); background:var(--mustard); border:2px solid var(--char); border-radius:13px; padding:14px; box-shadow:0 5px 0 var(--char); transition:transform .06s,box-shadow .06s; }
        .ring-in:hover{ background:#FFC326; } .ring-in:active{ transform:translateY(4px); box-shadow:0 1px 0 var(--char); }
        .ring-in:disabled{ opacity:.6; cursor:wait; } .ring-in:focus-visible{ outline:3px solid var(--bike); outline-offset:3px; }

        .gopts{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
        .gopt{ font-family:var(--disp); font-weight:600; font-size:14px; padding:11px 6px; border-radius:11px; border:2px solid var(--bun-deep); background:#FFFDF6; color:var(--char); cursor:pointer; }
        .gopt:hover{ border-color:var(--mustard); } .gopt.on{ background:var(--bike); border-color:var(--char); color:#fff; }
        .gbars{ display:grid; gap:6px; margin-top:4px; }
        .gbar{ display:flex; align-items:center; gap:8px; font-family:var(--mono); font-size:11px; }
        .gbar .lab{ width:78px; flex:none; color:#5a452f; } .gbar .track{ flex:1; height:12px; background:var(--bun); border-radius:7px; overflow:hidden; border:1.5px solid var(--bun-deep); }
        .gbar .fill{ height:100%; background:var(--lettuce); }
        .gnote{ font-size:13px; color:#5a452f; margin:2px 0 0; }

        .badges{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
        @media(min-width:560px){ .badges{ grid-template-columns:repeat(6,1fr); } }
        .badge{ background:var(--paper); border:2px solid var(--char); border-radius:13px; padding:12px 6px; text-align:center; box-shadow:0 4px 0 rgba(42,29,18,.12); }
        .badge .em{ font-size:28px; line-height:1; filter:grayscale(1); opacity:.35; }
        .badge.on .em{ filter:none; opacity:1; }
        .badge .nm{ font-family:var(--disp); font-weight:600; font-size:12.5px; margin:6px 0 2px; color:#9a8358; }
        .badge.on .nm{ color:var(--char); }
        .badge .ds{ font-size:10px; color:#9a8358; line-height:1.2; }

        .count{ font-family:var(--disp); font-weight:700; text-align:center; margin:30px 0 16px; font-size:20px; }
        .count b{ color:var(--ketchup); font-size:26px; }
        .empty{ text-align:center; color:#7a6646; padding:8px 0 0; }
        .empty .doodle{ max-width:220px; margin:0 auto 10px; border:2px solid var(--char); border-radius:13px; overflow:hidden; box-shadow:0 6px 0 rgba(42,29,18,.13); }
        .grid{ display:grid; gap:18px; grid-template-columns:1fr; }
        @media(min-width:560px){ .grid{ grid-template-columns:1fr 1fr; } }
        @media(min-width:820px){ .grid{ grid-template-columns:1fr 1fr 1fr; } }
        .ticket{ background:var(--paper); border:2px solid var(--char); border-radius:13px; overflow:hidden; box-shadow:0 6px 0 rgba(42,29,18,.13); }
        .ticket .pic{ aspect-ratio:4/3; background:var(--bun-deep); } .ticket .pic img{ width:100%; height:100%; object-fit:cover; display:block; }
        .ticket .meta{ padding:11px 13px 14px; border-top:2px dashed var(--bun-deep); }
        .ticket .where{ font-family:var(--disp); font-weight:600; font-size:16px; }
        .ticket .stamp{ font-family:var(--mono); font-size:11px; letter-spacing:.08em; color:#9a8358; display:flex; justify-content:space-between; margin-top:6px; }
        .foot{ text-align:center; margin-top:40px; font-size:13px; color:#8a7350; }
      `}</style>

      <div className="bb-wrap">
        {!configured && <div className="setup">⚙️ Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to <b>.env.local</b>, then restart the dev server.</div>}

        <header className="topbar">
          <div>
            <p className="bb-eyebrow">You found it · Boston</p>
            <h1 className="bb-h1">The <span className="blue">Burger</span><br/>Bike</h1>
            <p className="bb-lede">A blue bike with a burger bell, loose in the city. Spot it, snap it, ring it in.</p>
          </div>
          <button className="bell-btn" onClick={ringBell} aria-label="Ring the bell">
            <svg className={`bell-svg ${bellTap?"ring":""}`} key={bellTap} viewBox="0 0 80 80">
              <ellipse cx="40" cy="60" rx="32" ry="9" fill="#C98A3A"/><rect x="8" y="48" width="64" height="13" fill="#6FA63C"/>
              <rect x="11" y="40" width="58" height="12" rx="5" fill="#7A3B1E"/><path d="M9 40 a31 19 0 0 1 62 0 z" fill="#F0B544"/>
              <circle cx="28" cy="26" r="2.4" fill="#FBE8C0"/><circle cx="44" cy="22" r="2.4" fill="#FBE8C0"/><circle cx="56" cy="29" r="2.4" fill="#FBE8C0"/>
            </svg>
          </button>
        </header>

        <div className="alive">
          <span className="live-dot"/>
          <span>{latest
            ? <><b>Alive right now.</b> Last rung in {timeAgo(latest.t)}{latest.where?` near ${latest.where}`:""} · {daysLoose} days on the loose.</>
            : <><b>On the loose.</b> Nobody's rung it in yet · {daysLoose} days out there. Be the first.</>}</span>
        </div>

        <div className="stats">
          <div className="stat"><b>{count}</b><span>sightings</span></div>
          <div className="stat"><b>{daysLoose}</b><span>days loose</span></div>
          <div className="stat"><b>{hoodsVisited}</b><span>hoods</span></div>
          <div className="stat"><b>{spotterCount}</b><span>spotters</span></div>
        </div>

        <aside className="promo" aria-label="Giveaway details">
          <div className="promo-badge">WIN</div>
          <div>
            <p className="promo-h">👑 Ring one in for a shot at a $15 Burger King gift card</p>
            <p className="promo-sub">Every sighting is one entry. Winner drawn the 1st of each month — add your email below to enter.</p>
            <p className="promo-fine">Not affiliated with or sponsored by Burger King. No purchase necessary to enter or win.</p>
          </div>
        </aside>

        <h2 className="sect-h">🗺️ Where it's been</h2>
        <div className="card mapcard"><BostonMap sightings={sightings}/></div>

        <h2 className="sect-h">📸 Add your sighting</h2>
        <section className="card" aria-label="Add your sighting">
          <div className="card-head"><span>Sighting ticket</span><span>#{String(count+1).padStart(3,"0")}</span></div>
          <div className="card-body">
            <label className="dropzone">
              <input ref={fileInput} type="file" accept="image/*" capture="environment" onChange={pickPhoto} style={{display:"none"}}/>
              {preview ? <img src={preview} alt="Your photo of the burger bike"/> :
                <div><div className="dz-emoji">📸</div><div className="dz-main">Add your photo</div><div className="dz-sub">Tap to use your camera or pick from your phone</div></div>}
            </label>
            <div className="field">
              <label htmlFor="where">Where'd you spot it?</label>
              <input id="where" value={where} onChange={e=>setWhere(e.target.value)} placeholder="tap a spot below, or type your own"/>
              <div className="chips">
                {HOODS.slice(0,8).map(h=>(<button key={h.id} type="button" className={`chip${where===h.label?" on":""}`} onClick={()=>setWhere(h.label)}>{h.label}</button>))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="spotter">Your name <span style={{textTransform:"none"}}>(optional)</span></label>
              <input id="spotter" value={spotter} onChange={e=>setSpotter(e.target.value)} placeholder="leave blank to stay a mystery"/>
            </div>
            <div className="field">
              <label htmlFor="email">Email <span style={{textTransform:"none"}}>(only to reach you if you win)</span></label>
              <input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="skip it to post without entering the draw"/>
            </div>
            <button className="ring-in" onClick={submit} disabled={sending}>{sending?"Ringing…":"Ring it in 🔔"}</button>
          </div>
        </section>

        <h2 className="sect-h">🔮 Guess where it'll be next</h2>
        <section className="card">
          <div className="card-head"><span>Tomorrow's neighborhood</span><span>bonus entry</span></div>
          <div className="card-body">
            <div className="gopts">
              {GUESS_OPTS.map(o=>(<button key={o} className={`gopt${guess===o?" on":""}`} onClick={()=>castGuess(o)}>{o}</button>))}
            </div>
            <div className="gbars">
              {GUESS_OPTS.map(o=>(
                <div className="gbar" key={o}><span className="lab">{o}</span><span className="track"><span className="fill" style={{width:`${Math.round((tally[o]/guessMax)*100)}%`}}/></span><span>{tally[o]}</span></div>
              ))}
            </div>
            <p className="gnote">{guess?`You're in for ${guess} 🤞 — closest guess to tomorrow's first sighting wins a bonus draw entry.`:"Tap your pick. Closest guess to tomorrow's first sighting wins a bonus draw entry."}</p>
          </div>
        </section>

        <h2 className="sect-h">🏅 Your badges</h2>
        <div className="badges">
          {BADGES.map(b=>{ const on=b.test(myEntries); return (
            <div className={`badge${on?" on":""}`} key={b.id} title={b.desc}>
              <div className="em">{b.emoji}</div><div className="nm">{b.name}</div><div className="ds">{b.desc}</div>
            </div>
          );})}
        </div>

        {count>0 && <p className="count"><b>{count}</b> sightings and counting</p>}
        {loading ? <p className="empty">Loading sightings…</p>
          : count===0 ? (
            <div className="empty">
              <div className="doodle"><BikeDoodle/></div>
              No sightings on the board yet. If you've seen it, ring it in above.
            </div>
          ) : (
            <div className="grid">
              {sightings.map(s=>(
                <article className="ticket" key={s.id}>
                  <div className="pic">{s.img ? <img src={s.img} alt={`Burger bike at ${s.where||"an unknown spot"}`}/> : <BikeDoodle/>}</div>
                  <div className="meta">
                    <div className="where">{s.where||"somewhere in Boston"}</div>
                    <div className="stamp"><span>@{s.spotter}</span><span>{formatStamp(s.t)}</span></div>
                  </div>
                </article>
              ))}
            </div>
          )}

        <p className="foot">Be kind to the bike, and to each other. Photos only — no plates, no faces of strangers.</p>
      </div>
    </div>
  );
}
