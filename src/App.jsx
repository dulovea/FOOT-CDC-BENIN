import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, addDoc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy
} from "firebase/firestore";

// 🔧 REMPLACE CES VALEURS PAR TON BLOC FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBUTJUJ7DCOjGq4noZXalLWqvDaBXZyu80",
  authDomain: "foot-cdc-benin.firebaseapp.com",
  projectId: "foot-cdc-benin",
  storageBucket: "foot-cdc-benin.firebasestorage.app",
  messagingSenderId: "67606549005",
  appId: "1:67606549005:web:a669887869ad72ee85bb44"
};

const ADMIN_PASSWORD   = "jeudi2024";
const FIRST_MATCH_DATE = new Date("2025-05-08");
const APP_URL          = "https://foot-cdc-benin.vercel.app/";
const MAILING_LIST     = "Moresque.AFFEDJOU@cdcb.bj,dulove.azon@cdcb.bj,laurencio.tossa@cdcb.bj,franck.akanni@cdcb.bj,Arsene.FADO@cdcb.bj,Romuald.ALLAGBE@cdcb.bj,rufus.zanklan@cdcb.bj,Edmond.DJIDONOU@cdcb.bj,horace.akpo@cdcb.bj,Cedric.FOURN@cdcb.bj,Consultant1.RH@cdcb.bj,gilles.sanni@cdcb.bj,Shadrac.HOUESSINON@cdcb.bj,deenbka@gmail.com";

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const C = {
  bg:"#f0f4fa",bgCard:"#ffffff",bgCard2:"#f8faff",
  primary:"#1a56db",primaryLight:"#dbeafe",accent:"#2563eb",
  gold:"#d97706",silver:"#6b7280",bronze:"#92400e",
  text:"#111827",textMid:"#374151",textLight:"#6b7280",textXlight:"#9ca3af",
  border:"#e5e7eb",borderBlue:"#bfdbfe",
  danger:"#dc2626",dangerBg:"#fef2f2",success:"#059669",successBg:"#ecfdf5",
  shadow:"0 1px 4px rgba(0,0,0,0.08)",shadowMd:"0 4px 16px rgba(0,0,0,0.10)",
  orange:"#ea580c",orangeBg:"#fff7ed",orangeBorder:"#fed7aa",
  purple:"#7c3aed",purpleBg:"#f5f3ff",purpleBorder:"#ddd6fe",
};

const CHART_COLORS = ["#1a56db","#dc2626","#059669","#d97706","#7c3aed","#0891b2","#be185d","#65a30d","#c2410c","#4338ca","#0f766e","#b45309","#9333ea","#0369a1","#15803d"];
const MOIS_FR      = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const positionColors = {1:C.gold,2:C.silver,3:C.bronze};
const trophyIcon = (r) => ({1:"🥇",2:"🥈",3:"🥉"}[r]||null);
const NAV        = ["classement","graphiques","score","paiement","recapitulatif","matchs"];
const NAV_LABELS = {classement:"Top",graphiques:"Stats",score:"Score",paiement:"Cash",recapitulatif:"Récap",matchs:"Matchs"};
const NAV_ICONS  = {classement:"🏆",graphiques:"📈",score:"⚽",paiement:"💰",recapitulatif:"📊",matchs:"📅"};
const STAT_VIEWS = [{key:"goals",icon:"⚽",label:"Buts",color:"#1a56db",unit:"buts"},{key:"assists",icon:"🎯",label:"Passes",color:"#7c3aed",unit:"passes"},{key:"ratio",icon:"📈",label:"Ratio",color:"#ea580c",unit:"b/m"},{key:"streak",icon:"🔥",label:"Série",color:"#dc2626",unit:"matchs"}];
const STEPS      = ["presence","equipes","buts","validation"];

