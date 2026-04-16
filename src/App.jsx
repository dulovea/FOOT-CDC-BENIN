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

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const C = {
  bg: "#f0f4fa", bgCard: "#ffffff", bgCard2: "#f8faff",
  primary: "#1a56db", primaryDark: "#1340a8", primaryLight: "#dbeafe",
  accent: "#2563eb", gold: "#d97706", silver: "#6b7280", bronze: "#92400e",
  text: "#111827", textMid: "#374151", textLight: "#6b7280", textXlight: "#9ca3af",
  border: "#e5e7eb", borderBlue: "#bfdbfe",
  danger: "#dc2626", dangerBg: "#fef2f2", success: "#059669", successBg: "#ecfdf5",
  shadow: "0 1px 4px rgba(0,0,0,0.08)", shadowMd: "0 4px 16px rgba(0,0,0,0.10)",
  orange: "#ea580c", orangeBg: "#fff7ed", orangeBorder: "#fed7aa",
  purple: "#7c3aed", purpleBg: "#f5f3ff", purpleBorder: "#ddd6fe",
};

// Palette de couleurs pour les graphiques (un par joueur)
const CHART_COLORS = [
  "#1a56db","#dc2626","#059669","#d97706","#7c3aed",
  "#0891b2","#be185d","#65a30d","#c2410c","#4338ca",
  "#0f766e","#b45309","#9333ea","#0369a1","#15803d",
];

const positionColors = { 1: C.gold, 2: C.silver, 3: C.bronze };
const trophyIcon = (r) => ({ 1: "🥇", 2: "🥈", 3: "🥉" }[r] || null);
const NAV        = ["classement", "graphiques", "paiement", "recapitulatif", "matchs"];
const NAV_LABELS = { classement: "Classement", graphiques: "Stats", paiement: "Paiement", recapitulatif: "Récap", matchs: "Matchs" };

const formatDate   = (isoDate) => { if (!isoDate) return ""; const [y,m,d] = isoDate.split("-"); return `${d}/${m}/${y}`; };
const todayISO     = () => new Date().toISOString().split("T")[0];
const MOIS_FR      = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

const getGroupIndexForDate = (date, totalGroups) => {
  if (totalGroups === 0) return 0;
  const msPerWeek = 7*24*60*60*1000;
  const weeksDiff = Math.round((date - FIRST_MATCH_DATE) / msPerWeek);
  return (((weeksDiff+1) % totalGroups) + totalGroups) % totalGroups;
};
const getNextThursday = () => {
  const d = new Date(); const day = d.getDay();
  const daysUntil = (4-day+7)%7===0 ? 0 : (4-day+7)%7;
  d.setDate(d.getDate()+daysUntil); return d;
};
const computeStreak = (playerName, matchHistory) => {
  const sorted = [...matchHistory].sort((a,b) => b.timestamp - a.timestamp);
  let streak = 0;
  for (const match of sorted) {
    const present = match.presentNames?.includes(playerName);
    if (!present) continue;
    if (match.events?.some(e => e.scorer === playerName)) { streak++; } else { break; }
  }
  return streak;
};
const getManOfTheMatch = (match) => {
  if (!match.events?.length) return null;
  const counts = match.events.reduce((acc,e) => { acc[e.scorer]=(acc[e.scorer]||0)+1; return acc; }, {});
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  return sorted.length ? { name: sorted[0][0], goals: sorted[0][1] } : null;
};

// ── Données pour le graphique courbe (cumul buts par mois par joueur) ──
const buildLineData = (players, matchHistory) => {
  if (!matchHistory.length) return { months: [], series: [] };

  // Tous les mois uniques triés
  const monthSet = new Set();
  matchHistory.forEach(m => {
    const d = new Date(m.timestamp);
    monthSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  });
  const months = Array.from(monthSet).sort();

  // Pour chaque joueur, cumul des buts mois par mois
  const series = players.map((p, idx) => {
    let cumul = 0;
    const data = months.map(month => {
      const monthMatches = matchHistory.filter(m => {
        const d = new Date(m.timestamp);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` === month;
      });
      monthMatches.forEach(m => {
        cumul += m.events?.filter(e => e.scorer === p.name).length || 0;
      });
      return cumul;
    });
    return { name: p.name, data, color: CHART_COLORS[idx % CHART_COLORS.length] };
  });

  return { months, series };
};

// ── Données pour le graphique barres (buts par mois) ──
const buildBarData = (players, matchHistory) => {
  if (!matchHistory.length) return { months: [], series: [] };

  const monthSet = new Set();
  matchHistory.forEach(m => {
    const d = new Date(m.timestamp);
    monthSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);
  });
  const months = Array.from(monthSet).sort();

  const series = players.map((p, idx) => {
    const data = months.map(month => {
      const monthMatches = matchHistory.filter(m => {
        const d = new Date(m.timestamp);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` === month;
      });
      return monthMatches.reduce((sum, m) => sum + (m.events?.filter(e => e.scorer === p.name).length || 0), 0);
    });
    return { name: p.name, data, color: CHART_COLORS[idx % CHART_COLORS.length] };
  });

  return { months, series };
};

const INITIAL_GROUPS = [
  { id: 1, members: "Dulove & Laurencio",                amount: 29900 },
  { id: 2, members: "Edmond & Arsène",                   amount: 29900 },
  { id: 3, members: "Gilles & Cédric",                   amount: 29900 },
  { id: 4, members: "Moresque & Morest",                 amount: 29900 },
  { id: 5, members: "Romuald & Rufus",                   amount: 29900 },
  { id: 6, members: "Franck & Dine & Mario & Patterson", amount: 29900 },
];

const STEPS = ["presence","buts","validation"];

