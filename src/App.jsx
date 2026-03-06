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

// 🔑 MOT DE PASSE ADMIN
const ADMIN_PASSWORD = "jeudi2024";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const positionColors = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" };
const trophyIcon = (r) => ({ 1: "🥇", 2: "🥈", 3: "🥉" }[r] || null);

// ─── NAV TABS ────────────────────────────────────────────────
const NAV = ["classement", "recapitulatif", "matchs"];
const NAV_LABELS = { classement: "🏆 Classement", recapitulatif: "📊 Récap", matchs: "📅 Matchs" };

export default function FootballTracker() {
  const [players, setPlayers]         = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [isAdmin, setIsAdmin]         = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [showLogin, setShowLogin]     = useState(false);
  const [page, setPage]               = useState("classement");
  const [activeTab, setActiveTab]     = useState("buteurs");
  const [matchMode, setMatchMode]     = useState(false);
  const [matchEvents, setMatchEvents] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedAssist, setSelectedAssist] = useState("");
  const [goalQty, setGoalQty]         = useState(1);
  const [newName, setNewName]         = useState("");
  const [loading, setLoading]         = useState(true);
  const [flashId, setFlashId]         = useState(null);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);

  useEffect(() => {
    const unsubPlayers = onSnapshot(collection(db, "players"), (snap) => {
      setPlayers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsubHistory = onSnapshot(
      query(collection(db, "matches"), orderBy("timestamp", "desc")),
      (snap) => setMatchHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubPlayers(); unsubHistory(); };
  }, []);

  const tryLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdmin(true); setShowLogin(false); setPasswordError(false); setPasswordInput("");
    } else { setPasswordError(true); }
  };

  const addPlayer = async () => {
    if (!newName.trim()) return;
    if (players.find((p) => p.name.toLowerCase() === newName.trim().toLowerCase())) {
      alert("Ce joueur existe déjà !"); return;
    }
    await addDoc(collection(db, "players"), { name: newName.trim(), goals: 0, assists: 0, matches: 0 });
    setNewName("");
  };

  const removePlayer = async (id) => {
    if (!window.confirm("Supprimer ce joueur ?")) return;
    await deleteDoc(doc(db, "players", id));
  };

  const addGoalEvent = () => {
    if (!selectedPlayer) return;
    const qty = parseInt(goalQty) || 1;
    const newEvents = Array.from({ length: qty }, (_, i) => ({
      id: Date.now() + i,
      scorerId: selectedPlayer,
      assistId: qty === 1 && selectedAssist ? selectedAssist : null,
    }));
    setMatchEvents([...matchEvents, ...newEvents]);
    setSelectedPlayer(""); setSelectedAssist(""); setGoalQty(1);
  };

  const validateMatch = async () => {
    if (matchEvents.length === 0) return;
    for (const player of players) {
      const goals   = matchEvents.filter((e) => e.scorerId === player.id).length;
      const assists = matchEvents.filter((e) => e.assistId === player.id).length;
      if (goals > 0 || assists > 0) {
        await updateDoc(doc(db, "players", player.id), {
          goals:   player.goals + goals,
          assists: player.assists + assists,
          matches: player.matches + 1,
        });
      }
    }
    await addDoc(collection(db, "matches"), {
      timestamp: Date.now(),
      date: new Date().toLocaleDateString("fr-FR"),
      events: matchEvents.map((e) => ({
        scorer: players.find((p) => p.id === e.scorerId)?.name || "?",
        assist: e.assistId ? players.find((p) => p.id === e.assistId)?.name : null,
      })),
    });
    const topScorer = [...players].sort((a, b) => b.goals - a.goals)[0];
    if (topScorer) { setFlashId(topScorer.id); setTimeout(() => setFlashId(null), 1500); }
    setMatchEvents([]); setMatchMode(false);
  };

  const saveEditPlayer = async () => {
    if (!editingPlayer) return;
    await updateDoc(doc(db, "players", editingPlayer.id), {
      goals:   parseInt(editingPlayer.goals)   || 0,
      assists: parseInt(editingPlayer.assists) || 0,
      matches: parseInt(editingPlayer.matches) || 0,
    });
    setEditingPlayer(null);
  };

  const sorted = (key) => [...players].sort((a, b) => b[key] - a[key] || b.assists - a.assists);
  const totalGoals   = matchHistory.reduce((s, m) => s + (m.events?.length || 0), 0);
  const totalMatches = matchHistory.length;
  const topScorer    = sorted("goals")[0];
  const topAssister  = sorted("assists")[0];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a1628 0%, #0d2137 40%, #0a1a0a 100%)", fontFamily: "'Bebas Neue', Impact, sans-serif", color: "#f0f4f8" }}>
      <div style={{ position: "fixed", inset: 0, backgroundImage: `radial-gradient(circle at 20% 50%, rgba(34,197,94,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(59,130,246,0.06) 0%, transparent 50%)`, pointerEvents: "none" }} />

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px 100px" }}>

        {/* ── HEADER ── */}
        <div style={{ textAlign: "center", padding: "36px 0 20px" }}>
          <div style={{ fontSize: 44, marginBottom: 4 }}>⚽</div>
          <h1 style={{ fontSize: 40, letterSpacing: 6, margin: 0, background: "linear-gradient(90deg, #22c55e, #86efac, #22c55e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Jeudi Football</h1>
          <div style={{ marginTop: 10 }}>
            {isAdmin
              ? <span onClick={() => setIsAdmin(false)} style={{ cursor: "pointer", fontFamily: "sans-serif", fontSize: 12, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", padding: "4px 14px", borderRadius: 20, letterSpacing: 2 }}>✅ MODE ADMIN — Quitter</span>
              : <span onClick={() => setShowLogin(true)} style={{ cursor: "pointer", fontFamily: "sans-serif", fontSize: 12, color: "rgba(255,255,255,0.25)", letterSpacing: 2 }}>🔒 Accès admin</span>
            }
          </div>
        </div>

        {/* ── LOGIN MODAL ── */}
        {showLogin && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
            <div style={{ background: "#0d2137", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 16, padding: 28, width: 300, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
              <h3 style={{ margin: "0 0 16px", fontSize: 22, letterSpacing: 3 }}>MOT DE PASSE</h3>
              <input type="password" value={passwordInput} onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }} onKeyDown={(e) => e.key === "Enter" && tryLogin()} placeholder="Mot de passe..." style={{ ...inputStyle, width: "100%", marginBottom: 8, textAlign: "center" }} />
              {passwordError && <p style={{ fontFamily: "sans-serif", color: "#f87171", fontSize: 13, margin: "0 0 8px" }}>Mot de passe incorrect</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => { setShowLogin(false); setPasswordInput(""); }} style={{ ...btnSecondary, flex: 1 }}>Annuler</button>
                <button onClick={tryLogin} style={{ ...btnPrimary, flex: 1 }}>Entrer</button>
              </div>
            </div>
          </div>
        )}

        {/* ── EDIT PLAYER MODAL ── */}
        {editingPlayer && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
            <div style={{ background: "#0d2137", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 16, padding: 28, width: 320, textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>✏️</div>
              <h3 style={{ margin: "0 0 4px", fontSize: 22, letterSpacing: 3 }}>MODIFIER</h3>
              <p style={{ fontFamily: "sans-serif", fontSize: 14, color: "#22c55e", margin: "0 0 20px" }}>{players.find(p => p.id === editingPlayer.id)?.name}</p>
              {[["goals","⚽ Buts"],["assists","🎯 Passes"],["matches","📅 Matchs"]].map(([field, label]) => (
                <div key={field} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <label style={{ fontFamily: "sans-serif", fontSize: 13, color: "rgba(255,255,255,0.6)", width: 90, textAlign: "left" }}>{label}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <button onClick={() => setEditingPlayer({ ...editingPlayer, [field]: Math.max(0,(parseInt(editingPlayer[field])||0)-1) })} style={{ ...btnSecondary, padding: "6px 14px", fontSize: 18 }}>−</button>
                    <input type="number" min="0" value={editingPlayer[field]} onChange={(e) => setEditingPlayer({ ...editingPlayer, [field]: e.target.value })} style={{ ...inputStyle, width: 60, textAlign: "center", padding: 8 }} />
                    <button onClick={() => setEditingPlayer({ ...editingPlayer, [field]: (parseInt(editingPlayer[field])||0)+1 })} style={{ ...btnPrimary, padding: "6px 14px", fontSize: 18 }}>+</button>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                <button onClick={() => setEditingPlayer(null)} style={{ ...btnSecondary, flex: 1 }}>Annuler</button>
                <button onClick={saveEditPlayer} style={{ ...btnPrimary, flex: 1, fontSize: 16, letterSpacing: 2 }}>✅ Sauvegarder</button>
              </div>
            </div>
          </div>
        )}

        {/* ── MATCH DETAIL MODAL ── */}
        {selectedMatch && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.80)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}>
            <div style={{ background: "#0d2137", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 16, padding: 28, width: "100%", maxWidth: 400, maxHeight: "80vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 26, letterSpacing: 3, color: "#22c55e" }}>JEUDI</div>
                  <div style={{ fontFamily: "sans-serif", fontSize: 18, color: "#fff", fontWeight: "bold" }}>{selectedMatch.date}</div>
                </div>
                <button onClick={() => setSelectedMatch(null)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", cursor: "pointer", fontSize: 20, padding: "6px 12px" }}>×</button>
              </div>

              {/* Résumé rapide */}
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                <div style={{ flex: 1, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, color: "#22c55e" }}>{selectedMatch.events?.length}</div>
                  <div style={{ fontFamily: "sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>BUTS</div>
                </div>
                <div style={{ flex: 1, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, color: "#60a5fa" }}>{selectedMatch.events?.filter(e => e.assist).length}</div>
                  <div style={{ fontFamily: "sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>PASSES</div>
                </div>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, color: "rgba(255,255,255,0.7)" }}>
                    {[...new Set(selectedMatch.events?.map(e => e.scorer))].length}
                  </div>
                  <div style={{ fontFamily: "sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>BUTEURS</div>
                </div>
              </div>

              {/* Classement du match */}
              <div style={{ fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.35)", marginBottom: 10, fontFamily: "sans-serif" }}>BUTEURS DU MATCH</div>
              {Object.entries(
                (selectedMatch.events || []).reduce((acc, e) => {
                  if (!acc[e.scorer]) acc[e.scorer] = { goals: 0, assists: [] };
                  acc[e.scorer].goals++;
                  if (e.assist) acc[e.scorer].assists.push(e.assist);
                  return acc;
                }, {})
              ).sort((a, b) => b[1].goals - a[1].goals).map(([name, data], i) => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: i === 0 ? "rgba(255,215,0,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${i === 0 ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)"}`, borderRadius: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{i === 0 ? "⭐" : "⚽"}</span>
                  <div style={{ flex: 1, fontFamily: "sans-serif" }}>
                    <div style={{ fontSize: 15, fontWeight: "bold", color: "#fff" }}>{name}</div>
                    {data.assists.length > 0 && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Passes reçues de : {data.assists.join(", ")}</div>}
                  </div>
                  <div style={{ fontSize: 28, color: i === 0 ? "#FFD700" : "#22c55e", fontFamily: "'Bebas Neue', Impact, sans-serif" }}>{data.goals}</div>
                </div>
              ))}

              {/* Passeurs du match */}
              {selectedMatch.events?.some(e => e.assist) && (
                <>
                  <div style={{ fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.35)", margin: "16px 0 10px", fontFamily: "sans-serif" }}>PASSEURS DU MATCH</div>
                  {Object.entries(
                    (selectedMatch.events || []).filter(e => e.assist).reduce((acc, e) => {
                      acc[e.assist] = (acc[e.assist] || 0) + 1; return acc;
                    }, {})
                  ).sort((a, b) => b[1] - a[1]).map(([name, count], i) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "rgba(59,130,246,0.05)", border: "1px solid rgba(59,130,246,0.12)", borderRadius: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 18 }}>🎯</span>
                      <div style={{ flex: 1, fontFamily: "sans-serif", fontSize: 15, fontWeight: "bold", color: "#fff" }}>{name}</div>
                      <div style={{ fontSize: 28, color: "#60a5fa", fontFamily: "'Bebas Neue', Impact, sans-serif" }}>{count}</div>
                    </div>
                  ))}
                </>
              )}

              {/* Liste détaillée des buts */}
              <div style={{ fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.35)", margin: "16px 0 10px", fontFamily: "sans-serif" }}>DÉTAIL DES BUTS</div>
              {selectedMatch.events?.map((e, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", fontFamily: "sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ color: "rgba(255,255,255,0.3)", minWidth: 24, fontSize: 12 }}>{i + 1}.</span>
                  <span>⚽ <strong style={{ color: "#fff" }}>{e.scorer}</strong></span>
                  {e.assist && <span style={{ color: "rgba(255,255,255,0.4)" }}>← 🎯 {e.assist}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ADMIN: NOUVEAU MATCH ── */}
        {isAdmin && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button onClick={() => { setMatchMode(!matchMode); setPage("classement"); }} style={{ flex: 1, ...(matchMode ? btnDanger : btnPrimary), padding: 14, fontSize: 18, letterSpacing: 2 }}>
              {matchMode ? "❌ Annuler" : "⚽ Nouveau match"}
            </button>
          </div>
        )}

        {/* ── MATCH MODE ── */}
        {isAdmin && matchMode && (
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 22, letterSpacing: 3, color: "#22c55e" }}>⚽ Saisie du match</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)} style={selectStyle}>
                <option value="">Buteur *</option>
                {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ fontFamily: "sans-serif", fontSize: 13, color: "rgba(255,255,255,0.5)", whiteSpace: "nowrap" }}>Nombre de buts :</label>
                <button onClick={() => setGoalQty(Math.max(1, goalQty - 1))} style={{ ...btnSecondary, padding: "8px 14px", fontSize: 18 }}>−</button>
                <span style={{ fontFamily: "sans-serif", fontSize: 22, fontWeight: "bold", minWidth: 30, textAlign: "center", color: "#22c55e" }}>{goalQty}</span>
                <button onClick={() => setGoalQty(goalQty + 1)} style={{ ...btnPrimary, padding: "8px 14px", fontSize: 18 }}>+</button>
              </div>
              {goalQty === 1 && (
                <select value={selectedAssist} onChange={(e) => setSelectedAssist(e.target.value)} style={selectStyle}>
                  <option value="">Passeur décisif (optionnel)</option>
                  {players.filter((p) => p.id !== selectedPlayer).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              {goalQty > 1 && <p style={{ fontFamily: "sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0, textAlign: "center" }}>Les passes sont saisies 1 but à la fois</p>}
              <button onClick={addGoalEvent} disabled={!selectedPlayer} style={{ ...btnBlue, opacity: selectedPlayer ? 1 : 0.4 }}>
                + Ajouter {goalQty > 1 ? `${goalQty} buts` : "le but"}
              </button>
            </div>
            {matchEvents.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, letterSpacing: 2, color: "rgba(255,255,255,0.4)", marginBottom: 8, fontFamily: "sans-serif" }}>BUTS ({matchEvents.length})</div>
                {Object.entries(
                  matchEvents.reduce((acc, e) => {
                    const name = players.find(p => p.id === e.scorerId)?.name || "?";
                    if (!acc[name]) acc[name] = { count: 0, assist: null };
                    acc[name].count++;
                    if (e.assistId) acc[name].assist = players.find(p => p.id === e.assistId)?.name;
                    return acc;
                  }, {})
                ).map(([name, data]) => (
                  <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(34,197,94,0.08)", borderRadius: 8, marginBottom: 6, fontFamily: "sans-serif", fontSize: 14 }}>
                    <span>⚽ <strong>{name}</strong> {data.count > 1 && <span style={{ color: "#22c55e" }}>×{data.count}</span>}{data.assist && <span style={{ color: "rgba(255,255,255,0.5)" }}> → {data.assist}</span>}</span>
                    <button onClick={() => setMatchEvents(matchEvents.filter(e => players.find(p => p.id === e.scorerId)?.name !== name))} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 18 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={validateMatch} disabled={matchEvents.length === 0} style={{ width: "100%", ...btnPrimary, opacity: matchEvents.length > 0 ? 1 : 0.4, fontSize: 20, letterSpacing: 3 }}>✅ Valider le match</button>
          </div>
        )}

        {/* ════════════════════════════════════════
            PAGE : CLASSEMENT
        ════════════════════════════════════════ */}
        {page === "classement" && (
          <>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, marginBottom: 20 }}>
              {["buteurs","passeurs"].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: 12, background: activeTab === tab ? "rgba(34,197,94,0.15)" : "transparent", border: activeTab === tab ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent", borderRadius: 10, color: activeTab === tab ? "#22c55e" : "rgba(255,255,255,0.4)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, letterSpacing: 3, cursor: "pointer" }}>
                  {tab === "buteurs" ? "⚽ Buteurs" : "🎯 Passeurs"}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 28 }}>
              {loading ? (
                <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "sans-serif", color: "rgba(255,255,255,0.3)" }}>Chargement...</div>
              ) : (activeTab === "buteurs" ? sorted("goals") : sorted("assists")).length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "sans-serif", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>Aucun joueur enregistré</div>
              ) : (activeTab === "buteurs" ? sorted("goals") : sorted("assists")).map((player, i) => {
                const rank = i + 1;
                const statKey = activeTab === "buteurs" ? "goals" : "assists";
                const statLabel = activeTab === "buteurs" ? "buts" : "passes";
                const isFlashing = flashId === player.id;
                const isTop3 = rank <= 3 && player[statKey] > 0;
                return (
                  <div key={player.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", marginBottom: 8, borderRadius: 14, background: isFlashing ? "rgba(34,197,94,0.2)" : isTop3 ? `rgba(${rank===1?"255,215,0":rank===2?"192,192,192":"205,127,50"},0.06)` : "rgba(255,255,255,0.03)", border: `1px solid ${isFlashing ? "rgba(34,197,94,0.5)" : isTop3 ? `rgba(${rank===1?"255,215,0":rank===2?"192,192,192":"205,127,50"},0.2)` : "rgba(255,255,255,0.05)"}`, transition: "all 0.3s" }}>
                    <div style={{ width: 32, textAlign: "center", fontSize: isTop3 ? 22 : 14, fontFamily: "sans-serif", color: positionColors[rank] || "rgba(255,255,255,0.3)", fontWeight: "bold", flexShrink: 0 }}>
                      {isTop3 ? trophyIcon(rank) : rank}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 20, letterSpacing: 2, color: isTop3 ? "#fff" : "rgba(255,255,255,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</div>
                      <div style={{ fontFamily: "sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginTop: 2 }}>{player.goals}G · {player.assists}A · {player.matches} matchs</div>
                    </div>
                    <div style={{ fontSize: 36, color: player[statKey] > 0 ? (isTop3 ? positionColors[rank] : "#22c55e") : "rgba(255,255,255,0.15)", minWidth: 50, textAlign: "right", flexShrink: 0 }}>
                      {player[statKey]}
                      <span style={{ fontSize: 11, fontFamily: "sans-serif", display: "block", color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>{statLabel}</span>
                    </div>
                    {isAdmin && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                        <button onClick={() => setEditingPlayer({ id: player.id, goals: player.goals, assists: player.assists, matches: player.matches })} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13, padding: "4px 8px" }}>✏️</button>
                        <button onClick={() => removePlayer(player.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 16, padding: "4px 8px" }}>×</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {isAdmin && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.3)", marginBottom: 10, fontFamily: "sans-serif", textTransform: "uppercase" }}>Ajouter un joueur</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} placeholder="Nom du joueur..." style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={addPlayer} style={{ ...btnPrimary, padding: "12px 20px", fontSize: 20 }}>+</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════
            PAGE : RÉCAPITULATIF
        ════════════════════════════════════════ */}
        {page === "recapitulatif" && (
          <div>
            {/* Chiffres clés */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { label: "MATCHS JOUÉS", value: totalMatches, color: "#22c55e", icon: "📅" },
                { label: "BUTS MARQUÉS", value: totalGoals, color: "#60a5fa", icon: "⚽" },
                { label: "JOUEURS", value: players.length, color: "#f59e0b", icon: "👥" },
                { label: "MOY. BUTS/MATCH", value: totalMatches > 0 ? (totalGoals / totalMatches).toFixed(1) : "0", color: "#a78bfa", icon: "📊" },
              ].map((s) => (
                <div key={s.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "18px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 36, color: s.color }}>{s.value}</div>
                  <div style={{ fontFamily: "sans-serif", fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 2, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Meilleurs joueurs */}
            {topScorer && topScorer.goals > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.35)", marginBottom: 10, fontFamily: "sans-serif" }}>🏆 MEILLEURS JOUEURS</div>
                {[
                  { label: "Meilleur buteur", player: topScorer, stat: topScorer.goals, unit: "buts", color: "#FFD700", icon: "⚽" },
                  ...(topAssister && topAssister.assists > 0 ? [{ label: "Meilleur passeur", player: topAssister, stat: topAssister.assists, unit: "passes", color: "#60a5fa", icon: "🎯" }] : []),
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", marginBottom: 8, borderRadius: 14, background: `rgba(${item.color === "#FFD700" ? "255,215,0" : "96,165,250"},0.06)`, border: `1px solid rgba(${item.color === "#FFD700" ? "255,215,0" : "96,165,250"},0.15)` }}>
                    <span style={{ fontSize: 28 }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "sans-serif", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 2, textTransform: "uppercase" }}>{item.label}</div>
                      <div style={{ fontSize: 22, letterSpacing: 2, color: "#fff" }}>{item.player.name}</div>
                    </div>
                    <div style={{ fontSize: 36, color: item.color }}>
                      {item.stat}
                      <span style={{ fontFamily: "sans-serif", fontSize: 11, display: "block", color: "rgba(255,255,255,0.3)" }}>{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tableau complet */}
            <div style={{ fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.35)", margin: "20px 0 10px", fontFamily: "sans-serif" }}>📋 TABLEAU COMPLET</div>
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 70px", gap: 0, padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["JOUEUR", "⚽", "🎯", "MATCHS"].map(h => <div key={h} style={{ fontFamily: "sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 2, textAlign: h === "JOUEUR" ? "left" : "center" }}>{h}</div>)}
              </div>
              {sorted("goals").map((p, i) => (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px 70px", gap: 0, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <div style={{ fontFamily: "sans-serif", fontSize: 14, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
                    {i < 3 && p.goals > 0 && <span>{trophyIcon(i+1)}</span>}
                    {p.name}
                  </div>
                  <div style={{ fontFamily: "sans-serif", fontSize: 16, color: "#22c55e", textAlign: "center", fontWeight: "bold" }}>{p.goals}</div>
                  <div style={{ fontFamily: "sans-serif", fontSize: 16, color: "#60a5fa", textAlign: "center", fontWeight: "bold" }}>{p.assists}</div>
                  <div style={{ fontFamily: "sans-serif", fontSize: 14, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>{p.matches}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            PAGE : MATCHS PAR DATE
        ════════════════════════════════════════ */}
        {page === "matchs" && (
          <div>
            <div style={{ fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.35)", marginBottom: 14, fontFamily: "sans-serif" }}>
              {matchHistory.length} MATCH{matchHistory.length > 1 ? "S" : ""} ENREGISTRÉ{matchHistory.length > 1 ? "S" : ""}
            </div>
            {matchHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "sans-serif", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>Aucun match enregistré</div>
            ) : matchHistory.map((m, i) => {
              const uniqueScorers = [...new Set(m.events?.map(e => e.scorer) || [])];
              const topScorerMatch = Object.entries(
                (m.events || []).reduce((acc, e) => { acc[e.scorer] = (acc[e.scorer] || 0) + 1; return acc; }, {})
              ).sort((a, b) => b[1] - a[1])[0];
              return (
                <div key={m.id} onClick={() => setSelectedMatch(m)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", marginBottom: 10, borderRadius: 14, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(34,197,94,0.07)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                >
                  {/* Numéro / date */}
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 22, color: "#22c55e" }}>J{matchHistory.length - i}</div>
                    <div style={{ fontFamily: "sans-serif", fontSize: 11, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap" }}>{m.date}</div>
                  </div>

                  {/* Infos */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>
                      {uniqueScorers.slice(0, 3).join(", ")}{uniqueScorers.length > 3 ? ` +${uniqueScorers.length - 3}` : ""}
                    </div>
                    {topScorerMatch && topScorerMatch[1] > 1 && (
                      <div style={{ fontFamily: "sans-serif", fontSize: 11, color: "#FFD700" }}>⭐ {topScorerMatch[0]} ({topScorerMatch[1]} buts)</div>
                    )}
                  </div>

                  {/* Buts + flèche */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 28, color: "#22c55e" }}>{m.events?.length}</div>
                    <div style={{ fontFamily: "sans-serif", fontSize: 10, color: "rgba(255,255,255,0.3)" }}>BUTS</div>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 18, flexShrink: 0 }}>›</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(10,22,40,0.97)", backdropFilter: "blur(12px)", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", zIndex: 50 }}>
        {NAV.map((n) => (
          <button key={n} onClick={() => { setPage(n); setMatchMode(false); }} style={{ flex: 1, padding: "14px 8px 18px", background: "none", border: "none", color: page === n ? "#22c55e" : "rgba(255,255,255,0.35)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 13, letterSpacing: 2, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, transition: "color 0.2s" }}>
            <span style={{ fontSize: 20 }}>{n === "classement" ? "🏆" : n === "recapitulatif" ? "📊" : "📅"}</span>
            {NAV_LABELS[n].split(" ")[1]}
            {page === n && <div style={{ width: 20, height: 2, background: "#22c55e", borderRadius: 2, marginTop: 2 }} />}
          </button>
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.2); }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
        select option { background: #0d2137; color: #fff; }
      `}</style>
    </div>
  );
}

const inputStyle  = { padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontFamily: "sans-serif", fontSize: 14, outline: "none" };
const selectStyle = { width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontFamily: "sans-serif", fontSize: 14, outline: "none", cursor: "pointer" };
const btnPrimary  = { background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Bebas Neue', Impact, sans-serif", cursor: "pointer", padding: 12 };
const btnSecondary= { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "rgba(255,255,255,0.7)", fontFamily: "'Bebas Neue', Impact, sans-serif", cursor: "pointer", padding: 12 };
const btnDanger   = { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "#fca5a5", fontFamily: "'Bebas Neue', Impact, sans-serif", cursor: "pointer", padding: 12 };
const btnBlue     = { width: "100%", padding: 12, background: "linear-gradient(135deg, #1d4ed8, #3b82f6)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 17, letterSpacing: 2, cursor: "pointer" };