const formatDate = (iso) => { if(!iso) return ""; const [y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; };
const todayISO   = () => new Date().toISOString().split("T")[0];

const getGroupIdx = (date, total) => {
  if (!total) return 0;
  const diff = Math.round((date - FIRST_MATCH_DATE)/(7*24*60*60*1000));
  return (((diff+1)%total)+total)%total;
};
const getNextThursday = () => {
  const d=new Date(), day=d.getDay(), n=(4-day+7)%7===0?0:(4-day+7)%7;
  d.setDate(d.getDate()+n); return d;
};
const computeStreak = (name, history) => {
  let s=0;
  for (const m of [...history].sort((a,b)=>b.timestamp-a.timestamp)) {
    if (!m.presentNames?.includes(name)) continue;
    if (m.events?.some(e=>e.scorer===name)) s++; else break;
  }
  return s;
};
const getMotm = (match) => {
  if (!match.events?.length) return null;
  const c=match.events.reduce((a,e)=>{ a[e.scorer]=(a[e.scorer]||0)+1; return a; },{});
  const s=Object.entries(c).sort((a,b)=>b[1]-a[1]);
  return s.length?{name:s[0][0],goals:s[0][1]}:null;
};
const shuffle = (arr) => {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
};
const buildLineData = (players, history) => {
  if (!history.length) return {months:[],series:[]};
  const ms=new Set();
  history.forEach(m=>{ const d=new Date(m.timestamp); ms.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); });
  const months=[...ms].sort();
  const series=players.map((p,i)=>{
    let c=0;
    const data=months.map(mo=>{
      history.filter(m=>{ const d=new Date(m.timestamp); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`===mo; }).forEach(m=>{ c+=m.events?.filter(e=>e.scorer===p.name).length||0; });
      return c;
    });
    return {name:p.name,data,color:CHART_COLORS[i%CHART_COLORS.length]};
  });
  return {months,series};
};
const buildBarData = (players, history) => {
  if (!history.length) return {months:[],series:[]};
  const ms=new Set();
  history.forEach(m=>{ const d=new Date(m.timestamp); ms.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`); });
  const months=[...ms].sort();
  const series=players.map((p,i)=>{
    const data=months.map(mo=>history.filter(m=>{ const d=new Date(m.timestamp); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`===mo; }).reduce((s,m)=>s+(m.events?.filter(e=>e.scorer===p.name).length||0),0));
    return {name:p.name,data,color:CHART_COLORS[i%CHART_COLORS.length]};
  });
  return {months,series};
};

const INITIAL_GROUPS = [
  {id:1,members:"Dulove & Laurencio",amount:29900},
  {id:2,members:"Edmond & Arsène",amount:29900},
  {id:3,members:"Gilles & Cédric",amount:29900},
  {id:4,members:"Moresque & Morest",amount:29900},
  {id:5,members:"Romuald & Rufus",amount:29900},
  {id:6,members:"Franck & Dine & Mario & Patterson",amount:29900},
];

export default function App() {
  const [players,      setPlayers]      = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [payHistory,   setPayHistory]   = useState([]);
  const [isAdmin,      setIsAdmin]      = useState(false);
  const [pwInput,      setPwInput]      = useState("");
  const [pwError,      setPwError]      = useState(false);
  const [showLogin,    setShowLogin]    = useState(false);
  const [page,         setPage]         = useState("classement");
  const [statView,     setStatView]     = useState("goals");
  const [matchMode,    setMatchMode]    = useState(false);
  const [matchStep,    setMatchStep]    = useState("presence");
  const [matchDate,    setMatchDate]    = useState(todayISO());
  const [presentIds,   setPresentIds]   = useState([]);
  const [teamA,        setTeamA]        = useState([]);
  const [teamB,        setTeamB]        = useState([]);
  const [scoreA,       setScoreA]       = useState(0);
  const [scoreB,       setScoreB]       = useState(0);
  const [matchEvents,  setMatchEvents]  = useState([]);
  const [selPlayer,    setSelPlayer]    = useState("");
  const [selAssist,    setSelAssist]    = useState("");
  const [goalQty,      setGoalQty]      = useState(1);
  const [newName,      setNewName]      = useState("");
  const [loading,      setLoading]      = useState(true);
  const [flashId,      setFlashId]      = useState(null);
  const [editPlayer,   setEditPlayer]   = useState(null);
  const [selMatch,     setSelMatch]     = useState(null);
  const [groups,       setGroups]       = useState(INITIAL_GROUPS);
  const [newGroup,     setNewGroup]     = useState("");
  const [chartType,    setChartType]    = useState("line");
  const [hiddenP,      setHiddenP]      = useState([]);
  const [tooltip,      setTooltip]      = useState(null);
  const [showMail,     setShowMail]     = useState(false);
  const [mailText,     setMailText]     = useState("");

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"players"),s=>{setPlayers(s.docs.map(d=>({id:d.id,...d.data()})));setLoading(false);});
    const u2=onSnapshot(query(collection(db,"matches"),orderBy("timestamp","desc")),s=>setMatchHistory(s.docs.map(d=>({id:d.id,...d.data()}))));
    const u3=onSnapshot(query(collection(db,"payments"),orderBy("timestamp","desc")),s=>setPayHistory(s.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{u1();u2();u3();};
  },[]);

  const nextThursday  = getNextThursday();
  const curIdx        = getGroupIdx(nextThursday, groups.length);
  const curGroup      = groups[curIdx];
  const nextGroup     = groups[(curIdx+1)%groups.length];
  const nextNextGroup = groups[(curIdx+2)%groups.length];
  const thursdayLabel = nextThursday.toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});

  const withStats = players.map(p=>({...p,ratio:p.matches>0?parseFloat((p.goals/p.matches).toFixed(2)):0,streak:computeStreak(p.name,matchHistory)}));
  const sorted = (k) => {
    if (k==="ratio")  return [...withStats].sort((a,b)=>b.ratio-a.ratio||b.goals-a.goals);
    if (k==="streak") return [...withStats].sort((a,b)=>b.streak-a.streak||b.goals-a.goals);
    return [...withStats].sort((a,b)=>b[k]-a[k]||b.assists-a.assists);
  };
  const motmCounts = matchHistory.reduce((a,m)=>{const mo=getMotm(m);if(mo)a[mo.name]=(a[mo.name]||0)+1;return a;},{});
  const topMotm    = Object.entries(motmCounts).sort((a,b)=>b[1]-a[1])[0];
  const topStreak  = [...withStats].sort((a,b)=>b.streak-a.streak)[0];
  const totalGoals = matchHistory.reduce((s,m)=>s+(m.events?.length||0),0);
  const topScorer  = sorted("goals")[0];
  const topAssist  = sorted("assists")[0];
  const topRatio   = sorted("ratio")[0];
  const lineData   = buildLineData(players,matchHistory);
  const barData    = buildBarData(players,matchHistory);
  const curView    = STAT_VIEWS.find(v=>v.key===statView);

  const tryLogin = () => { if(pwInput===ADMIN_PASSWORD){setIsAdmin(true);setShowLogin(false);setPwError(false);setPwInput("");}else setPwError(true); };

  const addPlayer = async () => {
    if(!newName.trim()) return;
    if(players.find(p=>p.name.toLowerCase()===newName.trim().toLowerCase())){alert("Existe déjà!");return;}
    await addDoc(collection(db,"players"),{name:newName.trim(),goals:0,assists:0,matches:0});
    setNewName("");
  };
  const removePlayer = async (id) => { if(!window.confirm("Supprimer?")) return; await deleteDoc(doc(db,"players",id)); };
  const saveEdit = async () => {
    if(!editPlayer) return;
    await updateDoc(doc(db,"players",editPlayer.id),{goals:parseInt(editPlayer.goals)||0,assists:parseInt(editPlayer.assists)||0,matches:parseInt(editPlayer.matches)||0});
    setEditPlayer(null);
  };

  const toggleP   = (id) => setPresentIds(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const selectAll = () => setPresentIds(players.map(p=>p.id));
  const clearAll  = () => setPresentIds([]);

  const randomTeams = () => {
    const present=players.filter(p=>presentIds.includes(p.id));
    const sh=shuffle(present), half=Math.ceil(sh.length/2);
    setTeamA(sh.slice(0,half).map(p=>p.id));
    setTeamB(sh.slice(half).map(p=>p.id));
  };

  const addGoal = () => {
    if(!selPlayer) return;
    const qty=Math.max(1,parseInt(goalQty)||1);
    setMatchEvents(p=>[...p,...Array.from({length:qty},(_,i)=>({id:Date.now()+i,scorerId:selPlayer,assistId:qty===1&&selAssist?selAssist:null}))]);
    setSelPlayer("");setSelAssist("");setGoalQty(1);
  };
  const removeScorer = (sid) => setMatchEvents(p=>p.filter(e=>e.scorerId!==sid));

  const validateMatch = async () => {
    if(!presentIds.length) return;
    for (const p of players) {
      const ip=presentIds.includes(p.id),g=matchEvents.filter(e=>e.scorerId===p.id).length,a=matchEvents.filter(e=>e.assistId===p.id).length;
      if(ip||g>0||a>0) await updateDoc(doc(db,"players",p.id),{goals:p.goals+g,assists:p.assists+a,matches:p.matches+(ip?1:0)});
    }
    const motmCalc=matchEvents.length>0?getMotm({events:matchEvents.map(e=>({scorer:players.find(p=>p.id===e.scorerId)?.name||"?"}))}) :null;
    await addDoc(collection(db,"matches"),{
      timestamp:new Date(matchDate).getTime(), date:formatDate(matchDate),
      presentNames:presentIds.map(id=>players.find(p=>p.id===id)?.name||"?"),
      manOfMatch:motmCalc?.name||null,
      teamA:teamA.map(id=>players.find(p=>p.id===id)?.name||"?"),
      teamB:teamB.map(id=>players.find(p=>p.id===id)?.name||"?"),
      scoreA, scoreB,
      events:matchEvents.map(e=>({scorer:players.find(p=>p.id===e.scorerId)?.name||"?",assist:e.assistId?players.find(p=>p.id===e.assistId)?.name:null})),
    });
    const top=[...players].sort((a,b)=>b.goals-a.goals)[0];
    if(top){setFlashId(top.id);setTimeout(()=>setFlashId(null),1500);}
    setMatchEvents([]);setPresentIds([]);setTeamA([]);setTeamB([]);setScoreA(0);setScoreB(0);
    setMatchMode(false);setMatchStep("presence");setMatchDate(todayISO());
  };

  const deleteMatch = async (match) => {
    if(!window.confirm(`Supprimer le match du ${match.date}?`)) return;
    const sc={},as={},pn=new Set(match.presentNames||[]);
    for(const e of match.events||[]){sc[e.scorer]=(sc[e.scorer]||0)+1;if(e.assist)as[e.assist]=(as[e.assist]||0)+1;}
    for(const p of players){const g=sc[p.name]||0,a=as[p.name]||0,pl=pn.has(p.name)?1:0;if(g>0||a>0||pl>0)await updateDoc(doc(db,"players",p.id),{goals:Math.max(0,p.goals-g),assists:Math.max(0,p.assists-a),matches:Math.max(0,p.matches-pl)});}
    await deleteDoc(doc(db,"matches",match.id));
    setSelMatch(null);
  };

  const markPaid = async (group) => {
    await addDoc(collection(db,"payments"),{timestamp:Date.now(),date:new Date().toLocaleDateString("fr-FR"),groupName:group.members,amount:group.amount});
  };
  const deletePay = async (id) => { if(!window.confirm("Supprimer ce paiement?")) return; await deleteDoc(doc(db,"payments",id)); };

  const addGroup    = () => {if(!newGroup.trim())return;setGroups([...groups,{id:Date.now(),members:newGroup.trim(),amount:29900}]);setNewGroup("");};
  const removeGroup = (id) => {if(groups.length<=1)return;setGroups(groups.filter(g=>g.id!==id));};

  const generateMail = () => {
    const lastMatch=matchHistory[0], lastMotm=lastMatch?getMotm(lastMatch):null;
    let body=`Messieurs,\n\nVoici le bulletin officiel du Jeudi Football !\n\n`;
    body+=`🏆 CLASSEMENT DES BUTEURS\n`;
    sorted("goals").forEach((p,i)=>{
      const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":"  ";
      body+=`${medal} ${p.name} — ${p.goals} but${p.goals>1?"s":""} (${p.ratio.toFixed(2)} b/m)${p.streak>1?` 🔥${p.streak}`:""}\n`;
    });
    body+=`\n📊 STATISTIQUES\n`;
    body+=`• Matchs joués : ${matchHistory.length}\n`;
    body+=`• Buts marqués : ${totalGoals}\n`;
    body+=`• Moyenne : ${matchHistory.length>0?(totalGoals/matchHistory.length).toFixed(1):0} buts/match\n`;
    if (lastMatch) {
      body+=`\n⚽ DERNIER MATCH (${lastMatch.date})\n`;
      if (lastMatch.teamA?.length||lastMatch.teamB?.length) {
        body+=`• Score : ${lastMatch.scoreA} - ${lastMatch.scoreB}\n`;
        if(lastMatch.teamA?.length) body+=`• Équipe A : ${lastMatch.teamA.join(", ")}\n`;
        if(lastMatch.teamB?.length) body+=`• Équipe B : ${lastMatch.teamB.join(", ")}\n`;
      }
      if (lastMotm) body+=`• ⭐ Man of the Match : ${lastMotm.name} (${lastMotm.goals} buts)\n`;
    }
    body+=`\n💰 PAIEMENT CE JEUDI\n`;
    body+=`• Groupe : ${curGroup?.members}\n`;
    body+=`• Montant : ${curGroup?.amount.toLocaleString()} FCFA\n`;
    body+=`\n📱 Classement en direct : ${APP_URL}\n\nÀ ce soir les gars ! ⚽🔥`;
    setMailText(body);
    setShowMail(true);
  };

  const openMailClient = () => {
    const subject=encodeURIComponent("⚽ Bulletin Officiel du Jeudi Football 🏆");
    const body=encodeURIComponent(mailText);
    window.open(`mailto:${MAILING_LIST}?subject=${subject}&body=${body}`);
  };

  const toggleHidden = (n) => setHiddenP(p=>p.includes(n)?p.filter(x=>x!==n):[...p,n]);

  const renderLine = () => {
    const {months,series}=lineData;
    if(!months.length) return <div style={{textAlign:"center",padding:"40px 0",fontFamily:"sans-serif",color:C.textXlight,fontSize:14}}>Pas encore de données</div>;
    const W=520,H=200,PL=32,PR=16,PT=16,PB=32;
    const vis=series.filter(s=>!hiddenP.includes(s.name));
    const max=Math.max(...series.flatMap(s=>s.data),1);
    const gx=(i)=>PL+i*(W-PL-PR)/Math.max(months.length-1,1);
    const gy=(v)=>H-PB-v*(H-PT-PB)/max;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",overflow:"visible"}}>
        {[0,.25,.5,.75,1].map((t,i)=>{const y=gy(max*t);return(<g key={i}><line x1={PL} y1={y} x2={W-PR} y2={y} stroke={C.border} strokeWidth={0.5}/><text x={PL-4} y={y+4} fontSize={9} fill={C.textXlight} textAnchor="end">{Math.round(max*t)}</text></g>);})}
        {months.map((m,i)=><text key={m} x={gx(i)} y={H-4} fontSize={9} fill={C.textXlight} textAnchor="middle">{MOIS_FR[parseInt(m.split("-")[1])-1]}</text>)}
        {vis.map(s=>(
          <g key={s.name}>
            <polyline points={s.data.map((v,i)=>`${gx(i)},${gy(v)}`).join(" ")} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
            {s.data.map((v,i)=><circle key={i} cx={gx(i)} cy={gy(v)} r={3} fill={s.color} style={{cursor:"pointer"}} onMouseEnter={()=>setTooltip({name:s.name,month:months[i],value:v,color:s.color,x:gx(i),y:gy(v)})} onMouseLeave={()=>setTooltip(null)}/>)}
          </g>
        ))}
        {tooltip&&<g><rect x={tooltip.x-40} y={tooltip.y-36} width={80} height={28} rx={4} fill={tooltip.color} opacity={0.9}/><text x={tooltip.x} y={tooltip.y-26} fontSize={9} fill="#fff" textAnchor="middle" fontWeight="bold">{tooltip.name}</text><text x={tooltip.x} y={tooltip.y-14} fontSize={9} fill="#fff" textAnchor="middle">{tooltip.value} buts cumulés</text></g>}
      </svg>
    );
  };

  const renderBar = () => {
    const {months,series}=barData;
    if(!months.length) return <div style={{textAlign:"center",padding:"40px 0",fontFamily:"sans-serif",color:C.textXlight,fontSize:14}}>Pas encore de données</div>;
    const W=520,H=200,PL=32,PR=16,PT=16,PB=32;
    const vis=series.filter(s=>!hiddenP.includes(s.name));
    const max=Math.max(...barData.series.flatMap(s=>s.data),1);
    const ys=(H-PT-PB)/max,gW=(W-PL-PR)/months.length,bW=Math.max(2,(gW*.8)/Math.max(vis.length,1));
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",overflow:"visible"}}>
        {[0,.25,.5,.75,1].map((t,i)=>{const y=H-PB-max*t*ys;return(<g key={i}><line x1={PL} y1={y} x2={W-PR} y2={y} stroke={C.border} strokeWidth={0.5}/><text x={PL-4} y={y+4} fontSize={9} fill={C.textXlight} textAnchor="end">{Math.round(max*t)}</text></g>);})}
        {months.map((m,mi)=>{
          const gx=PL+mi*gW,gap=(gW-bW*vis.length)/2;
          return(<g key={m}>{vis.map((s,si)=>{const v=s.data[mi],bh=v*ys,bx=gx+gap+si*bW,by=H-PB-bh;return(<rect key={s.name} x={bx} y={by} width={bW-1} height={Math.max(bh,0)} fill={s.color} rx={2} style={{cursor:"pointer"}} onMouseEnter={()=>setTooltip({name:s.name,month:m,value:v,color:s.color,x:bx+bW/2,y:by})} onMouseLeave={()=>setTooltip(null)}/>);})}<text x={gx+gW/2} y={H-4} fontSize={9} fill={C.textXlight} textAnchor="middle">{MOIS_FR[parseInt(m.split("-")[1])-1]}</text></g>);
        })}
        {tooltip&&<g><rect x={tooltip.x-40} y={tooltip.y-36} width={80} height={28} rx={4} fill={tooltip.color} opacity={0.9}/><text x={tooltip.x} y={tooltip.y-26} fontSize={9} fill="#fff" textAnchor="middle" fontWeight="bold">{tooltip.name}</text><text x={tooltip.x} y={tooltip.y-14} fontSize={9} fill="#fff" textAnchor="middle">{tooltip.value} buts ce mois</text></g>}
      </svg>
    );
  };

  const presentPlayers=players.filter(p=>presentIds.includes(p.id));
  const groupedEvs=matchEvents.reduce((a,e)=>{
    const n=players.find(p=>p.id===e.scorerId)?.name||"?";
    if(!a[e.scorerId])a[e.scorerId]={name:n,count:0,assist:null};
    a[e.scorerId].count++;
    if(e.assistId)a[e.scorerId].assist=players.find(p=>p.id===e.assistId)?.name;
    return a;
  },{});

  const card={background:C.bgCard,borderRadius:14,border:`1px solid ${C.border}`,boxShadow:C.shadow,padding:"16px"};
  const startMatch=()=>{setMatchMode(true);setMatchStep("presence");setPage("classement");};
  const cancelMatch=()=>{setMatchMode(false);setMatchStep("presence");setMatchEvents([]);setPresentIds([]);setTeamA([]);setTeamB([]);setScoreA(0);setScoreB(0);setMatchDate(todayISO());};

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Bebas Neue',Impact,sans-serif",color:C.text}}>
      <div style={{maxWidth:600,margin:"0 auto",padding:"0 16px 100px"}}>

        {/* HEADER */}
        <div style={{textAlign:"center",padding:"32px 0 20px"}}>
          <div style={{fontSize:40,marginBottom:4}}>⚽</div>
          <h1 style={{fontSize:36,letterSpacing:5,margin:0,color:C.primary}}>JEUDI FOOTBALL</h1>
          <p style={{fontFamily:"sans-serif",fontSize:11,color:C.textXlight,letterSpacing:3,marginTop:4,textTransform:"uppercase"}}>CDC Bénin — Classement des guerriers</p>
          <div style={{marginTop:10}}>
            {isAdmin
              ?<span onClick={()=>setIsAdmin(false)} style={{cursor:"pointer",fontFamily:"sans-serif",fontSize:12,background:C.successBg,border:"1px solid #a7f3d0",color:C.success,padding:"5px 14px",borderRadius:20}}>✅ MODE ADMIN — Quitter</span>
              :<span onClick={()=>setShowLogin(true)} style={{cursor:"pointer",fontFamily:"sans-serif",fontSize:12,color:C.textXlight,letterSpacing:2}}>🔒 Accès admin</span>
            }
          </div>
        </div>

        {/* LOGIN MODAL */}
        {showLogin&&(
          <div style={OVL}>
            <div style={{...MBX,background:C.bgCard,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:32,marginBottom:8}}>🔒</div>
              <h3 style={{margin:"0 0 16px",fontSize:22,letterSpacing:3,color:C.primary}}>MOT DE PASSE</h3>
              <input type="password" value={pwInput} onChange={e=>{setPwInput(e.target.value);setPwError(false);}} onKeyDown={e=>e.key==="Enter"&&tryLogin()} placeholder="Mot de passe..." style={{...IS,width:"100%",marginBottom:8,textAlign:"center"}}/>
              {pwError&&<p style={{fontFamily:"sans-serif",color:C.danger,fontSize:13,margin:"0 0 8px"}}>Mot de passe incorrect</p>}
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button onClick={()=>{setShowLogin(false);setPwInput("");}} style={{...BS,flex:1}}>Annuler</button>
                <button onClick={tryLogin} style={{...BP,flex:1}}>Entrer</button>
              </div>
            </div>
          </div>
        )}

        {/* EDIT PLAYER MODAL */}
        {editPlayer&&(
          <div style={OVL}>
            <div style={{...MBX,background:C.bgCard,border:`1px solid ${C.border}`}}>
              <h3 style={{margin:"0 0 4px",fontSize:22,letterSpacing:3,color:C.primary}}>✏️ MODIFIER</h3>
              <p style={{fontFamily:"sans-serif",fontSize:14,color:C.primary,margin:"0 0 20px"}}>{players.find(p=>p.id===editPlayer.id)?.name}</p>
              {[["goals","⚽ Buts"],["assists","🎯 Passes"],["matches","📅 Matchs"]].map(([f,l])=>(
                <div key={f} style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                  <label style={{fontFamily:"sans-serif",fontSize:13,color:C.textMid,width:90,textAlign:"left"}}>{l}</label>
                  <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                    <button onClick={()=>setEditPlayer({...editPlayer,[f]:Math.max(0,(parseInt(editPlayer[f])||0)-1)})} style={{...BS,padding:"6px 14px",fontSize:18}}>−</button>
                    <input type="number" min="0" value={editPlayer[f]} onChange={e=>setEditPlayer({...editPlayer,[f]:e.target.value})} style={{...IS,width:60,textAlign:"center",padding:8}}/>
                    <button onClick={()=>setEditPlayer({...editPlayer,[f]:(parseInt(editPlayer[f])||0)+1})} style={{...BP,padding:"6px 14px",fontSize:18}}>+</button>
                  </div>
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:20}}>
                <button onClick={()=>setEditPlayer(null)} style={{...BS,flex:1}}>Annuler</button>
                <button onClick={saveEdit} style={{...BP,flex:1,fontSize:16,letterSpacing:2}}>✅ Sauvegarder</button>
              </div>
            </div>
          </div>
        )}

        {/* MATCH DETAIL MODAL */}
        {selMatch&&(()=>{
          const motm=getMotm(selMatch);
          return(
            <div style={OVL}>
              <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:16,padding:24,width:"100%",maxWidth:420,maxHeight:"85vh",overflowY:"auto",boxShadow:C.shadowMd}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div>
                    <div style={{fontSize:24,letterSpacing:3,color:C.primary}}>JEUDI</div>
                    <div style={{fontFamily:"sans-serif",fontSize:18,color:C.text,fontWeight:"bold"}}>{selMatch.date}</div>
                  </div>
                  <button onClick={()=>setSelMatch(null)} style={{...BS,padding:"6px 12px",fontSize:20}}>×</button>
                </div>
                {motm&&<div style={{background:"linear-gradient(135deg,#fffbeb,#fef3c7)",border:"1px solid #fde68a",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:32}}>⭐</span><div><div style={{fontFamily:"sans-serif",fontSize:10,color:C.gold,letterSpacing:2,textTransform:"uppercase",fontWeight:"bold"}}>Man of the Match</div><div style={{fontSize:22,letterSpacing:2,color:C.text}}>{motm.name}</div><div style={{fontFamily:"sans-serif",fontSize:12,color:C.textLight}}>{motm.goals} but{motm.goals>1?"s":""} ce soir</div></div></div>}
                {(selMatch.teamA?.length||selMatch.teamB?.length)&&(
                  <div style={{...card,marginBottom:16,background:"#f0f7ff",border:`1px solid ${C.borderBlue}`}}>
                    <div style={SL}>⚽ RÉSULTAT</div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <div style={{flex:1,textAlign:"center"}}><div style={{fontFamily:"sans-serif",fontSize:11,color:C.primary,marginBottom:4}}>ÉQUIPE A</div><div style={{fontFamily:"sans-serif",fontSize:11,color:C.textMid}}>{selMatch.teamA?.join(", ")}</div></div>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                        <div style={{fontSize:36,color:selMatch.scoreA>selMatch.scoreB?C.success:selMatch.scoreA<selMatch.scoreB?C.danger:C.textLight}}>{selMatch.scoreA}</div>
                        <div style={{fontFamily:"sans-serif",fontSize:16,color:C.textXlight}}>—</div>
                        <div style={{fontSize:36,color:selMatch.scoreB>selMatch.scoreA?C.success:selMatch.scoreB<selMatch.scoreA?C.danger:C.textLight}}>{selMatch.scoreB}</div>
                      </div>
                      <div style={{flex:1,textAlign:"center"}}><div style={{fontFamily:"sans-serif",fontSize:11,color:C.danger,marginBottom:4}}>ÉQUIPE B</div><div style={{fontFamily:"sans-serif",fontSize:11,color:C.textMid}}>{selMatch.teamB?.join(", ")}</div></div>
                    </div>
                    <div style={{textAlign:"center",fontFamily:"sans-serif",fontSize:12,color:selMatch.scoreA===selMatch.scoreB?C.textLight:C.success,fontWeight:"bold"}}>{selMatch.scoreA===selMatch.scoreB?"Match nul !":selMatch.scoreA>selMatch.scoreB?"Victoire Équipe A 🎉":"Victoire Équipe B 🎉"}</div>
                  </div>
                )}
                <div style={{display:"flex",gap:10,marginBottom:16}}>
                  {[{val:selMatch.presentNames?.length||0,label:"PRÉSENTS",color:C.success},{val:selMatch.events?.length||0,label:"BUTS",color:C.primary},{val:selMatch.events?.filter(e=>e.assist).length||0,label:"PASSES",color:C.purple}].map(s=>(
                    <div key={s.label} style={{flex:1,background:C.bgCard2,border:`1px solid ${C.border}`,borderRadius:10,padding:12,textAlign:"center"}}>
                      <div style={{fontSize:26,color:s.color,fontFamily:"'Bebas Neue',Impact,sans-serif"}}>{s.val}</div>
                      <div style={{fontFamily:"sans-serif",fontSize:10,color:C.textXlight,letterSpacing:1}}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {selMatch.presentNames?.length>0&&<><div style={SL}>👥 PRÉSENTS</div><div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>{selMatch.presentNames.map(n=><span key={n} style={{fontFamily:"sans-serif",fontSize:12,background:C.successBg,border:"1px solid #a7f3d0",color:C.success,padding:"4px 10px",borderRadius:20}}>{n}</span>)}</div></>}
                <div style={SL}>BUTEURS</div>
                {!selMatch.events?.length?<p style={{fontFamily:"sans-serif",fontSize:13,color:C.textLight}}>Aucun but</p>:
                  Object.entries((selMatch.events||[]).reduce((a,e)=>{if(!a[e.scorer])a[e.scorer]={goals:0,assists:[]};a[e.scorer].goals++;if(e.assist)a[e.scorer].assists.push(e.assist);return a;},{})).sort((a,b)=>b[1].goals-a[1].goals).map(([n,d],i)=>(
                    <div key={n} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:i===0?"#fffbeb":C.bgCard2,border:`1px solid ${i===0?"#fde68a":C.border}`,borderRadius:10,marginBottom:6}}>
                      <span style={{fontSize:18}}>{i===0?"⭐":"⚽"}</span>
                      <div style={{flex:1,fontFamily:"sans-serif"}}><div style={{fontSize:15,fontWeight:"bold",color:C.text}}>{n}</div>{d.assists.length>0&&<div style={{fontSize:11,color:C.textLight}}>Passes de : {d.assists.join(", ")}</div>}</div>
                      <div style={{fontSize:24,color:i===0?C.gold:C.primary,fontFamily:"'Bebas Neue',Impact,sans-serif"}}>{d.goals}</div>
                    </div>
                  ))
                }
                {isAdmin&&<button onClick={()=>deleteMatch(selMatch)} style={{width:"100%",marginTop:20,padding:12,background:C.dangerBg,border:"1px solid #fecaca",borderRadius:10,color:C.danger,fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,letterSpacing:2,cursor:"pointer"}}>🗑️ Supprimer ce match</button>}
              </div>
            </div>
          );
        })()}

        {/* MAIL MODAL */}
        {showMail&&(
          <div style={OVL}>
            <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:16,padding:24,width:"100%",maxWidth:520,maxHeight:"85vh",overflowY:"auto",boxShadow:C.shadowMd}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <h3 style={{margin:0,fontSize:22,letterSpacing:3,color:C.primary}}>📧 MAIL GÉNÉRÉ</h3>
                <button onClick={()=>setShowMail(false)} style={{...BS,padding:"6px 12px",fontSize:20}}>×</button>
              </div>
              <textarea value={mailText} onChange={e=>setMailText(e.target.value)} style={{width:"100%",height:300,padding:12,fontFamily:"sans-serif",fontSize:13,color:C.text,background:C.bgCard2,border:`1px solid ${C.border}`,borderRadius:10,outline:"none",resize:"vertical",lineHeight:1.5}}/>
              <div style={{display:"flex",gap:8,marginTop:12}}>
                <button onClick={()=>navigator.clipboard.writeText(mailText)} style={{...BS,flex:1,padding:12,fontSize:15}}>📋 Copier</button>
                <button onClick={openMailClient} style={{...BP,flex:1,padding:12,fontSize:15,letterSpacing:2}}>📧 Ouvrir Mail</button>
              </div>
            </div>
          </div>
        )}

        {/* ADMIN ACTIONS */}
        {isAdmin&&(
          <div style={{display:"flex",gap:10,marginBottom:20}}>
            <button onClick={matchMode?cancelMatch:startMatch} style={{flex:2,...(matchMode?BD:BP),padding:14,fontSize:18,letterSpacing:2}}>
              {matchMode?"❌ Annuler":"⚽ Nouveau match"}
            </button>
            <button onClick={generateMail} style={{flex:1,...BS,padding:14,fontSize:15,letterSpacing:1}}>📧 Mail</button>
          </div>
        )}

        {/* MATCH MODE */}
        {isAdmin&&matchMode&&(
          <div style={{...card,marginBottom:20,border:`1px solid ${C.borderBlue}`,background:"#f0f7ff"}}>
            {/* Progress bar */}
            <div style={{display:"flex",gap:8,marginBottom:20}}>
              {[["presence","1.Présence"],["equipes","2.Équipes"],["buts","3.Buts"],["validation","4.Valider"]].map(([s,l])=>{
                const si=STEPS.indexOf(s),ci=STEPS.indexOf(matchStep),done=si<ci,act=s===matchStep;
                return(<div key={s} style={{flex:1,textAlign:"center"}}><div style={{height:4,borderRadius:2,background:done?C.success:act?C.primary:C.border,marginBottom:4,transition:"background 0.3s"}}/><div style={{fontFamily:"sans-serif",fontSize:10,color:done?C.success:act?C.primary:C.textXlight}}>{l}</div></div>);
              })}
            </div>

            {/* STEP 1: PRESENCE */}
            {matchStep==="presence"&&(
              <>
                <h3 style={{margin:"0 0 6px",fontSize:20,letterSpacing:3,color:C.primary}}>👥 Qui a joué ?</h3>
                <div style={{marginBottom:14}}>
                  <label style={{fontFamily:"sans-serif",fontSize:12,color:C.textLight,letterSpacing:2,display:"block",marginBottom:6,textTransform:"uppercase"}}>📅 Date</label>
                  <input type="date" value={matchDate} onChange={e=>setMatchDate(e.target.value)} style={{...IS,width:"100%"}}/>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:12}}>
                  <button onClick={selectAll} style={{...BP,flex:1,padding:"8px",fontSize:14}}>✅ Tous</button>
                  <button onClick={clearAll}  style={{...BS,flex:1,padding:"8px",fontSize:14}}>❌ Aucun</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                  {players.map(p=>{const ip=presentIds.includes(p.id);return(<div key={p.id} onClick={()=>toggleP(p.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,background:ip?C.primaryLight:C.bgCard,border:`1px solid ${ip?C.borderBlue:C.border}`,cursor:"pointer",transition:"all 0.15s"}}><div style={{width:24,height:24,borderRadius:"50%",background:ip?C.primary:C.border,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{ip&&<span style={{color:"#fff",fontSize:14}}>✓</span>}</div><span style={{fontFamily:"sans-serif",fontSize:15,color:ip?C.primary:C.textMid,fontWeight:ip?"bold":"normal"}}>{p.name}</span></div>);})}
                </div>
                <div style={{fontFamily:"sans-serif",fontSize:13,color:C.textLight,textAlign:"center",marginBottom:12}}>{presentIds.length} joueur{presentIds.length>1?"s":""} sélectionné{presentIds.length>1?"s":""}</div>
                <button onClick={()=>setMatchStep("equipes")} disabled={!presentIds.length} style={{width:"100%",...BP,opacity:presentIds.length?1:0.4,fontSize:18,letterSpacing:2,padding:14}}>Suivant → Équipes</button>
              </>
            )}

            {/* STEP 2: ÉQUIPES */}
            {matchStep==="equipes"&&(
              <>
                <h3 style={{margin:"0 0 6px",fontSize:20,letterSpacing:3,color:C.primary}}>🏃 Équipes & Score</h3>
                <button onClick={randomTeams} style={{width:"100%",...BP,padding:12,fontSize:16,letterSpacing:2,marginBottom:16}}>🎲 Tirer au sort</button>
                <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:16}}>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"sans-serif",fontSize:11,color:C.primary,letterSpacing:2,marginBottom:8,textTransform:"uppercase",fontWeight:"bold",textAlign:"center"}}>ÉQUIPE A</div>
                    {teamA.map(id=>{const p=players.find(x=>x.id===id);return p?(<div key={id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",background:C.primaryLight,border:`1px solid ${C.borderBlue}`,borderRadius:8,marginBottom:4,fontFamily:"sans-serif",fontSize:12}}><span>{p.name}</span><button onClick={()=>{setTeamA(t=>t.filter(x=>x!==id));setTeamB(t=>[...t,id]);}} style={{background:"none",border:"none",cursor:"pointer",color:C.textLight,fontSize:14}}>→</button></div>):null;})}
                  </div>
                  <div style={{flexShrink:0,textAlign:"center",paddingTop:24}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{textAlign:"center"}}>
                        <button onClick={()=>setScoreA(s=>Math.max(0,s-1))} style={{...BS,padding:"4px 10px",fontSize:14,display:"block",width:"100%",marginBottom:4}}>−</button>
                        <div style={{fontSize:32,color:C.primary,minWidth:32,textAlign:"center"}}>{scoreA}</div>
                        <button onClick={()=>setScoreA(s=>s+1)} style={{...BP,padding:"4px 10px",fontSize:14,display:"block",width:"100%",marginTop:4}}>+</button>
                      </div>
                      <div style={{fontFamily:"sans-serif",fontSize:18,color:C.textXlight}}>:</div>
                      <div style={{textAlign:"center"}}>
                        <button onClick={()=>setScoreB(s=>Math.max(0,s-1))} style={{...BS,padding:"4px 10px",fontSize:14,display:"block",width:"100%",marginBottom:4}}>−</button>
                        <div style={{fontSize:32,color:C.primary,minWidth:32,textAlign:"center"}}>{scoreB}</div>
                        <button onClick={()=>setScoreB(s=>s+1)} style={{...BP,padding:"4px 10px",fontSize:14,display:"block",width:"100%",marginTop:4}}>+</button>
                      </div>
                    </div>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"sans-serif",fontSize:11,color:C.danger,letterSpacing:2,marginBottom:8,textTransform:"uppercase",fontWeight:"bold",textAlign:"center"}}>ÉQUIPE B</div>
                    {teamB.map(id=>{const p=players.find(x=>x.id===id);return p?(<div key={id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,marginBottom:4,fontFamily:"sans-serif",fontSize:12}}><button onClick={()=>{setTeamB(t=>t.filter(x=>x!==id));setTeamA(t=>[...t,id]);}} style={{background:"none",border:"none",cursor:"pointer",color:C.textLight,fontSize:14}}>←</button><span>{p.name}</span></div>):null;})}
                  </div>
                </div>
                {presentPlayers.filter(p=>!teamA.includes(p.id)&&!teamB.includes(p.id)).length>0&&(
                  <div style={{marginBottom:12}}>
                    <div style={{...SL,marginBottom:6}}>NON ASSIGNÉS</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {presentPlayers.filter(p=>!teamA.includes(p.id)&&!teamB.includes(p.id)).map(p=>(
                        <div key={p.id} style={{display:"flex",gap:4,alignItems:"center"}}>
                          <button onClick={()=>setTeamA(t=>[...t,p.id])} style={{...BS,padding:"4px 8px",fontSize:11}}>A</button>
                          <span style={{fontFamily:"sans-serif",fontSize:12,color:C.textMid}}>{p.name}</span>
                          <button onClick={()=>setTeamB(t=>[...t,p.id])} style={{...BS,padding:"4px 8px",fontSize:11}}>B</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setMatchStep("presence")} style={{...BS,flex:1,padding:12,fontSize:15}}>← Retour</button>
                  <button onClick={()=>setMatchStep("buts")} style={{...BP,flex:2,padding:12,fontSize:16,letterSpacing:2}}>Suivant → Buts</button>
                </div>
              </>
            )}

            {/* STEP 3: BUTS */}
            {matchStep==="buts"&&(
              <>
                <h3 style={{margin:"0 0 6px",fontSize:20,letterSpacing:3,color:C.primary}}>⚽ Buts marqués</h3>
                <p style={{fontFamily:"sans-serif",fontSize:13,color:C.textLight,margin:"0 0 14px"}}>{presentIds.length} présents · {matchEvents.length} but{matchEvents.length>1?"s":""}</p>
                <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                  <select value={selPlayer} onChange={e=>setSelPlayer(e.target.value)} style={SS}>
                    <option value="">Buteur *</option>
                    {presentPlayers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <label style={{fontFamily:"sans-serif",fontSize:13,color:C.textMid,whiteSpace:"nowrap"}}>Nombre de buts :</label>
                    <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                      <button onClick={()=>setGoalQty(q=>Math.max(1,q-1))} style={{...BS,padding:"10px 18px",fontSize:20}}>−</button>
                      <span style={{fontFamily:"sans-serif",fontSize:26,fontWeight:"bold",minWidth:36,textAlign:"center",color:C.primary}}>{goalQty}</span>
                      <button onClick={()=>setGoalQty(q=>q+1)} style={{...BP,padding:"10px 18px",fontSize:20}}>+</button>
                    </div>
                  </div>
                  {goalQty===1
                    ?<select value={selAssist} onChange={e=>setSelAssist(e.target.value)} style={SS}><option value="">Passeur (optionnel)</option>{presentPlayers.filter(p=>p.id!==selPlayer).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
                    :<p style={{fontFamily:"sans-serif",fontSize:12,color:C.textLight,margin:0,textAlign:"center"}}>Pour les passeurs, ajouter 1 but à la fois</p>
                  }
                  <button onClick={addGoal} disabled={!selPlayer} style={{width:"100%",padding:12,background:selPlayer?C.accent:C.border,border:"none",borderRadius:10,color:selPlayer?"#fff":C.textLight,fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:17,letterSpacing:2,cursor:selPlayer?"pointer":"not-allowed"}}>
                    + Ajouter {goalQty>1?`${goalQty} buts`:"le but"}
                  </button>
                </div>
                {matchEvents.length>0&&(
                  <div style={{marginBottom:16}}>
                    <div style={{...SL,marginBottom:8}}>BUTS SAISIS ({matchEvents.length})</div>
                    {Object.values(groupedEvs).map(({name,count,assist})=>(
                      <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:C.primaryLight,border:`1px solid ${C.borderBlue}`,borderRadius:8,marginBottom:6,fontFamily:"sans-serif",fontSize:14}}>
                        <span style={{color:C.text}}>⚽ <strong>{name}</strong>{count>1&&<span style={{color:C.primary,marginLeft:6}}>×{count}</span>}{assist&&<span style={{color:C.textLight,marginLeft:6}}>← {assist}</span>}</span>
                        <button onClick={()=>removeScorer(Object.keys(groupedEvs).find(id=>groupedEvs[id].name===name))} style={{background:"none",border:"none",color:C.danger,cursor:"pointer",fontSize:20}}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setMatchStep("equipes")} style={{...BS,flex:1,padding:12,fontSize:15}}>← Équipes</button>
                  <button onClick={()=>setMatchStep("validation")} style={{...BP,flex:2,padding:12,fontSize:16,letterSpacing:2}}>Suivant → Valider</button>
                </div>
              </>
            )}

            {/* STEP 4: VALIDATION */}
            {matchStep==="validation"&&(
              <>
                <h3 style={{margin:"0 0 16px",fontSize:20,letterSpacing:3,color:C.primary}}>✅ Récapitulatif</h3>
                {(teamA.length||teamB.length)?<div style={{...card,marginBottom:12,background:"#f0f7ff",border:`1px solid ${C.borderBlue}`}}><div style={{...SL,marginBottom:8}}>⚽ SCORE</div><div style={{display:"flex",justifyContent:"space-around",alignItems:"center"}}><div style={{textAlign:"center"}}><div style={{fontFamily:"sans-serif",fontSize:11,color:C.primary,marginBottom:4}}>ÉQUIPE A</div><div style={{fontSize:32,color:C.primary}}>{scoreA}</div></div><div style={{fontFamily:"sans-serif",fontSize:18,color:C.textXlight}}>vs</div><div style={{textAlign:"center"}}><div style={{fontFamily:"sans-serif",fontSize:11,color:C.danger,marginBottom:4}}>ÉQUIPE B</div><div style={{fontSize:32,color:C.danger}}>{scoreB}</div></div></div></div>:null}
                <div style={{...card,marginBottom:12,background:C.successBg,border:"1px solid #a7f3d0"}}>
                  <div style={{...SL,marginBottom:8}}>👥 PRÉSENTS ({presentIds.length})</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{presentIds.map(id=>{const p=players.find(x=>x.id===id);return <span key={id} style={{fontFamily:"sans-serif",fontSize:12,background:"#fff",border:"1px solid #a7f3d0",color:C.success,padding:"3px 10px",borderRadius:20}}>{p?.name}</span>;})}</div>
                </div>
                <div style={{...card,marginBottom:16}}>
                  <div style={{...SL,marginBottom:8}}>⚽ BUTS ({matchEvents.length})</div>
                  {matchEvents.length===0?<p style={{fontFamily:"sans-serif",fontSize:13,color:C.textLight,margin:0}}>Aucun but saisi</p>:Object.values(groupedEvs).map(({name,count,assist})=>(<div key={name} style={{fontFamily:"sans-serif",fontSize:14,color:C.textMid,marginBottom:4}}>⚽ <strong>{name}</strong>{count>1&&<span style={{color:C.primary}}> ×{count}</span>}{assist&&<span style={{color:C.textLight}}> ← {assist}</span>}</div>))}
                  {matchEvents.length>0&&(()=>{const m=getMotm({events:matchEvents.map(e=>({scorer:players.find(p=>p.id===e.scorerId)?.name||"?"}))});return m?<div style={{marginTop:12,padding:"8px 12px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,fontFamily:"sans-serif",fontSize:13,color:C.gold}}>⭐ Man of the Match : <strong>{m.name}</strong></div>:null;})()}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setMatchStep("buts")} style={{...BS,flex:1,padding:12,fontSize:15}}>← Buts</button>
                  <button onClick={validateMatch} style={{...BP,flex:2,padding:14,fontSize:18,letterSpacing:2}}>✅ Valider le match</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════ CLASSEMENT ════ */}
        {page==="classement"&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:20}}>
              {STAT_VIEWS.map(v=><button key={v.key} onClick={()=>setStatView(v.key)} style={{padding:"10px 4px",background:statView===v.key?v.color:C.bgCard,border:`1px solid ${statView===v.key?v.color:C.border}`,borderRadius:10,color:statView===v.key?"#fff":C.textLight,fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:13,letterSpacing:1,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,boxShadow:C.shadow}}><span style={{fontSize:18}}>{v.icon}</span>{v.label}</button>)}
            </div>
            <div style={{marginBottom:28}}>
              {loading?<div style={{textAlign:"center",padding:"40px 0",fontFamily:"sans-serif",color:C.textXlight}}>Chargement...</div>:
                sorted(statView).map((p,i)=>{
                  const rank=i+1,isTop3=rank<=3&&(statView==="ratio"?p.ratio>0:statView==="streak"?p.streak>0:p[statView]>0);
                  const val=statView==="ratio"?p.ratio.toFixed(2):statView==="streak"?p.streak:p[statView];
                  return(
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",marginBottom:8,borderRadius:14,background:flashId===p.id?"#dbeafe":isTop3?(rank===1?"#fffbeb":rank===2?"#f9fafb":"#fff7ed"):C.bgCard,border:`1px solid ${isTop3?(rank===1?"#fde68a":rank===2?"#e5e7eb":"#fed7aa"):C.border}`,boxShadow:C.shadow,transition:"all 0.3s"}}>
                      <div style={{width:32,textAlign:"center",fontSize:isTop3?22:14,fontFamily:"sans-serif",color:positionColors[rank]||C.textXlight,fontWeight:"bold",flexShrink:0}}>{isTop3?trophyIcon(rank):rank}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:20,letterSpacing:2,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}{p.streak>0&&statView!=="streak"&&<span style={{fontFamily:"sans-serif",fontSize:11,color:C.danger,marginLeft:8}}>🔥{p.streak}</span>}</div>
                        <div style={{fontFamily:"sans-serif",fontSize:11,color:C.textXlight,letterSpacing:1,marginTop:2}}>{p.goals}G · {p.assists}A · {p.matches}M · {p.ratio.toFixed(2)}b/m</div>
                      </div>
                      <div style={{fontSize:30,color:val>0?(isTop3?positionColors[rank]:curView.color):C.border,minWidth:56,textAlign:"right",flexShrink:0}}>
                        {val}<span style={{fontSize:11,fontFamily:"sans-serif",display:"block",color:C.textXlight,letterSpacing:1}}>{curView.unit}</span>
                      </div>
                      {isAdmin&&<div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
                        <button onClick={()=>setEditPlayer({id:p.id,goals:p.goals,assists:p.assists,matches:p.matches})} style={{background:C.bgCard2,border:`1px solid ${C.border}`,borderRadius:6,color:C.textMid,cursor:"pointer",fontSize:13,padding:"4px 8px"}}>✏️</button>
                        <button onClick={()=>removePlayer(p.id)} style={{background:"none",border:"none",color:C.textXlight,cursor:"pointer",fontSize:16,padding:"4px 8px"}}>×</button>
                      </div>}
                    </div>
                  );
                })
              }
            </div>
            {isAdmin&&<div style={{...card,border:`1px dashed ${C.borderBlue}`}}><div style={{...SL,marginBottom:10}}>AJOUTER UN JOUEUR</div><div style={{display:"flex",gap:10}}><input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlayer()} placeholder="Nom du joueur..." style={{...IS,flex:1}}/><button onClick={addPlayer} style={{...BP,padding:"12px 20px",fontSize:20}}>+</button></div></div>}
          </>
        )}

        {/* ════ GRAPHIQUES ════ */}
        {page==="graphiques"&&(
          <div>
            <div style={{display:"flex",background:C.bgCard,borderRadius:12,padding:4,marginBottom:20,border:`1px solid ${C.border}`,boxShadow:C.shadow}}>
              {[["line","📈 Évolution cumulative"],["bar","📊 Buts par mois"]].map(([t,l])=><button key={t} onClick={()=>setChartType(t)} style={{flex:1,padding:"10px 8px",background:chartType===t?C.primary:"transparent",border:chartType===t?"none":`1px solid ${C.border}`,borderRadius:10,color:chartType===t?"#fff":C.textLight,fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:15,letterSpacing:1,cursor:"pointer"}}>{l}</button>)}
            </div>
            <div style={{...card,marginBottom:20,overflowX:"auto"}}>{chartType==="line"?renderLine():renderBar()}</div>
            <div style={{...SL,marginBottom:10}}>LÉGENDE — cliquer pour masquer</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
              {players.map((p,i)=>{const c=CHART_COLORS[i%CHART_COLORS.length],h=hiddenP.includes(p.name);return(<button key={p.id} onClick={()=>toggleHidden(p.name)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:h?"#f3f4f6":c+"18",border:`1px solid ${h?C.border:c}`,borderRadius:20,cursor:"pointer",opacity:h?0.5:1}}><div style={{width:10,height:10,borderRadius:"50%",background:h?C.border:c}}/><span style={{fontFamily:"sans-serif",fontSize:12,color:h?C.textXlight:c,fontWeight:"bold"}}>{p.name}</span></button>);})}
            </div>
            {(()=>{
              const now=new Date(),cm=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
              const mm=matchHistory.filter(m=>{const d=new Date(m.timestamp);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`===cm;});
              if(!mm.length) return null;
              const sc=mm.reduce((a,m)=>{m.events?.forEach(e=>{a[e.scorer]=(a[e.scorer]||0)+1;});return a;},{});
              const top=Object.entries(sc).sort((a,b)=>b[1]-a[1])[0];
              if(!top) return null;
              return(<div style={{background:`linear-gradient(135deg,${C.primary},${C.accent})`,borderRadius:14,padding:"16px 20px",marginBottom:20,display:"flex",alignItems:"center",gap:14,boxShadow:C.shadowMd}}><span style={{fontSize:36}}>🏅</span><div><div style={{fontFamily:"sans-serif",fontSize:11,color:"rgba(255,255,255,0.7)",letterSpacing:2,textTransform:"uppercase"}}>Meilleur buteur de {MOIS_FR[now.getMonth()]}</div><div style={{fontSize:26,letterSpacing:3,color:"#fff"}}>{top[0]}</div><div style={{fontFamily:"sans-serif",fontSize:13,color:"rgba(255,255,255,0.7)"}}>{top[1]} but{top[1]>1?"s":""} ce mois</div></div></div>);
            })()}
            <div style={SL}>STATS PAR MOIS</div>
            <div style={{...card,overflowX:"auto",marginTop:10}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"sans-serif",fontSize:13}}>
                <thead><tr style={{borderBottom:`2px solid ${C.border}`}}><th style={{textAlign:"left",padding:"8px 6px",color:C.textLight,fontSize:11,fontWeight:"normal"}}>JOUEUR</th>{barData.months.map(m=><th key={m} style={{textAlign:"center",padding:"8px 4px",color:C.textLight,fontSize:11,fontWeight:"normal",minWidth:36}}>{MOIS_FR[parseInt(m.split("-")[1])-1]}</th>)}<th style={{textAlign:"center",padding:"8px 6px",color:C.primary,fontSize:11,fontWeight:"bold"}}>TOT</th></tr></thead>
                <tbody>
                  {barData.series.sort((a,b)=>b.data.reduce((s,v)=>s+v,0)-a.data.reduce((s,v)=>s+v,0)).map(s=>{
                    const total=s.data.reduce((sum,v)=>sum+v,0),color=CHART_COLORS[players.findIndex(p=>p.name===s.name)%CHART_COLORS.length],maxM=Math.max(...s.data,1);
                    return(<tr key={s.name} style={{borderBottom:`1px solid ${C.border}`}}><td style={{padding:"8px 6px",color:C.text,fontWeight:"bold"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:color}}/>{s.name}</div></td>{s.data.map((v,i)=><td key={i} style={{textAlign:"center",padding:"8px 4px"}}>{v>0?<span style={{background:color,color:"#fff",borderRadius:6,padding:"2px 6px",fontSize:12,fontWeight:"bold",opacity:0.5+0.5*(v/maxM)}}>{v}</span>:<span style={{color:C.textXlight}}>—</span>}</td>)}<td style={{textAlign:"center",padding:"8px 6px",fontWeight:"bold",color:C.primary,fontSize:15}}>{total}</td></tr>);
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════ SCORE ════ */}
        {page==="score"&&(
          <div>
            <div style={{...SL,marginBottom:14}}>RÉSULTATS DES MATCHS</div>
            {matchHistory.filter(m=>m.teamA?.length||m.teamB?.length).length===0
              ?<div style={{textAlign:"center",padding:"40px 0",fontFamily:"sans-serif",color:C.textXlight,fontSize:14}}>Aucun match avec score enregistré</div>
              :matchHistory.filter(m=>m.teamA?.length||m.teamB?.length).map((m)=>{
                  const motm=getMotm(m),winA=m.scoreA>m.scoreB,winB=m.scoreB>m.scoreA,draw=m.scoreA===m.scoreB;
                  return(
                    <div key={m.id} onClick={()=>setSelMatch(m)} style={{...card,marginBottom:10,cursor:"pointer",transition:"box-shadow 0.2s"}} onMouseEnter={e=>e.currentTarget.style.boxShadow=C.shadowMd} onMouseLeave={e=>e.currentTarget.style.boxShadow=C.shadow}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                        <div style={{fontFamily:"sans-serif",fontSize:11,color:C.textXlight}}>{m.date}</div>
                        <div style={{fontFamily:"sans-serif",fontSize:11,color:draw?C.textLight:C.success,fontWeight:"bold"}}>{draw?"Match nul":winA?"Victoire A 🎉":"Victoire B 🎉"}</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1}}><div style={{fontFamily:"sans-serif",fontSize:11,color:winA?C.success:C.textLight,fontWeight:"bold",marginBottom:4}}>ÉQUIPE A</div><div style={{fontFamily:"sans-serif",fontSize:11,color:C.textMid,lineHeight:1.4}}>{m.teamA?.join(", ")}</div></div>
                        <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,padding:"6px 12px",background:C.bgCard2,borderRadius:10,border:`1px solid ${C.border}`}}>
                          <span style={{fontSize:28,color:winA?C.success:winB?C.danger:C.textLight,fontFamily:"'Bebas Neue',Impact,sans-serif"}}>{m.scoreA}</span>
                          <span style={{fontFamily:"sans-serif",color:C.textXlight}}>—</span>
                          <span style={{fontSize:28,color:winB?C.success:winA?C.danger:C.textLight,fontFamily:"'Bebas Neue',Impact,sans-serif"}}>{m.scoreB}</span>
                        </div>
                        <div style={{flex:1,textAlign:"right"}}><div style={{fontFamily:"sans-serif",fontSize:11,color:winB?C.success:C.textLight,fontWeight:"bold",marginBottom:4}}>ÉQUIPE B</div><div style={{fontFamily:"sans-serif",fontSize:11,color:C.textMid,lineHeight:1.4}}>{m.teamB?.join(", ")}</div></div>
                      </div>
                      {motm&&<div style={{marginTop:8,fontFamily:"sans-serif",fontSize:11,color:C.gold,textAlign:"center"}}>⭐ MOTM : {motm.name} ({motm.goals} buts)</div>}
                    </div>
                  );
                })
            }
            {matchHistory.filter(m=>m.teamA?.length||m.teamB?.length).length>0&&(()=>{
              const matches=matchHistory.filter(m=>m.teamA?.length||m.teamB?.length);
              const wA=matches.filter(m=>m.scoreA>m.scoreB).length,wB=matches.filter(m=>m.scoreB>m.scoreA).length,dr=matches.filter(m=>m.scoreA===m.scoreB).length;
              return(<div style={{...card,marginTop:8}}><div style={{...SL,marginBottom:12}}>📊 RECORD</div><div style={{display:"flex",gap:10,textAlign:"center"}}>{[{l:"Victoires A",v:wA,c:C.success},{l:"Nuls",v:dr,c:C.textLight},{l:"Victoires B",v:wB,c:C.danger}].map(s=><div key={s.l} style={{flex:1,background:C.bgCard2,borderRadius:10,padding:12}}><div style={{fontSize:30,color:s.c,fontFamily:"'Bebas Neue',Impact,sans-serif"}}>{s.v}</div><div style={{fontFamily:"sans-serif",fontSize:10,color:C.textXlight,letterSpacing:1}}>{s.l}</div></div>)}</div></div>);
            })()}
          </div>
        )}

        {/* ════ PAIEMENT ════ */}
        {page==="paiement"&&(
          <div>
            <div style={{background:`linear-gradient(135deg,${C.primary},${C.accent})`,borderRadius:16,padding:24,marginBottom:16,textAlign:"center",boxShadow:C.shadowMd}}>
              <div style={{fontFamily:"sans-serif",fontSize:11,color:"rgba(255,255,255,0.7)",letterSpacing:3,marginBottom:8,textTransform:"uppercase"}}>💰 Paiement ce jeudi</div>
              <div style={{fontFamily:"sans-serif",fontSize:13,color:"rgba(255,255,255,0.7)",marginBottom:8}}>{thursdayLabel}</div>
              <div style={{fontSize:26,letterSpacing:2,color:"#fff",marginBottom:6}}>{curGroup?.members}</div>
              <div style={{fontSize:34,color:"#fff",fontFamily:"'Bebas Neue',Impact,sans-serif"}}>{curGroup?.amount.toLocaleString()} <span style={{fontSize:16,color:"rgba(255,255,255,0.6)"}}>FCFA</span></div>
              {isAdmin&&<button onClick={()=>markPaid(curGroup)} style={{marginTop:12,padding:"8px 20px",background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:20,color:"#fff",fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:16,letterSpacing:2,cursor:"pointer"}}>✅ Marquer comme payé</button>}
            </div>
            <div style={{...SL,marginBottom:10}}>PROCHAINS GROUPES</div>
            {[{label:"Semaine prochaine",group:nextGroup},{label:"Dans 2 semaines",group:nextNextGroup}].map(({label,group})=>(
              <div key={label} style={{...card,display:"flex",alignItems:"center",gap:14,marginBottom:8}}>
                <div style={{flex:1}}><div style={{fontFamily:"sans-serif",fontSize:11,color:C.textXlight,letterSpacing:1,marginBottom:4,textTransform:"uppercase"}}>{label}</div><div style={{fontSize:18,letterSpacing:1,color:C.text}}>{group?.members}</div></div>
                <div style={{fontFamily:"sans-serif",fontSize:14,color:C.textLight}}>{group?.amount.toLocaleString()} FCFA</div>
              </div>
            ))}
            <div style={{...SL,margin:"20px 0 10px"}}>PLANNING COMPLET</div>
            {groups.map((g,i)=>{
              const isCur=i===curIdx;
              return(<div key={g.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",marginBottom:6,borderRadius:12,background:isCur?C.primaryLight:C.bgCard,border:`1px solid ${isCur?C.borderBlue:C.border}`,boxShadow:C.shadow}}>
                <div style={{fontSize:18,width:28,textAlign:"center",flexShrink:0}}>{isCur?"👉":`${i+1}.`}</div>
                <div style={{flex:1,fontFamily:"sans-serif",fontSize:14,color:isCur?C.primary:C.textMid,fontWeight:isCur?"bold":"normal"}}>{g.members}</div>
                {isCur&&<div style={{fontFamily:"sans-serif",fontSize:11,color:C.primary,letterSpacing:1,fontWeight:"bold"}}>CE JEUDI</div>}
                {isAdmin&&<button onClick={()=>removeGroup(g.id)} style={{background:"none",border:"none",color:C.textXlight,cursor:"pointer",fontSize:16,padding:"0 4px",flexShrink:0}}>×</button>}
              </div>);
            })}
            {isAdmin&&<div style={{...card,border:`1px dashed ${C.borderBlue}`,marginTop:16}}><div style={{...SL,marginBottom:10}}>AJOUTER UN GROUPE</div><div style={{display:"flex",gap:10}}><input value={newGroup} onChange={e=>setNewGroup(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGroup()} placeholder="Ex: Paul & Léon..." style={{...IS,flex:1}}/><button onClick={addGroup} style={{...BP,padding:"12px 20px",fontSize:20}}>+</button></div></div>}
            {payHistory.length>0&&<div style={{marginTop:20}}>
              <div style={SL}>📋 HISTORIQUE DES PAIEMENTS</div>
              {payHistory.map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",marginBottom:6,borderRadius:12,background:C.successBg,border:"1px solid #a7f3d0",boxShadow:C.shadow}}>
                  <span style={{fontSize:20}}>✅</span>
                  <div style={{flex:1}}><div style={{fontFamily:"sans-serif",fontSize:14,color:C.text,fontWeight:"bold"}}>{p.groupName}</div><div style={{fontFamily:"sans-serif",fontSize:11,color:C.textLight}}>{p.date}</div></div>
                  <div style={{fontFamily:"sans-serif",fontSize:14,color:C.success,fontWeight:"bold"}}>{p.amount?.toLocaleString()} FCFA</div>
                  {isAdmin&&<button onClick={()=>deletePay(p.id)} style={{background:"none",border:"none",color:C.textXlight,cursor:"pointer",fontSize:16,padding:"0 4px"}}>×</button>}
                </div>
              ))}
            </div>}
          </div>
        )}

        {/* ════ RÉCAPITULATIF ════ */}
        {page==="recapitulatif"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
              {[{label:"MATCHS JOUÉS",value:matchHistory.length,color:C.primary,icon:"📅"},{label:"BUTS MARQUÉS",value:totalGoals,color:C.accent,icon:"⚽"},{label:"JOUEURS",value:players.length,color:C.gold,icon:"👥"},{label:"MOY. BUTS/MATCH",value:matchHistory.length>0?(totalGoals/matchHistory.length).toFixed(1):"0",color:C.purple,icon:"📊"}].map(s=>(
                <div key={s.label} style={{...card,textAlign:"center"}}><div style={{fontSize:28,marginBottom:4}}>{s.icon}</div><div style={{fontSize:34,color:s.color,fontFamily:"'Bebas Neue',Impact,sans-serif"}}>{s.value}</div><div style={{fontFamily:"sans-serif",fontSize:10,color:C.textXlight,letterSpacing:2,marginTop:2}}>{s.label}</div></div>
              ))}
            </div>
            {(topScorer?.goals>0||topMotm||topStreak?.streak>0)&&(
              <div style={{marginBottom:20}}>
                <div style={SL}>🏆 TROPHÉES</div>
                {[
                  topScorer?.goals>0   &&{label:"Meilleur buteur",   player:topScorer, stat:topScorer.goals,           unit:"buts",    color:C.gold,   icon:"⚽",bg:"#fffbeb",bd:"#fde68a"},
                  topAssist?.assists>0 &&{label:"Meilleur passeur",  player:topAssist, stat:topAssist.assists,         unit:"passes",  color:C.purple, icon:"🎯",bg:C.purpleBg,bd:C.purpleBorder},
                  topRatio?.ratio>0    &&{label:"Meill. efficacité", player:topRatio,  stat:topRatio.ratio.toFixed(2), unit:"b/m",     color:C.orange, icon:"📈",bg:C.orangeBg,bd:C.orangeBorder},
                  topMotm              &&{label:"Roi du MOTM",       player:{name:topMotm[0]},stat:topMotm[1],         unit:"MOTM",    color:C.gold,   icon:"⭐",bg:"#fffbeb",bd:"#fde68a"},
                  topStreak?.streak>0  &&{label:"Série en cours",    player:topStreak, stat:topStreak.streak,          unit:"matchs🔥",color:C.danger, icon:"🔥",bg:C.dangerBg,bd:"#fecaca"},
                ].filter(Boolean).map(item=>(
                  <div key={item.label} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",marginBottom:8,borderRadius:14,background:item.bg,border:`1px solid ${item.bd}`,boxShadow:C.shadow}}>
                    <span style={{fontSize:28}}>{item.icon}</span>
                    <div style={{flex:1}}><div style={{fontFamily:"sans-serif",fontSize:11,color:C.textLight,letterSpacing:2,textTransform:"uppercase"}}>{item.label}</div><div style={{fontSize:22,letterSpacing:2,color:C.text}}>{item.player.name}</div></div>
                    <div style={{fontSize:34,color:item.color,fontFamily:"'Bebas Neue',Impact,sans-serif"}}>{item.stat}<span style={{fontFamily:"sans-serif",fontSize:11,display:"block",color:C.textXlight}}>{item.unit}</span></div>
                  </div>
                ))}
              </div>
            )}
            <div style={SL}>📋 TABLEAU COMPLET</div>
            <div style={{background:C.bgCard,borderRadius:14,overflow:"hidden",border:`1px solid ${C.border}`,boxShadow:C.shadow,marginTop:10}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 48px 48px 56px 56px",padding:"10px 12px",borderBottom:`1px solid ${C.border}`,background:C.bgCard2}}>
                {["JOUEUR","⚽","🎯","B/M","🔥"].map(h=><div key={h} style={{fontFamily:"sans-serif",fontSize:11,color:C.textLight,letterSpacing:1,textAlign:h==="JOUEUR"?"left":"center"}}>{h}</div>)}
              </div>
              {sorted("goals").map((p,i)=>(
                <div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr 48px 48px 56px 56px",padding:"12px 12px",borderBottom:`1px solid ${C.border}`,background:i%2===0?C.bgCard:C.bgCard2}}>
                  <div style={{fontFamily:"sans-serif",fontSize:14,color:C.text,display:"flex",alignItems:"center",gap:4}}>{i<3&&p.goals>0&&<span>{trophyIcon(i+1)}</span>}{p.name}</div>
                  <div style={{fontFamily:"sans-serif",fontSize:15,color:C.primary,textAlign:"center",fontWeight:"bold"}}>{p.goals}</div>
                  <div style={{fontFamily:"sans-serif",fontSize:15,color:C.purple,textAlign:"center",fontWeight:"bold"}}>{p.assists}</div>
                  <div style={{fontFamily:"sans-serif",fontSize:13,color:C.orange,textAlign:"center",fontWeight:"bold"}}>{p.ratio.toFixed(2)}</div>
                  <div style={{fontFamily:"sans-serif",fontSize:13,color:p.streak>0?C.danger:C.textXlight,textAlign:"center",fontWeight:"bold"}}>{p.streak>0?`🔥${p.streak}`:"—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════ MATCHS ════ */}
        {page==="matchs"&&(
          <div>
            <div style={{...SL,marginBottom:14}}>{matchHistory.length} MATCH{matchHistory.length>1?"S":""} ENREGISTRÉ{matchHistory.length>1?"S":""}</div>
            {matchHistory.length===0?<div style={{textAlign:"center",padding:"40px 0",fontFamily:"sans-serif",color:C.textXlight,fontSize:14}}>Aucun match enregistré</div>:
              matchHistory.map((m,i)=>{
                const motm=getMotm(m),us=[...new Set(m.events?.map(e=>e.scorer)||[])],hasScore=m.teamA?.length||m.teamB?.length;
                return(
                  <div key={m.id} onClick={()=>setSelMatch(m)} style={{...card,display:"flex",alignItems:"center",gap:14,marginBottom:10,cursor:"pointer",transition:"box-shadow 0.2s"}} onMouseEnter={e=>e.currentTarget.style.boxShadow=C.shadowMd} onMouseLeave={e=>e.currentTarget.style.boxShadow=C.shadow}>
                    <div style={{textAlign:"center",flexShrink:0,minWidth:40}}><div style={{fontSize:22,color:C.primary,fontFamily:"'Bebas Neue',Impact,sans-serif"}}>J{matchHistory.length-i}</div><div style={{fontFamily:"sans-serif",fontSize:11,color:C.textXlight,whiteSpace:"nowrap"}}>{m.date}</div></div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"sans-serif",fontSize:12,color:C.success,marginBottom:2}}>👥 {m.presentNames?.length||0} présents</div>
                      {motm&&<div style={{fontFamily:"sans-serif",fontSize:11,color:C.gold,marginBottom:2}}>⭐ {motm.name} ({motm.goals} buts)</div>}
                      {hasScore&&<div style={{fontFamily:"sans-serif",fontSize:11,color:C.primary,marginBottom:2}}>Score : {m.scoreA} — {m.scoreB}</div>}
                      <div style={{fontFamily:"sans-serif",fontSize:12,color:C.textMid,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{us.slice(0,3).join(", ")}{us.length>3?` +${us.length-3}`:""}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:26,color:C.primary,fontFamily:"'Bebas Neue',Impact,sans-serif"}}>{m.events?.length}</div><div style={{fontFamily:"sans-serif",fontSize:10,color:C.textXlight}}>BUTS</div></div>
                    <div style={{color:C.textXlight,fontSize:20,flexShrink:0}}>›</div>
                  </div>
                );
              })
            }
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:`1px solid ${C.border}`,display:"flex",zIndex:50,boxShadow:"0 -2px 12px rgba(0,0,0,0.06)"}}>
        {NAV.map(n=>(
          <button key={n} onClick={()=>{setPage(n);setMatchMode(false);}} style={{flex:1,padding:"10px 2px 14px",background:"none",border:"none",color:page===n?C.primary:C.textXlight,fontFamily:"'Bebas Neue',Impact,sans-serif",fontSize:9,letterSpacing:0.5,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,transition:"color 0.2s"}}>
            <span style={{fontSize:16}}>{NAV_ICONS[n]}</span>
            {NAV_LABELS[n]}
            {page===n&&<div style={{width:16,height:3,background:C.primary,borderRadius:2,marginTop:2}}/>}
          </button>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: #9ca3af; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
        input[type=date]::-webkit-calendar-picker-indicator { opacity: 0.5; }
        select option { background: #fff; color: #111; }
      `}</style>
    </div>
  );
}

const IS  = {padding:"12px 16px",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,color:"#111827",fontFamily:"sans-serif",fontSize:14,outline:"none"};
const SS  = {width:"100%",padding:"12px 16px",background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,color:"#111827",fontFamily:"sans-serif",fontSize:14,outline:"none",cursor:"pointer"};
const BP  = {background:"linear-gradient(135deg,#1a56db,#2563eb)",border:"none",borderRadius:10,color:"#fff",fontFamily:"'Bebas Neue',Impact,sans-serif",cursor:"pointer",padding:12};
const BS  = {background:"#f3f4f6",border:"1px solid #e5e7eb",borderRadius:10,color:"#374151",fontFamily:"'Bebas Neue',Impact,sans-serif",cursor:"pointer",padding:12};
const BD  = {background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,color:"#dc2626",fontFamily:"'Bebas Neue',Impact,sans-serif",cursor:"pointer",padding:12};
const OVL = {position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16};
const MBX = {borderRadius:16,padding:28,width:"100%",maxWidth:360,textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,0.15)"};
const SL  = {fontFamily:"sans-serif",fontSize:11,color:"#9ca3af",letterSpacing:2,textTransform:"uppercase",marginBottom:8,display:"block"};