export default function FootballTracker() {
  const [players,        setPlayers]        = useState([]);
  const [matchHistory,   setMatchHistory]   = useState([]);
  const [isAdmin,        setIsAdmin]        = useState(false);
  const [passwordInput,  setPasswordInput]  = useState("");
  const [passwordError,  setPasswordError]  = useState(false);
  const [showLogin,      setShowLogin]      = useState(false);
  const [page,           setPage]           = useState("classement");
  const [activeTab,      setActiveTab]      = useState("buteurs");
  const [matchMode,      setMatchMode]      = useState(false);
  const [matchStep,      setMatchStep]      = useState("presence");
  const [matchDate,      setMatchDate]      = useState(todayISO());
  const [presentIds,     setPresentIds]     = useState([]);
  const [matchEvents,    setMatchEvents]    = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedAssist, setSelectedAssist] = useState("");
  const [goalQty,        setGoalQty]        = useState(1);
  const [newName,        setNewName]        = useState("");
  const [loading,        setLoading]        = useState(true);
  const [flashId,        setFlashId]        = useState(null);
  const [editingPlayer,  setEditingPlayer]  = useState(null);
  const [selectedMatch,  setSelectedMatch]  = useState(null);
  const [groups,         setGroups]         = useState(INITIAL_GROUPS);
  const [newGroupName,   setNewGroupName]   = useState("");
  const [statView,       setStatView]       = useState("goals");
  const [chartType,      setChartType]      = useState("line"); // line | bar
  const [hiddenPlayers,  setHiddenPlayers]  = useState([]); // joueurs masqués sur le graphique
  const [tooltipData,    setTooltipData]    = useState(null);

  useEffect(() => {
    const unsubPlayers = onSnapshot(collection(db, "players"), snap => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubHistory = onSnapshot(
      query(collection(db, "matches"), orderBy("timestamp","desc")),
      snap => setMatchHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubPlayers(); unsubHistory(); };
  }, []);

  const nextThursday      = getNextThursday();
  const currentIdx        = getGroupIndexForDate(nextThursday, groups.length);
  const currentGroup      = groups[currentIdx];
  const nextGroup         = groups[(currentIdx+1) % groups.length];
  const nextNextGroup     = groups[(currentIdx+2) % groups.length];
  const nextThursdayLabel = nextThursday.toLocaleDateString("fr-FR", { day:"2-digit", month:"long", year:"numeric" });

  const playersWithStats = players.map(p => ({
    ...p,
    ratio:  p.matches > 0 ? parseFloat((p.goals/p.matches).toFixed(2)) : 0,
    streak: computeStreak(p.name, matchHistory),
  }));

  const sorted = (key) => {
    if (key === "ratio")  return [...playersWithStats].sort((a,b) => b.ratio  - a.ratio  || b.goals - a.goals);
    if (key === "streak") return [...playersWithStats].sort((a,b) => b.streak - a.streak || b.goals - a.goals);
    return [...playersWithStats].sort((a,b) => b[key] - a[key] || b.assists - a.assists);
  };

  const motmCounts = matchHistory.reduce((acc,m) => {
    const motm = getManOfTheMatch(m);
    if (motm) acc[motm.name] = (acc[motm.name]||0)+1;
    return acc;
  }, {});
  const topMotm    = Object.entries(motmCounts).sort((a,b)=>b[1]-a[1])[0];
  const topStreak  = [...playersWithStats].sort((a,b)=>b.streak-a.streak)[0];
  const totalGoals = matchHistory.reduce((s,m) => s+(m.events?.length||0),0);
  const topScorer  = sorted("goals")[0];
  const topAssist  = sorted("assists")[0];
  const topRatio   = sorted("ratio")[0];

  // Données graphiques
  const lineData = buildLineData(players, matchHistory);
  const barData  = buildBarData(players, matchHistory);

  const toggleHidden = (name) => setHiddenPlayers(prev => prev.includes(name) ? prev.filter(n=>n!==name) : [...prev,name]);

  // ── Rendu SVG courbe ──
  const renderLineChart = () => {
    const { months, series } = lineData;
    if (!months.length) return <div style={{ textAlign:"center", padding:"40px 0", fontFamily:"sans-serif", color:C.textXlight, fontSize:14 }}>Pas encore de données</div>;

    const W=520, H=200, PL=32, PR=16, PT=16, PB=32;
    const visibleSeries = series.filter(s => !hiddenPlayers.includes(s.name));
    const maxVal = Math.max(...series.flatMap(s=>s.data), 1);
    const xStep  = (W-PL-PR) / Math.max(months.length-1, 1);
    const yScale = (H-PT-PB) / maxVal;

    const getX = (i) => PL + i*xStep;
    const getY = (v) => H - PB - v*yScale;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", overflow:"visible" }}>
        {/* Grille horizontale */}
        {[0,0.25,0.5,0.75,1].map((t,i) => {
          const y = getY(maxVal*t);
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W-PR} y2={y} stroke={C.border} strokeWidth={0.5} />
              <text x={PL-4} y={y+4} fontSize={9} fill={C.textXlight} textAnchor="end">{Math.round(maxVal*t)}</text>
            </g>
          );
        })}
        {/* Axe X */}
        {months.map((m,i) => (
          <text key={m} x={getX(i)} y={H-4} fontSize={9} fill={C.textXlight} textAnchor="middle">
            {MOIS_FR[parseInt(m.split("-")[1])-1]}
          </text>
        ))}
        {/* Courbes */}
        {visibleSeries.map(s => {
          const points = s.data.map((v,i) => `${getX(i)},${getY(v)}`).join(" ");
          return (
            <g key={s.name}>
              <polyline points={points} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {s.data.map((v,i) => (
                <circle key={i} cx={getX(i)} cy={getY(v)} r={3} fill={s.color}
                  style={{ cursor:"pointer" }}
                  onMouseEnter={() => setTooltipData({ name:s.name, month:months[i], value:v, color:s.color, x:getX(i), y:getY(v) })}
                  onMouseLeave={() => setTooltipData(null)}
                />
              ))}
            </g>
          );
        })}
        {/* Tooltip */}
        {tooltipData && (
          <g>
            <rect x={tooltipData.x-40} y={tooltipData.y-36} width={80} height={28} rx={4} fill={tooltipData.color} opacity={0.9} />
            <text x={tooltipData.x} y={tooltipData.y-26} fontSize={9} fill="#fff" textAnchor="middle" fontWeight="bold">{tooltipData.name}</text>
            <text x={tooltipData.x} y={tooltipData.y-14} fontSize={9} fill="#fff" textAnchor="middle">{tooltipData.value} buts cumulés</text>
          </g>
        )}
      </svg>
    );
  };

  // ── Rendu SVG barres groupées ──
  const renderBarChart = () => {
    const { months, series } = barData;
    if (!months.length) return <div style={{ textAlign:"center", padding:"40px 0", fontFamily:"sans-serif", color:C.textXlight, fontSize:14 }}>Pas encore de données</div>;

    const visibleSeries = series.filter(s => !hiddenPlayers.includes(s.name));
    const W=520, H=200, PL=32, PR=16, PT=16, PB=32;
    const maxVal = Math.max(...barData.series.flatMap(s=>s.data), 1);
    const yScale = (H-PT-PB) / maxVal;
    const groupW = (W-PL-PR) / months.length;
    const barW   = Math.max(2, (groupW*0.8) / Math.max(visibleSeries.length,1));
    const gap    = (groupW - barW*visibleSeries.length) / 2;

    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto", overflow:"visible" }}>
        {[0,0.25,0.5,0.75,1].map((t,i) => {
          const y = H-PB-maxVal*t*yScale;
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W-PR} y2={y} stroke={C.border} strokeWidth={0.5} />
              <text x={PL-4} y={y+4} fontSize={9} fill={C.textXlight} textAnchor="end">{Math.round(maxVal*t)}</text>
            </g>
          );
        })}
        {months.map((m,mi) => {
          const gx = PL + mi*groupW;
          return (
            <g key={m}>
              {visibleSeries.map((s,si) => {
                const v  = s.data[mi];
                const bh = v*yScale;
                const bx = gx+gap+si*barW;
                const by = H-PB-bh;
                return (
                  <rect key={s.name} x={bx} y={by} width={barW-1} height={bh} fill={s.color} rx={2} style={{ cursor:"pointer" }}
                    onMouseEnter={() => setTooltipData({ name:s.name, month:m, value:v, color:s.color, x:bx+barW/2, y:by })}
                    onMouseLeave={() => setTooltipData(null)}
                  />
                );
              })}
              <text x={gx+groupW/2} y={H-4} fontSize={9} fill={C.textXlight} textAnchor="middle">
                {MOIS_FR[parseInt(m.split("-")[1])-1]}
              </text>
            </g>
          );
        })}
        {tooltipData && (
          <g>
            <rect x={tooltipData.x-40} y={tooltipData.y-36} width={80} height={28} rx={4} fill={tooltipData.color} opacity={0.9} />
            <text x={tooltipData.x} y={tooltipData.y-26} fontSize={9} fill="#fff" textAnchor="middle" fontWeight="bold">{tooltipData.name}</text>
            <text x={tooltipData.x} y={tooltipData.y-14} fontSize={9} fill="#fff" textAnchor="middle">{tooltipData.value} buts ce mois</text>
          </g>
        )}
      </svg>
    );
  };

  const tryLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) { setIsAdmin(true); setShowLogin(false); setPasswordError(false); setPasswordInput(""); }
    else { setPasswordError(true); }
  };
  const addPlayer = async () => {
    if (!newName.trim()) return;
    if (players.find(p=>p.name.toLowerCase()===newName.trim().toLowerCase())) { alert("Ce joueur existe déjà !"); return; }
    await addDoc(collection(db,"players"), { name:newName.trim(), goals:0, assists:0, matches:0 });
    setNewName("");
  };
  const removePlayer   = async (id) => { if (!window.confirm("Supprimer ce joueur ?")) return; await deleteDoc(doc(db,"players",id)); };
  const togglePresence = (id) => setPresentIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);
  const selectAll = () => setPresentIds(players.map(p=>p.id));
  const clearAll  = () => setPresentIds([]);
  const addGoalEvent = () => {
    if (!selectedPlayer) return;
    const qty = Math.max(1,parseInt(goalQty)||1);
    const events = Array.from({length:qty},(_,i)=>({ id:Date.now()+i, scorerId:selectedPlayer, assistId:qty===1&&selectedAssist?selectedAssist:null }));
    setMatchEvents(prev=>[...prev,...events]);
    setSelectedPlayer(""); setSelectedAssist(""); setGoalQty(1);
  };
  const removeScorer = (scorerId) => setMatchEvents(prev=>prev.filter(e=>e.scorerId!==scorerId));
  const validateMatch = async () => {
    if (presentIds.length===0) return;
    for (const player of players) {
      const isPresent = presentIds.includes(player.id);
      const goals     = matchEvents.filter(e=>e.scorerId===player.id).length;
      const assists   = matchEvents.filter(e=>e.assistId===player.id).length;
      if (isPresent||goals>0||assists>0) {
        await updateDoc(doc(db,"players",player.id),{ goals:player.goals+goals, assists:player.assists+assists, matches:player.matches+(isPresent?1:0) });
      }
    }
    const motmCalc = matchEvents.length>0 ? getManOfTheMatch({ events:matchEvents.map(e=>({ scorer:players.find(p=>p.id===e.scorerId)?.name||"?" })) }) : null;
    await addDoc(collection(db,"matches"),{
      timestamp:    new Date(matchDate).getTime(),
      date:         formatDate(matchDate),
      presentNames: presentIds.map(id=>players.find(p=>p.id===id)?.name||"?"),
      manOfMatch:   motmCalc?.name||null,
      events:       matchEvents.map(e=>({ scorer:players.find(p=>p.id===e.scorerId)?.name||"?", assist:e.assistId?players.find(p=>p.id===e.assistId)?.name:null })),
    });
    const top = [...players].sort((a,b)=>b.goals-a.goals)[0];
    if (top) { setFlashId(top.id); setTimeout(()=>setFlashId(null),1500); }
    setMatchEvents([]); setPresentIds([]); setMatchMode(false); setMatchStep("presence"); setMatchDate(todayISO());
  };
  const deleteMatch = async (match) => {
    if (!window.confirm(`Supprimer le match du ${match.date} ?`)) return;
    const sc={}, as={}, pn=new Set(match.presentNames||[]);
    for (const e of match.events||[]) { sc[e.scorer]=(sc[e.scorer]||0)+1; if(e.assist) as[e.assist]=(as[e.assist]||0)+1; }
    for (const p of players) {
      const g=sc[p.name]||0, a=as[p.name]||0, pl=pn.has(p.name)?1:0;
      if (g>0||a>0||pl>0) await updateDoc(doc(db,"players",p.id),{ goals:Math.max(0,p.goals-g), assists:Math.max(0,p.assists-a), matches:Math.max(0,p.matches-pl) });
    }
    await deleteDoc(doc(db,"matches",match.id));
    setSelectedMatch(null);
  };
  const saveEditPlayer = async () => {
    if (!editingPlayer) return;
    await updateDoc(doc(db,"players",editingPlayer.id),{ goals:parseInt(editingPlayer.goals)||0, assists:parseInt(editingPlayer.assists)||0, matches:parseInt(editingPlayer.matches)||0 });
    setEditingPlayer(null);
  };
  const addGroup    = () => { if (!newGroupName.trim()) return; setGroups([...groups,{id:Date.now(),members:newGroupName.trim(),amount:29900}]); setNewGroupName(""); };
  const removeGroup = (id) => { if (groups.length<=1) return; setGroups(groups.filter(g=>g.id!==id)); };

  const presentPlayers = players.filter(p=>presentIds.includes(p.id));
  const groupedEvents  = matchEvents.reduce((acc,e)=>{
    const name=players.find(p=>p.id===e.scorerId)?.name||"?";
    if (!acc[e.scorerId]) acc[e.scorerId]={name,count:0,assist:null};
    acc[e.scorerId].count++;
    if (e.assistId) acc[e.scorerId].assist=players.find(p=>p.id===e.assistId)?.name;
    return acc;
  },{});

  const card = { background:C.bgCard, borderRadius:14, border:`1px solid ${C.border}`, boxShadow:C.shadow, padding:"16px" };
  const STAT_VIEWS = [
    { key:"goals",   icon:"⚽", label:"Buts",   color:C.primary, unit:"buts"   },
    { key:"assists", icon:"🎯", label:"Passes", color:C.purple,  unit:"passes" },
    { key:"ratio",   icon:"📈", label:"Ratio",  color:C.orange,  unit:"b/m"    },
    { key:"streak",  icon:"🔥", label:"Série",  color:C.danger,  unit:"matchs" },
  ];
  const currentView = STAT_VIEWS.find(v=>v.key===statView);
  const startMatch  = () => { setMatchMode(true); setMatchStep("presence"); setPage("classement"); };
  const cancelMatch = () => { setMatchMode(false); setMatchStep("presence"); setMatchEvents([]); setPresentIds([]); setMatchDate(todayISO()); };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Bebas Neue', Impact, sans-serif", color:C.text }}>
      <div style={{ maxWidth:600, margin:"0 auto", padding:"0 16px 100px" }}>

        {/* HEADER */}
        <div style={{ textAlign:"center", padding:"36px 0 24px" }}>
          <div style={{ fontSize:44, marginBottom:4 }}>⚽</div>
          <h1 style={{ fontSize:38, letterSpacing:5, margin:0, color:C.primary }}>JEUDI FOOTBALL</h1>
          <p style={{ fontFamily:"sans-serif", fontSize:12, color:C.textXlight, letterSpacing:3, marginTop:4, textTransform:"uppercase" }}>Classement des guerriers du jeudi</p>
          <div style={{ marginTop:12 }}>
            {isAdmin
              ? <span onClick={()=>setIsAdmin(false)} style={{ cursor:"pointer", fontFamily:"sans-serif", fontSize:12, background:C.successBg, border:"1px solid #a7f3d0", color:C.success, padding:"5px 14px", borderRadius:20, letterSpacing:1 }}>✅ MODE ADMIN — Quitter</span>
              : <span onClick={()=>setShowLogin(true)} style={{ cursor:"pointer", fontFamily:"sans-serif", fontSize:12, color:C.textXlight, letterSpacing:2 }}>🔒 Accès admin</span>
            }
          </div>
        </div>

        {/* LOGIN MODAL */}
        {showLogin && (
          <div style={modalOverlay}>
            <div style={{ ...modalBox, background:C.bgCard, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🔒</div>
              <h3 style={{ margin:"0 0 16px", fontSize:22, letterSpacing:3, color:C.primary }}>MOT DE PASSE</h3>
              <input type="password" value={passwordInput} onChange={e=>{setPasswordInput(e.target.value);setPasswordError(false);}} onKeyDown={e=>e.key==="Enter"&&tryLogin()} placeholder="Mot de passe..." style={{ ...inputStyle, width:"100%", marginBottom:8, textAlign:"center" }} />
              {passwordError && <p style={{ fontFamily:"sans-serif", color:C.danger, fontSize:13, margin:"0 0 8px" }}>Mot de passe incorrect</p>}
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <button onClick={()=>{setShowLogin(false);setPasswordInput("");}} style={{ ...btnSec, flex:1 }}>Annuler</button>
                <button onClick={tryLogin} style={{ ...btnPri, flex:1 }}>Entrer</button>
              </div>
            </div>
          </div>
        )}

        {/* EDIT PLAYER MODAL */}
        {editingPlayer && (
          <div style={modalOverlay}>
            <div style={{ ...modalBox, background:C.bgCard, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:28, marginBottom:4 }}>✏️</div>
              <h3 style={{ margin:"0 0 4px", fontSize:22, letterSpacing:3, color:C.primary }}>MODIFIER</h3>
              <p style={{ fontFamily:"sans-serif", fontSize:14, color:C.primary, margin:"0 0 20px" }}>{players.find(p=>p.id===editingPlayer.id)?.name}</p>
              {[["goals","⚽ Buts"],["assists","🎯 Passes"],["matches","📅 Matchs"]].map(([field,label])=>(
                <div key={field} style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
                  <label style={{ fontFamily:"sans-serif", fontSize:13, color:C.textMid, width:90, textAlign:"left" }}>{label}</label>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flex:1 }}>
                    <button onClick={()=>setEditingPlayer({...editingPlayer,[field]:Math.max(0,(parseInt(editingPlayer[field])||0)-1)})} style={{ ...btnSec, padding:"6px 14px", fontSize:18 }}>−</button>
                    <input type="number" min="0" value={editingPlayer[field]} onChange={e=>setEditingPlayer({...editingPlayer,[field]:e.target.value})} style={{ ...inputStyle, width:60, textAlign:"center", padding:8 }} />
                    <button onClick={()=>setEditingPlayer({...editingPlayer,[field]:(parseInt(editingPlayer[field])||0)+1})} style={{ ...btnPri, padding:"6px 14px", fontSize:18 }}>+</button>
                  </div>
                </div>
              ))}
              <div style={{ display:"flex", gap:8, marginTop:20 }}>
                <button onClick={()=>setEditingPlayer(null)} style={{ ...btnSec, flex:1 }}>Annuler</button>
                <button onClick={saveEditPlayer} style={{ ...btnPri, flex:1, fontSize:16, letterSpacing:2 }}>✅ Sauvegarder</button>
              </div>
            </div>
          </div>
        )}

        {/* MATCH DETAIL MODAL */}
        {selectedMatch && (()=>{
          const motm = getManOfTheMatch(selectedMatch);
          return (
            <div style={modalOverlay}>
              <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:16, padding:24, width:"100%", maxWidth:420, maxHeight:"85vh", overflowY:"auto", boxShadow:C.shadowMd }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:24, letterSpacing:3, color:C.primary }}>JEUDI</div>
                    <div style={{ fontFamily:"sans-serif", fontSize:18, color:C.text, fontWeight:"bold" }}>{selectedMatch.date}</div>
                  </div>
                  <button onClick={()=>setSelectedMatch(null)} style={{ ...btnSec, padding:"6px 12px", fontSize:20 }}>×</button>
                </div>
                {motm && (
                  <div style={{ background:"linear-gradient(135deg,#fffbeb,#fef3c7)", border:"1px solid #fde68a", borderRadius:12, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:32 }}>⭐</span>
                    <div>
                      <div style={{ fontFamily:"sans-serif", fontSize:10, color:C.gold, letterSpacing:2, textTransform:"uppercase", fontWeight:"bold" }}>Man of the Match</div>
                      <div style={{ fontSize:22, letterSpacing:2, color:C.text }}>{motm.name}</div>
                      <div style={{ fontFamily:"sans-serif", fontSize:12, color:C.textLight }}>{motm.goals} but{motm.goals>1?"s":""} ce soir</div>
                    </div>
                  </div>
                )}
                <div style={{ display:"flex", gap:10, marginBottom:16 }}>
                  {[{val:selectedMatch.presentNames?.length||0,label:"PRÉSENTS",color:C.success},{val:selectedMatch.events?.length||0,label:"BUTS",color:C.primary},{val:selectedMatch.events?.filter(e=>e.assist).length||0,label:"PASSES",color:C.purple}].map(s=>(
                    <div key={s.label} style={{ flex:1, background:C.bgCard2, border:`1px solid ${C.border}`, borderRadius:10, padding:12, textAlign:"center" }}>
                      <div style={{ fontSize:28, color:s.color, fontFamily:"'Bebas Neue',Impact,sans-serif" }}>{s.val}</div>
                      <div style={{ fontFamily:"sans-serif", fontSize:10, color:C.textXlight, letterSpacing:1 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {selectedMatch.presentNames?.length>0 && <>
                  <div style={secLabel}>👥 JOUEURS PRÉSENTS</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
                    {selectedMatch.presentNames.map(name=>(
                      <span key={name} style={{ fontFamily:"sans-serif", fontSize:12, background:C.successBg, border:"1px solid #a7f3d0", color:C.success, padding:"4px 10px", borderRadius:20 }}>{name}</span>
                    ))}
                  </div>
                </>}
                <div style={secLabel}>BUTEURS DU MATCH</div>
                {!selectedMatch.events?.length
                  ? <p style={{ fontFamily:"sans-serif", fontSize:13, color:C.textLight }}>Aucun but marqué</p>
                  : Object.entries((selectedMatch.events||[]).reduce((acc,e)=>{ if(!acc[e.scorer]) acc[e.scorer]={goals:0,assists:[]}; acc[e.scorer].goals++; if(e.assist) acc[e.scorer].assists.push(e.assist); return acc; },{})).sort((a,b)=>b[1].goals-a[1].goals).map(([name,data],i)=>(
                      <div key={name} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", background:i===0?"#fffbeb":C.bgCard2, border:`1px solid ${i===0?"#fde68a":C.border}`, borderRadius:10, marginBottom:6 }}>
                        <span style={{ fontSize:18 }}>{i===0?"⭐":"⚽"}</span>
                        <div style={{ flex:1, fontFamily:"sans-serif" }}>
                          <div style={{ fontSize:15, fontWeight:"bold", color:C.text }}>{name}</div>
                          {data.assists.length>0 && <div style={{ fontSize:11, color:C.textLight }}>Passes reçues de : {data.assists.join(", ")}</div>}
                        </div>
                        <div style={{ fontSize:26, color:i===0?C.gold:C.primary, fontFamily:"'Bebas Neue',Impact,sans-serif" }}>{data.goals}</div>
                      </div>
                    ))
                }
                {selectedMatch.events?.some(e=>e.assist) && <>
                  <div style={{ ...secLabel, marginTop:16 }}>PASSEURS DU MATCH</div>
                  {Object.entries((selectedMatch.events||[]).filter(e=>e.assist).reduce((acc,e)=>{ acc[e.assist]=(acc[e.assist]||0)+1; return acc; },{})).sort((a,b)=>b[1]-a[1]).map(([name,count])=>(
                    <div key={name} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 12px", background:C.purpleBg, border:`1px solid ${C.purpleBorder}`, borderRadius:10, marginBottom:6 }}>
                      <span style={{ fontSize:18 }}>🎯</span>
                      <div style={{ flex:1, fontFamily:"sans-serif", fontSize:15, fontWeight:"bold", color:C.text }}>{name}</div>
                      <div style={{ fontSize:26, color:C.purple, fontFamily:"'Bebas Neue',Impact,sans-serif" }}>{count}</div>
                    </div>
                  ))}
                </>}
                {isAdmin && <button onClick={()=>deleteMatch(selectedMatch)} style={{ width:"100%", marginTop:20, padding:12, background:C.dangerBg, border:"1px solid #fecaca", borderRadius:10, color:C.danger, fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:16, letterSpacing:2, cursor:"pointer" }}>🗑️ Supprimer ce match</button>}
              </div>
            </div>
          );
        })()}

        {/* ADMIN: NOUVEAU MATCH */}
        {isAdmin && (
          <div style={{ marginBottom:20 }}>
            <button onClick={matchMode?cancelMatch:startMatch} style={{ width:"100%", ...(matchMode?btnDng:btnPri), padding:14, fontSize:18, letterSpacing:2 }}>
              {matchMode?"❌ Annuler":"⚽ Nouveau match"}
            </button>
          </div>
        )}

        {/* MATCH MODE */}
        {isAdmin && matchMode && (
          <div style={{ ...card, marginBottom:20, border:`1px solid ${C.borderBlue}`, background:"#f0f7ff" }}>
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              {[["presence","1. Présence"],["buts","2. Buts"],["validation","3. Valider"]].map(([step,label])=>{
                const si=STEPS.indexOf(step), ci=STEPS.indexOf(matchStep), isDone=si<ci, isAct=step===matchStep;
                return (
                  <div key={step} style={{ flex:1, textAlign:"center" }}>
                    <div style={{ height:4, borderRadius:2, background:isDone?C.success:isAct?C.primary:C.border, marginBottom:4, transition:"background 0.3s" }} />
                    <div style={{ fontFamily:"sans-serif", fontSize:11, color:isDone?C.success:isAct?C.primary:C.textXlight, letterSpacing:1 }}>{label}</div>
                  </div>
                );
              })}
            </div>

            {matchStep==="presence" && (
              <>
                <h3 style={{ margin:"0 0 6px", fontSize:20, letterSpacing:3, color:C.primary }}>👥 Qui a joué ?</h3>
                <p style={{ fontFamily:"sans-serif", fontSize:13, color:C.textLight, margin:"0 0 14px" }}>Sélectionne tous les joueurs présents ce jeudi</p>
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontFamily:"sans-serif", fontSize:12, color:C.textLight, letterSpacing:2, display:"block", marginBottom:6, textTransform:"uppercase" }}>📅 Date du match</label>
                  <input type="date" value={matchDate} onChange={e=>setMatchDate(e.target.value)} style={{ ...inputStyle, width:"100%" }} />
                </div>
                <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                  <button onClick={selectAll} style={{ ...btnPri, flex:1, padding:"8px", fontSize:14, letterSpacing:1 }}>✅ Tous</button>
                  <button onClick={clearAll}  style={{ ...btnSec, flex:1, padding:"8px", fontSize:14, letterSpacing:1 }}>❌ Aucun</button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
                  {players.map(p=>{
                    const isP=presentIds.includes(p.id);
                    return (
                      <div key={p.id} onClick={()=>togglePresence(p.id)} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:10, background:isP?C.primaryLight:C.bgCard, border:`1px solid ${isP?C.borderBlue:C.border}`, cursor:"pointer", transition:"all 0.15s" }}>
                        <div style={{ width:24, height:24, borderRadius:"50%", background:isP?C.primary:C.border, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          {isP && <span style={{ color:"#fff", fontSize:14 }}>✓</span>}
                        </div>
                        <span style={{ fontFamily:"sans-serif", fontSize:15, color:isP?C.primary:C.textMid, fontWeight:isP?"bold":"normal" }}>{p.name}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontFamily:"sans-serif", fontSize:13, color:C.textLight, textAlign:"center", marginBottom:12 }}>
                  {presentIds.length} joueur{presentIds.length>1?"s":""} sélectionné{presentIds.length>1?"s":""}
                </div>
                <button onClick={()=>setMatchStep("buts")} disabled={presentIds.length===0} style={{ width:"100%", ...btnPri, opacity:presentIds.length>0?1:0.4, fontSize:18, letterSpacing:2, padding:14 }}>Suivant → Saisir les buts</button>
              </>
            )}

            {matchStep==="buts" && (
              <>
                <h3 style={{ margin:"0 0 6px", fontSize:20, letterSpacing:3, color:C.primary }}>⚽ Buts marqués</h3>
                <p style={{ fontFamily:"sans-serif", fontSize:13, color:C.textLight, margin:"0 0 14px" }}>{presentIds.length} joueurs présents · {matchEvents.length} but{matchEvents.length>1?"s":""} saisi{matchEvents.length>1?"s":""}</p>
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
                  <select value={selectedPlayer} onChange={e=>setSelectedPlayer(e.target.value)} style={selStyle}>
                    <option value="">Buteur *</option>
                    {presentPlayers.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <label style={{ fontFamily:"sans-serif", fontSize:13, color:C.textMid, whiteSpace:"nowrap" }}>Nombre de buts :</label>
                    <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
                      <button onClick={()=>setGoalQty(q=>Math.max(1,q-1))} style={{ ...btnSec, padding:"10px 18px", fontSize:20 }}>−</button>
                      <span style={{ fontFamily:"sans-serif", fontSize:26, fontWeight:"bold", minWidth:36, textAlign:"center", color:C.primary }}>{goalQty}</span>
                      <button onClick={()=>setGoalQty(q=>q+1)} style={{ ...btnPri, padding:"10px 18px", fontSize:20 }}>+</button>
                    </div>
                  </div>
                  {goalQty===1
                    ? <select value={selectedAssist} onChange={e=>setSelectedAssist(e.target.value)} style={selStyle}>
                        <option value="">Passeur décisif (optionnel)</option>
                        {presentPlayers.filter(p=>p.id!==selectedPlayer).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    : <p style={{ fontFamily:"sans-serif", fontSize:12, color:C.textLight, margin:0, textAlign:"center" }}>Pour saisir les passeurs, ajoute les buts un par un</p>
                  }
                  <button onClick={addGoalEvent} disabled={!selectedPlayer} style={{ width:"100%", padding:12, background:selectedPlayer?C.accent:C.border, border:"none", borderRadius:10, color:selectedPlayer?"#fff":C.textLight, fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:17, letterSpacing:2, cursor:selectedPlayer?"pointer":"not-allowed" }}>
                    + Ajouter {goalQty>1?`${goalQty} buts`:"le but"}
                  </button>
                </div>
                {matchEvents.length>0 && (
                  <div style={{ marginBottom:16 }}>
                    <div style={{ ...secLabel, marginBottom:8 }}>BUTS SAISIS ({matchEvents.length})</div>
                    {Object.values(groupedEvents).map(({name,count,assist})=>(
                      <div key={name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:C.primaryLight, border:`1px solid ${C.borderBlue}`, borderRadius:8, marginBottom:6, fontFamily:"sans-serif", fontSize:14 }}>
                        <span style={{ color:C.text }}>⚽ <strong>{name}</strong>{count>1&&<span style={{ color:C.primary, marginLeft:6 }}>×{count}</span>}{assist&&<span style={{ color:C.textLight, marginLeft:6 }}>← {assist}</span>}</span>
                        <button onClick={()=>removeScorer(Object.keys(groupedEvents).find(id=>groupedEvents[id].name===name))} style={{ background:"none", border:"none", color:C.danger, cursor:"pointer", fontSize:20 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>setMatchStep("presence")} style={{ ...btnSec, flex:1, padding:12, fontSize:15 }}>← Présence</button>
                  <button onClick={()=>setMatchStep("validation")} style={{ ...btnPri, flex:2, padding:12, fontSize:16, letterSpacing:2 }}>Suivant → Valider</button>
                </div>
              </>
            )}

            {matchStep==="validation" && (
              <>
                <h3 style={{ margin:"0 0 16px", fontSize:20, letterSpacing:3, color:C.primary }}>✅ Récapitulatif</h3>
                <div style={{ ...card, marginBottom:12, background:C.successBg, border:"1px solid #a7f3d0" }}>
                  <div style={{ ...secLabel, marginBottom:8 }}>👥 PRÉSENTS ({presentIds.length})</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {presentIds.map(id=>{ const p=players.find(x=>x.id===id); return <span key={id} style={{ fontFamily:"sans-serif", fontSize:12, background:"#fff", border:"1px solid #a7f3d0", color:C.success, padding:"3px 10px", borderRadius:20 }}>{p?.name}</span>; })}
                  </div>
                </div>
                <div style={{ ...card, marginBottom:16 }}>
                  <div style={{ ...secLabel, marginBottom:8 }}>⚽ BUTS ({matchEvents.length})</div>
                  {matchEvents.length===0
                    ? <p style={{ fontFamily:"sans-serif", fontSize:13, color:C.textLight, margin:0 }}>Aucun but saisi</p>
                    : Object.values(groupedEvents).map(({name,count,assist})=>(
                        <div key={name} style={{ fontFamily:"sans-serif", fontSize:14, color:C.textMid, marginBottom:4 }}>
                          ⚽ <strong>{name}</strong>{count>1&&<span style={{ color:C.primary }}> ×{count}</span>}{assist&&<span style={{ color:C.textLight }}> ← {assist}</span>}
                        </div>
                      ))
                  }
                  {matchEvents.length>0 && (()=>{
                    const motm=getManOfTheMatch({events:matchEvents.map(e=>({scorer:players.find(p=>p.id===e.scorerId)?.name||"?"}))});
                    return motm ? <div style={{ marginTop:12, padding:"8px 12px", background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, fontFamily:"sans-serif", fontSize:13, color:C.gold }}>⭐ Man of the Match : <strong>{motm.name}</strong></div> : null;
                  })()}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>setMatchStep("buts")} style={{ ...btnSec, flex:1, padding:12, fontSize:15 }}>← Buts</button>
                  <button onClick={validateMatch} style={{ ...btnPri, flex:2, padding:14, fontSize:18, letterSpacing:2 }}>✅ Valider le match</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════════ CLASSEMENT ════════ */}
        {page==="classement" && (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:20 }}>
              {STAT_VIEWS.map(v=>(
                <button key={v.key} onClick={()=>setStatView(v.key)} style={{ padding:"10px 4px", background:statView===v.key?v.color:C.bgCard, border:`1px solid ${statView===v.key?v.color:C.border}`, borderRadius:10, color:statView===v.key?"#fff":C.textLight, fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:13, letterSpacing:1, cursor:"pointer", transition:"all 0.2s", display:"flex", flexDirection:"column", alignItems:"center", gap:2, boxShadow:C.shadow }}>
                  <span style={{ fontSize:18 }}>{v.icon}</span>{v.label}
                </button>
              ))}
            </div>
            <div style={{ fontFamily:"sans-serif", fontSize:12, color:C.textXlight, letterSpacing:2, textTransform:"uppercase", marginBottom:12, textAlign:"center" }}>
              {statView==="goals"&&"Classement par nombre de buts"}
              {statView==="assists"&&"Classement par passes décisives"}
              {statView==="ratio"&&"Classement par efficacité (buts / match)"}
              {statView==="streak"&&"Classement par série de matchs marqués"}
            </div>
            <div style={{ marginBottom:28 }}>
              {loading
                ? <div style={{ textAlign:"center", padding:"40px 0", fontFamily:"sans-serif", color:C.textXlight }}>Chargement...</div>
                : sorted(statView).map((player,i)=>{
                    const rank=i+1, isTop3=rank<=3&&(statView==="ratio"?player.ratio>0:statView==="streak"?player.streak>0:player[statView]>0);
                    const val=statView==="ratio"?player.ratio.toFixed(2):statView==="streak"?player.streak:player[statView];
                    const color=currentView.color;
                    return (
                      <div key={player.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", marginBottom:8, borderRadius:14, background:flashId===player.id?"#dbeafe":isTop3?(rank===1?"#fffbeb":rank===2?"#f9fafb":"#fff7ed"):C.bgCard, border:`1px solid ${isTop3?(rank===1?"#fde68a":rank===2?"#e5e7eb":"#fed7aa"):C.border}`, boxShadow:C.shadow, transition:"all 0.3s" }}>
                        <div style={{ width:32, textAlign:"center", fontSize:isTop3?22:14, fontFamily:"sans-serif", color:positionColors[rank]||C.textXlight, fontWeight:"bold", flexShrink:0 }}>{isTop3?trophyIcon(rank):rank}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:20, letterSpacing:2, color:C.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {player.name}{player.streak>0&&statView!=="streak"&&<span style={{ fontFamily:"sans-serif", fontSize:11, color:C.danger, marginLeft:8 }}>🔥{player.streak}</span>}
                          </div>
                          <div style={{ fontFamily:"sans-serif", fontSize:11, color:C.textXlight, letterSpacing:1, marginTop:2 }}>{player.goals}G · {player.assists}A · {player.matches} matchs · {player.ratio.toFixed(2)} b/m</div>
                        </div>
                        <div style={{ fontSize:32, color:val>0?(isTop3?positionColors[rank]:color):C.border, minWidth:56, textAlign:"right", flexShrink:0 }}>
                          {val}<span style={{ fontSize:11, fontFamily:"sans-serif", display:"block", color:C.textXlight, letterSpacing:1 }}>{currentView.unit}</span>
                        </div>
                        {isAdmin && (
                          <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
                            <button onClick={()=>setEditingPlayer({id:player.id,goals:player.goals,assists:player.assists,matches:player.matches})} style={{ background:C.bgCard2, border:`1px solid ${C.border}`, borderRadius:6, color:C.textMid, cursor:"pointer", fontSize:13, padding:"4px 8px" }}>✏️</button>
                            <button onClick={()=>removePlayer(player.id)} style={{ background:"none", border:"none", color:C.textXlight, cursor:"pointer", fontSize:16, padding:"4px 8px" }}>×</button>
                          </div>
                        )}
                      </div>
                    );
                  })
              }
            </div>
            {isAdmin && (
              <div style={{ ...card, border:`1px dashed ${C.borderBlue}` }}>
                <div style={{ ...secLabel, marginBottom:10 }}>AJOUTER UN JOUEUR</div>
                <div style={{ display:"flex", gap:10 }}>
                  <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlayer()} placeholder="Nom du joueur..." style={{ ...inputStyle, flex:1 }} />
                  <button onClick={addPlayer} style={{ ...btnPri, padding:"12px 20px", fontSize:20 }}>+</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════ GRAPHIQUES ════════ */}
        {page==="graphiques" && (
          <div>
            {/* Switch courbe / barres */}
            <div style={{ display:"flex", background:C.bgCard, borderRadius:12, padding:4, marginBottom:20, border:`1px solid ${C.border}`, boxShadow:C.shadow }}>
              {[["line","📈 Évolution cumulative"],["bar","📊 Buts par mois"]].map(([type,label])=>(
                <button key={type} onClick={()=>setChartType(type)} style={{ flex:1, padding:"10px 8px", background:chartType===type?C.primary:"transparent", border:chartType===type?"none":`1px solid ${C.border}`, borderRadius:10, color:chartType===type?"#fff":C.textLight, fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:15, letterSpacing:1, cursor:"pointer", transition:"all 0.2s" }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Titre */}
            <div style={{ fontFamily:"sans-serif", fontSize:12, color:C.textXlight, letterSpacing:2, textTransform:"uppercase", marginBottom:16, textAlign:"center" }}>
              {chartType==="line" ? "Cumul des buts par joueur dans le temps" : "Buts marqués par mois par joueur"}
            </div>

            {/* Graphique */}
            <div style={{ ...card, marginBottom:20, overflowX:"auto" }}>
              {chartType==="line" ? renderLineChart() : renderBarChart()}
            </div>

            {/* Légende interactive — cliquer pour masquer/afficher */}
            <div style={{ ...secLabel, marginBottom:10 }}>LÉGENDE — clique pour masquer/afficher</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
              {players.map((p,idx)=>{
                const color=CHART_COLORS[idx%CHART_COLORS.length];
                const hidden=hiddenPlayers.includes(p.name);
                return (
                  <button key={p.id} onClick={()=>toggleHidden(p.name)} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", background:hidden?"#f3f4f6":color+"18", border:`1px solid ${hidden?C.border:color}`, borderRadius:20, cursor:"pointer", transition:"all 0.2s", opacity:hidden?0.5:1 }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:hidden?C.border:color, flexShrink:0 }} />
                    <span style={{ fontFamily:"sans-serif", fontSize:12, color:hidden?C.textXlight:color, fontWeight:"bold" }}>{p.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Meilleur buteur du mois */}
            {matchHistory.length > 0 && (()=>{
              // Trouver le mois en cours
              const now = new Date();
              const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
              const monthMatches = matchHistory.filter(m=>{
                const d=new Date(m.timestamp);
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` === currentMonth;
              });
              if (!monthMatches.length) return null;
              const monthScorers = monthMatches.reduce((acc,m)=>{
                m.events?.forEach(e=>{ acc[e.scorer]=(acc[e.scorer]||0)+1; });
                return acc;
              },{});
              const topMonth = Object.entries(monthScorers).sort((a,b)=>b[1]-a[1])[0];
              if (!topMonth) return null;
              const monthName = MOIS_FR[now.getMonth()];
              return (
                <div style={{ background:"linear-gradient(135deg,#1a56db,#2563eb)", borderRadius:14, padding:"16px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:14, boxShadow:C.shadowMd }}>
                  <span style={{ fontSize:36 }}>🏅</span>
                  <div>
                    <div style={{ fontFamily:"sans-serif", fontSize:11, color:"rgba(255,255,255,0.7)", letterSpacing:2, textTransform:"uppercase" }}>Meilleur buteur de {monthName}</div>
                    <div style={{ fontSize:26, letterSpacing:3, color:"#fff" }}>{topMonth[0]}</div>
                    <div style={{ fontFamily:"sans-serif", fontSize:13, color:"rgba(255,255,255,0.7)" }}>{topMonth[1]} but{topMonth[1]>1?"s":""} ce mois</div>
                  </div>
                </div>
              );
            })()}

            {/* Tableau stats par mois */}
            <div style={secLabel}>STATS PAR MOIS</div>
            <div style={{ ...card, overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"sans-serif", fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:`2px solid ${C.border}` }}>
                    <th style={{ textAlign:"left", padding:"8px 6px", color:C.textLight, fontSize:11, letterSpacing:1, fontWeight:"normal" }}>JOUEUR</th>
                    {barData.months.map(m=>(
                      <th key={m} style={{ textAlign:"center", padding:"8px 4px", color:C.textLight, fontSize:11, letterSpacing:1, fontWeight:"normal", minWidth:36 }}>
                        {MOIS_FR[parseInt(m.split("-")[1])-1]}
                      </th>
                    ))}
                    <th style={{ textAlign:"center", padding:"8px 6px", color:C.primary, fontSize:11, letterSpacing:1, fontWeight:"bold" }}>TOT</th>
                  </tr>
                </thead>
                <tbody>
                  {barData.series.sort((a,b)=>b.data.reduce((s,v)=>s+v,0)-a.data.reduce((s,v)=>s+v,0)).map((s,idx)=>{
                    const total=s.data.reduce((sum,v)=>sum+v,0);
                    const color=CHART_COLORS[players.findIndex(p=>p.name===s.name)%CHART_COLORS.length];
                    const maxMonth=Math.max(...s.data,1);
                    return (
                      <tr key={s.name} style={{ borderBottom:`1px solid ${C.border}` }}>
                        <td style={{ padding:"8px 6px", color:C.text, fontWeight:"bold", whiteSpace:"nowrap" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ width:8, height:8, borderRadius:"50%", background:color, flexShrink:0 }} />
                            {s.name}
                          </div>
                        </td>
                        {s.data.map((v,i)=>(
                          <td key={i} style={{ textAlign:"center", padding:"8px 4px" }}>
                            {v>0
                              ? <span style={{ background:color, color:"#fff", borderRadius:6, padding:"2px 6px", fontSize:12, fontWeight:"bold", opacity:0.5+0.5*(v/maxMonth) }}>{v}</span>
                              : <span style={{ color:C.textXlight }}>—</span>
                            }
                          </td>
                        ))}
                        <td style={{ textAlign:"center", padding:"8px 6px", fontWeight:"bold", color:C.primary, fontSize:15 }}>{total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════ PAIEMENT ════════ */}
        {page==="paiement" && (
          <div>
            <div style={{ background:`linear-gradient(135deg,${C.primary},${C.accent})`, borderRadius:16, padding:24, marginBottom:16, textAlign:"center", boxShadow:C.shadowMd }}>
              <div style={{ fontFamily:"sans-serif", fontSize:11, color:"rgba(255,255,255,0.7)", letterSpacing:3, marginBottom:8, textTransform:"uppercase" }}>💰 Paiement ce jeudi</div>
              <div style={{ fontFamily:"sans-serif", fontSize:13, color:"rgba(255,255,255,0.7)", marginBottom:8 }}>{nextThursdayLabel}</div>
              <div style={{ fontSize:26, letterSpacing:2, color:"#fff", marginBottom:6 }}>{currentGroup?.members}</div>
              <div style={{ fontSize:34, color:"#fff", fontFamily:"'Bebas Neue',Impact,sans-serif" }}>{currentGroup?.amount.toLocaleString()} <span style={{ fontSize:16, color:"rgba(255,255,255,0.6)" }}>FCFA</span></div>
            </div>
            <div style={{ ...secLabel, marginBottom:10 }}>PROCHAINS GROUPES</div>
            {[{label:"Semaine prochaine",group:nextGroup},{label:"Dans 2 semaines",group:nextNextGroup}].map(({label,group})=>(
              <div key={label} style={{ ...card, display:"flex", alignItems:"center", gap:14, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"sans-serif", fontSize:11, color:C.textXlight, letterSpacing:1, marginBottom:4, textTransform:"uppercase" }}>{label}</div>
                  <div style={{ fontSize:18, letterSpacing:1, color:C.text }}>{group?.members}</div>
                </div>
                <div style={{ fontFamily:"sans-serif", fontSize:14, color:C.textLight }}>{group?.amount.toLocaleString()} FCFA</div>
              </div>
            ))}
            <div style={{ ...secLabel, margin:"20px 0 10px" }}>PLANNING COMPLET</div>
            {groups.map((g,i)=>{
              const isCurrent=i===currentIdx;
              return (
                <div key={g.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", marginBottom:6, borderRadius:12, background:isCurrent?C.primaryLight:C.bgCard, border:`1px solid ${isCurrent?C.borderBlue:C.border}`, boxShadow:C.shadow }}>
                  <div style={{ fontSize:18, width:28, textAlign:"center", flexShrink:0 }}>{isCurrent?"👉":`${i+1}.`}</div>
                  <div style={{ flex:1, fontFamily:"sans-serif", fontSize:14, color:isCurrent?C.primary:C.textMid, fontWeight:isCurrent?"bold":"normal" }}>{g.members}</div>
                  {isCurrent && <div style={{ fontFamily:"sans-serif", fontSize:11, color:C.primary, letterSpacing:1, fontWeight:"bold" }}>CE JEUDI</div>}
                  {isAdmin && <button onClick={()=>removeGroup(g.id)} style={{ background:"none", border:"none", color:C.textXlight, cursor:"pointer", fontSize:16, padding:"0 4px", flexShrink:0 }}>×</button>}
                </div>
              );
            })}
            {isAdmin && (
              <div style={{ ...card, border:`1px dashed ${C.borderBlue}`, marginTop:16 }}>
                <div style={{ ...secLabel, marginBottom:10 }}>AJOUTER UN GROUPE</div>
                <div style={{ display:"flex", gap:10 }}>
                  <input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGroup()} placeholder="Ex: Paul & Léon..." style={{ ...inputStyle, flex:1 }} />
                  <button onClick={addGroup} style={{ ...btnPri, padding:"12px 20px", fontSize:20 }}>+</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════ RÉCAPITULATIF ════════ */}
        {page==="recapitulatif" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
              {[
                {label:"MATCHS JOUÉS",value:matchHistory.length,color:C.primary,icon:"📅"},
                {label:"BUTS MARQUÉS",value:totalGoals,color:C.accent,icon:"⚽"},
                {label:"JOUEURS",value:players.length,color:C.gold,icon:"👥"},
                {label:"MOY. BUTS/MATCH",value:matchHistory.length>0?(totalGoals/matchHistory.length).toFixed(1):"0",color:C.purple,icon:"📊"},
              ].map(s=>(
                <div key={s.label} style={{ ...card, textAlign:"center" }}>
                  <div style={{ fontSize:28, marginBottom:4 }}>{s.icon}</div>
                  <div style={{ fontSize:34, color:s.color, fontFamily:"'Bebas Neue',Impact,sans-serif" }}>{s.value}</div>
                  <div style={{ fontFamily:"sans-serif", fontSize:10, color:C.textXlight, letterSpacing:2, marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {(topScorer?.goals>0||topMotm||topStreak?.streak>0) && (
              <div style={{ marginBottom:20 }}>
                <div style={secLabel}>🏆 TROPHÉES</div>
                {[
                  topScorer?.goals>0    && {label:"Meilleur buteur",    player:topScorer,  stat:topScorer.goals,          unit:"buts",     color:C.gold,   icon:"⚽",bg:"#fffbeb",bd:"#fde68a"},
                  topAssist?.assists>0  && {label:"Meilleur passeur",   player:topAssist,  stat:topAssist.assists,        unit:"passes",   color:C.purple, icon:"🎯",bg:C.purpleBg,bd:C.purpleBorder},
                  topRatio?.ratio>0     && {label:"Meilleure efficacité",player:topRatio,   stat:topRatio.ratio.toFixed(2),unit:"b/m",      color:C.orange, icon:"📈",bg:C.orangeBg,bd:C.orangeBorder},
                  topMotm               && {label:"Roi du Man of Match", player:{name:topMotm[0]},stat:topMotm[1],        unit:"MOTM",     color:C.gold,   icon:"⭐",bg:"#fffbeb",bd:"#fde68a"},
                  topStreak?.streak>0   && {label:"Série en cours",     player:topStreak,  stat:topStreak.streak,         unit:"matchs 🔥",color:C.danger, icon:"🔥",bg:C.dangerBg,bd:"#fecaca"},
                ].filter(Boolean).map(item=>(
                  <div key={item.label} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", marginBottom:8, borderRadius:14, background:item.bg, border:`1px solid ${item.bd}`, boxShadow:C.shadow }}>
                    <span style={{ fontSize:28 }}>{item.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"sans-serif", fontSize:11, color:C.textLight, letterSpacing:2, textTransform:"uppercase" }}>{item.label}</div>
                      <div style={{ fontSize:22, letterSpacing:2, color:C.text }}>{item.player.name}</div>
                    </div>
                    <div style={{ fontSize:34, color:item.color, fontFamily:"'Bebas Neue',Impact,sans-serif" }}>{item.stat}<span style={{ fontFamily:"sans-serif", fontSize:11, display:"block", color:C.textXlight }}>{item.unit}</span></div>
                  </div>
                ))}
              </div>
            )}
            <div style={secLabel}>📋 TABLEAU COMPLET</div>
            <div style={{ background:C.bgCard, borderRadius:14, overflow:"hidden", border:`1px solid ${C.border}`, boxShadow:C.shadow, marginTop:10 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 48px 48px 56px 56px", padding:"10px 12px", borderBottom:`1px solid ${C.border}`, background:C.bgCard2 }}>
                {["JOUEUR","⚽","🎯","B/M","🔥"].map(h=><div key={h} style={{ fontFamily:"sans-serif", fontSize:11, color:C.textLight, letterSpacing:1, textAlign:h==="JOUEUR"?"left":"center" }}>{h}</div>)}
              </div>
              {sorted("goals").map((p,i)=>(
                <div key={p.id} style={{ display:"grid", gridTemplateColumns:"1fr 48px 48px 56px 56px", padding:"12px 12px", borderBottom:`1px solid ${C.border}`, background:i%2===0?C.bgCard:C.bgCard2 }}>
                  <div style={{ fontFamily:"sans-serif", fontSize:14, color:C.text, display:"flex", alignItems:"center", gap:4 }}>{i<3&&p.goals>0&&<span>{trophyIcon(i+1)}</span>}{p.name}</div>
                  <div style={{ fontFamily:"sans-serif", fontSize:15, color:C.primary,  textAlign:"center", fontWeight:"bold" }}>{p.goals}</div>
                  <div style={{ fontFamily:"sans-serif", fontSize:15, color:C.purple,   textAlign:"center", fontWeight:"bold" }}>{p.assists}</div>
                  <div style={{ fontFamily:"sans-serif", fontSize:13, color:C.orange,   textAlign:"center", fontWeight:"bold" }}>{p.ratio.toFixed(2)}</div>
                  <div style={{ fontFamily:"sans-serif", fontSize:13, color:p.streak>0?C.danger:C.textXlight, textAlign:"center", fontWeight:"bold" }}>{p.streak>0?`🔥${p.streak}`:"—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════ MATCHS ════════ */}
        {page==="matchs" && (
          <div>
            <div style={{ ...secLabel, marginBottom:14 }}>{matchHistory.length} MATCH{matchHistory.length>1?"S":""} ENREGISTRÉ{matchHistory.length>1?"S":""}</div>
            {matchHistory.length===0
              ? <div style={{ textAlign:"center", padding:"40px 0", fontFamily:"sans-serif", color:C.textXlight, fontSize:14 }}>Aucun match enregistré</div>
              : matchHistory.map((m,i)=>{
                  const motm=getManOfTheMatch(m);
                  const uniqueScorers=[...new Set(m.events?.map(e=>e.scorer)||[])];
                  return (
                    <div key={m.id} onClick={()=>setSelectedMatch(m)} style={{ ...card, display:"flex", alignItems:"center", gap:14, marginBottom:10, cursor:"pointer", transition:"box-shadow 0.2s" }}
                      onMouseEnter={e=>e.currentTarget.style.boxShadow=C.shadowMd}
                      onMouseLeave={e=>e.currentTarget.style.boxShadow=C.shadow}
                    >
                      <div style={{ textAlign:"center", flexShrink:0, minWidth:40 }}>
                        <div style={{ fontSize:22, color:C.primary, fontFamily:"'Bebas Neue',Impact,sans-serif" }}>J{matchHistory.length-i}</div>
                        <div style={{ fontFamily:"sans-serif", fontSize:11, color:C.textXlight, whiteSpace:"nowrap" }}>{m.date}</div>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:"sans-serif", fontSize:12, color:C.success, marginBottom:2 }}>👥 {m.presentNames?.length||0} présents</div>
                        {motm && <div style={{ fontFamily:"sans-serif", fontSize:11, color:C.gold, marginBottom:2 }}>⭐ {motm.name} ({motm.goals} buts)</div>}
                        <div style={{ fontFamily:"sans-serif", fontSize:12, color:C.textMid, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {uniqueScorers.slice(0,3).join(", ")}{uniqueScorers.length>3?` +${uniqueScorers.length-3}`:""}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", flexShrink:0 }}>
                        <div style={{ fontSize:26, color:C.primary, fontFamily:"'Bebas Neue',Impact,sans-serif" }}>{m.events?.length}</div>
                        <div style={{ fontFamily:"sans-serif", fontSize:10, color:C.textXlight }}>BUTS</div>
                      </div>
                      <div style={{ color:C.textXlight, fontSize:20, flexShrink:0 }}>›</div>
                    </div>
                  );
                })
            }
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:`1px solid ${C.border}`, display:"flex", zIndex:50, boxShadow:"0 -2px 12px rgba(0,0,0,0.06)" }}>
        {NAV.map(n=>(
          <button key={n} onClick={()=>{setPage(n);setMatchMode(false);}} style={{ flex:1, padding:"10px 2px 14px", background:"none", border:"none", color:page===n?C.primary:C.textXlight, fontFamily:"'Bebas Neue',Impact,sans-serif", fontSize:10, letterSpacing:1, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, transition:"color 0.2s" }}>
            <span style={{ fontSize:18 }}>{n==="classement"?"🏆":n==="graphiques"?"📈":n==="paiement"?"💰":n==="recapitulatif"?"📊":"📅"}</span>
            {NAV_LABELS[n]}
            {page===n && <div style={{ width:18, height:3, background:C.primary, borderRadius:2, marginTop:2 }} />}
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

const inputStyle   = { padding:"12px 16px", background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:10, color:"#111827", fontFamily:"sans-serif", fontSize:14, outline:"none" };
const selStyle     = { width:"100%", padding:"12px 16px", background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:10, color:"#111827", fontFamily:"sans-serif", fontSize:14, outline:"none", cursor:"pointer" };
const btnPri       = { background:"linear-gradient(135deg,#1a56db,#2563eb)", border:"none", borderRadius:10, color:"#fff", fontFamily:"'Bebas Neue',Impact,sans-serif", cursor:"pointer", padding:12 };
const btnSec       = { background:"#f3f4f6", border:"1px solid #e5e7eb", borderRadius:10, color:"#374151", fontFamily:"'Bebas Neue',Impact,sans-serif", cursor:"pointer", padding:12 };
const btnDng       = { background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, color:"#dc2626", fontFamily:"'Bebas Neue',Impact,sans-serif", cursor:"pointer", padding:12 };
const modalOverlay = { position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:16 };
const modalBox     = { borderRadius:16, padding:28, width:"100%", maxWidth:360, textAlign:"center", boxShadow:"0 8px 32px rgba(0,0,0,0.15)" };
const secLabel     = { fontFamily:"sans-serif", fontSize:11, color:"#9ca3af", letterSpacing:2, textTransform:"uppercase", marginBottom:8, display:"block" };
