import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, doc, getDocs, addDoc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy
} from "firebase/firestore";

// 🔧 REMPLACE CES VALEURS PAR TON BLOC FIREBASE (étape 1)
const firebaseConfig = {
  apiKey: "AIzaSyBUTJUJ7DCOjGq4noZXalLWqvDaBXZyu80",
  authDomain: "foot-cdc-benin.firebaseapp.com",
  projectId: "foot-cdc-benin",
  storageBucket: "foot-cdc-benin.firebasestorage.app",
  messagingSenderId: "67606549005",
  appId: "1:67606549005:web:a669887869ad72ee85bb44"
};

// 🔑 MOT DE PASSE ADMIN — change-le ici
const ADMIN_PASSWORD = "jeudi2024";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const positionColors = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" };
const trophyIcon = (r) => ({ 1: "🥇", 2: "🥈", 3: "🥉" }[r] || null);

export default function FootballTracker() {
  const [players, setPlayers] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [activeTab, setActiveTab] = useState("buteurs");
  const [matchMode, setMatchMode] = useState(false);
  const [matchEvents, setMatchEvents] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedAssist, setSelectedAssist] = useState("");
  const [newName, setNewName] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flashId, setFlashId] = useState(null);

  // Lecture temps réel depuis Firebase
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
      setIsAdmin(true);
      setShowLogin(false);
      setPasswordError(false);
      setPasswordInput("");
    } else {
      setPasswordError(true);
    }
  };

  const addPlayer = async () => {
    if (!newName.trim()) return;
    if (players.find((p) => p.name.toLowerCase() === newName.trim().toLowerCase())) {
      alert("Ce joueur existe déjà !");
      return;
    }
    await addDoc(collection(db, "players"), {
      name: newName.trim(), goals: 0, assists: 0, matches: 0,
    });
    setNewName("");
  };

  const removePlayer = async (id) => {
    if (!window.confirm("Supprimer ce joueur ?")) return;
    await deleteDoc(doc(db, "players", id));
  };

  const addGoalEvent = () => {
    if (!selectedPlayer) return;
    setMatchEvents([...matchEvents, {
      id: Date.now(),
      scorerId: selectedPlayer,
      assistId: selectedAssist || null,
    }]);
    setSelectedPlayer("");
    setSelectedAssist("");
  };

  const validateMatch = async () => {
    if (matchEvents.length === 0) return;
    // Update each player's stats
    for (const player of players) {
      const goals = matchEvents.filter((e) => e.scorerId === player.id).length;
      const assists = matchEvents.filter((e) => e.assistId === player.id).length;
      if (goals > 0 || assists > 0) {
        await updateDoc(doc(db, "players", player.id), {
          goals: player.goals + goals,
          assists: player.assists + assists,
          matches: player.matches + 1,
        });
      }
    }
    // Save match to history
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
    setMatchEvents([]);
    setMatchMode(false);
  };

  const sorted = (key) => [...players].sort((a, b) => b[key] - a[key] || b.assists - a.assists);
  const displayList = activeTab === "buteurs" ? sorted("goals") : sorted("assists");
  const statKey = activeTab === "buteurs" ? "goals" : "assists";
  const statLabel = activeTab === "buteurs" ? "buts" : "passes";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a1628 0%, #0d2137 40%, #0a1a0a 100%)",
      fontFamily: "'Bebas Neue', 'Impact', sans-serif",
      color: "#f0f4f8",
    }}>
      <div style={{ position: "fixed", inset: 0, backgroundImage: `radial-gradient(circle at 20% 50%, rgba(34,197,94,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(59,130,246,0.06) 0%, transparent 50%)`, pointerEvents: "none" }} />

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", padding: "40px 0 24px" }}>
          <div style={{ fontSize: 48, marginBottom: 4 }}>⚽</div>
          <h1 style={{ fontSize: 42, letterSpacing: 6, margin: 0, background: "linear-gradient(90deg, #22c55e, #86efac, #22c55e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Jeudi Football
          </h1>
          <p style={{ fontFamily: "sans-serif", fontSize: 13, color: "rgba(255,255,255,0.35)", letterSpacing: 3, marginTop: 4, textTransform: "uppercase" }}>
            Classement des guerriers du jeudi
          </p>
          {/* Admin badge / login */}
          <div style={{ marginTop: 12 }}>
            {isAdmin ? (
              <span onClick={() => setIsAdmin(false)} style={{ cursor: "pointer", fontFamily: "sans-serif", fontSize: 12, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e", padding: "4px 12px", borderRadius: 20, letterSpacing: 2 }}>
                ✅ MODE ADMIN — Cliquer pour quitter
              </span>
            ) : (
              <span onClick={() => setShowLogin(true)} style={{ cursor: "pointer", fontFamily: "sans-serif", fontSize: 12, color: "rgba(255,255,255,0.25)", letterSpacing: 2 }}>
                🔒 Accès admin
              </span>
            )}
          </div>
        </div>

        {/* Login modal */}
        {showLogin && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ background: "#0d2137", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 16, padding: 28, width: 300, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
              <h3 style={{ margin: "0 0 16px", fontSize: 22, letterSpacing: 3 }}>MOT DE PASSE</h3>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                onKeyDown={(e) => e.key === "Enter" && tryLogin()}
                placeholder="Mot de passe..."
                style={{ ...inputStyle, width: "100%", marginBottom: 8, textAlign: "center" }}
              />
              {passwordError && <p style={{ fontFamily: "sans-serif", color: "#f87171", fontSize: 13, margin: "0 0 8px" }}>Mot de passe incorrect</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => { setShowLogin(false); setPasswordInput(""); }} style={{ ...btnSecondary, flex: 1 }}>Annuler</button>
                <button onClick={tryLogin} style={{ ...btnPrimary, flex: 1 }}>Entrer</button>
              </div>
            </div>
          </div>
        )}

        {/* Admin actions */}
        {isAdmin && (
          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            <button onClick={() => setMatchMode(!matchMode)} style={{ flex: 1, ...( matchMode ? btnDanger : btnPrimary), padding: 14, fontSize: 18, letterSpacing: 2 }}>
              {matchMode ? "❌ Annuler" : "⚽ Nouveau match"}
            </button>
            <button onClick={() => setShowHistory(!showHistory)} style={{ ...btnSecondary, padding: "14px 20px", fontSize: 18 }}>📋</button>
          </div>
        )}

        {!isAdmin && (
          <div style={{ marginBottom: 24 }}>
            <button onClick={() => setShowHistory(!showHistory)} style={{ ...btnSecondary, width: "100%", padding: 14, fontSize: 18, letterSpacing: 2 }}>
              📋 Historique des matchs
            </button>
          </div>
        )}

        {/* Match Mode */}
        {isAdmin && matchMode && (
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 22, letterSpacing: 3, color: "#22c55e" }}>⚽ Saisie du match</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)} style={selectStyle}>
                <option value="">Buteur *</option>
                {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={selectedAssist} onChange={(e) => setSelectedAssist(e.target.value)} style={selectStyle}>
                <option value="">Passeur décisif (optionnel)</option>
                {players.filter((p) => p.id !== selectedPlayer).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={addGoalEvent} disabled={!selectedPlayer} style={{ ...btnBlue, opacity: selectedPlayer ? 1 : 0.4 }}>
                + Ajouter le but
              </button>
            </div>
            {matchEvents.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, letterSpacing: 2, color: "rgba(255,255,255,0.4)", marginBottom: 8, fontFamily: "sans-serif" }}>BUTS ({matchEvents.length})</div>
                {matchEvents.map((e) => {
                  const scorer = players.find((p) => p.id === e.scorerId);
                  const assist = e.assistId ? players.find((p) => p.id === e.assistId) : null;
                  return (
                    <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(34,197,94,0.08)", borderRadius: 8, marginBottom: 6, fontFamily: "sans-serif", fontSize: 14 }}>
                      <span>⚽ <strong>{scorer?.name}</strong>{assist && <span style={{ color: "rgba(255,255,255,0.5)" }}> → {assist.name}</span>}</span>
                      <button onClick={() => setMatchEvents(matchEvents.filter((x) => x.id !== e.id))} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 18 }}>×</button>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={validateMatch} disabled={matchEvents.length === 0} style={{ width: "100%", ...btnPrimary, opacity: matchEvents.length > 0 ? 1 : 0.4, fontSize: 20, letterSpacing: 3 }}>
              ✅ Valider le match
            </button>
          </div>
        )}

        {/* History */}
        {showHistory && (
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 22, letterSpacing: 3 }}>📋 Historique</h3>
            {matchHistory.length === 0 ? (
              <p style={{ fontFamily: "sans-serif", color: "rgba(255,255,255,0.3)", fontSize: 14, textAlign: "center", padding: "20px 0" }}>Aucun match enregistré</p>
            ) : matchHistory.map((m) => (
              <div key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ fontFamily: "sans-serif", fontSize: 12, color: "#22c55e", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>
                  Jeudi {m.date} — {m.events?.length} but{m.events?.length > 1 ? "s" : ""}
                </div>
                {m.events?.map((e, i) => (
                  <div key={i} style={{ fontFamily: "sans-serif", fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 3 }}>
                    ⚽ {e.scorer}{e.assist && <span style={{ color: "rgba(255,255,255,0.4)" }}> ← {e.assist}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4, marginBottom: 20 }}>
          {["buteurs", "passeurs"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: 12, background: activeTab === tab ? "rgba(34,197,94,0.15)" : "transparent", border: activeTab === tab ? "1px solid rgba(34,197,94,0.3)" : "1px solid transparent", borderRadius: 10, color: activeTab === tab ? "#22c55e" : "rgba(255,255,255,0.4)", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 18, letterSpacing: 3, cursor: "pointer" }}>
              {tab === "buteurs" ? "⚽ Buteurs" : "🎯 Passeurs"}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        <div style={{ marginBottom: 28 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "sans-serif", color: "rgba(255,255,255,0.3)" }}>Chargement...</div>
          ) : displayList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", fontFamily: "sans-serif", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
              {isAdmin ? "Ajoutez des joueurs ci-dessous !" : "Aucun joueur encore enregistré."}
            </div>
          ) : displayList.map((player, i) => {
            const rank = i + 1;
            const isFlashing = flashId === player.id;
            const isTop3 = rank <= 3 && player[statKey] > 0;
            return (
              <div key={player.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", marginBottom: 8, borderRadius: 14, background: isFlashing ? "rgba(34,197,94,0.2)" : isTop3 ? `rgba(${rank===1?"255,215,0":rank===2?"192,192,192":"205,127,50"},0.06)` : "rgba(255,255,255,0.03)", border: `1px solid ${isFlashing ? "rgba(34,197,94,0.5)" : isTop3 ? `rgba(${rank===1?"255,215,0":rank===2?"192,192,192":"205,127,50"},0.2)` : "rgba(255,255,255,0.05)"}`, transition: "all 0.3s", transform: isFlashing ? "scale(1.02)" : "scale(1)" }}>
                <div style={{ width: 32, textAlign: "center", fontSize: isTop3 ? 22 : 14, fontFamily: "sans-serif", color: positionColors[rank] || "rgba(255,255,255,0.3)", fontWeight: "bold", flexShrink: 0 }}>
                  {isTop3 ? trophyIcon(rank) : rank}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 20, letterSpacing: 2, color: isTop3 ? "#fff" : "rgba(255,255,255,0.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</div>
                  <div style={{ fontFamily: "sans-serif", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1, marginTop: 2 }}>
                    {player.goals}G · {player.assists}A · {player.matches} matchs
                  </div>
                </div>
                <div style={{ fontSize: 36, color: player[statKey] > 0 ? (isTop3 ? positionColors[rank] : "#22c55e") : "rgba(255,255,255,0.15)", minWidth: 50, textAlign: "right", flexShrink: 0 }}>
                  {player[statKey]}
                  <span style={{ fontSize: 11, fontFamily: "sans-serif", display: "block", color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>{statLabel}</span>
                </div>
                {isAdmin && (
                  <button onClick={() => removePlayer(player.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 18, padding: "0 4px", flexShrink: 0 }}>×</button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add player (admin only) */}
        {isAdmin && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 14, letterSpacing: 2, color: "rgba(255,255,255,0.3)", marginBottom: 10, fontFamily: "sans-serif", textTransform: "uppercase" }}>Ajouter un joueur</div>
            <div style={{ display: "flex", gap: 10 }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} placeholder="Nom du joueur..." style={{ ...inputStyle, flex: 1 }} />
              <button onClick={addPlayer} style={{ ...btnPrimary, padding: "12px 20px", fontSize: 20 }}>+</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.2); }
        select option { background: #0d2137; color: #fff; }
      `}</style>
    </div>
  );
}

// Styles réutilisables
const inputStyle = { padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontFamily: "sans-serif", fontSize: 14, outline: "none" };
const selectStyle = { width: "100%", padding: "12px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", fontFamily: "sans-serif", fontSize: 14, outline: "none", cursor: "pointer" };
const btnPrimary = { background: "linear-gradient(135deg, #16a34a, #22c55e)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Bebas Neue', Impact, sans-serif", cursor: "pointer", padding: 12 };
const btnSecondary = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "rgba(255,255,255,0.7)", fontFamily: "'Bebas Neue', Impact, sans-serif", cursor: "pointer", padding: 12 };
const btnDanger = { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "#fca5a5", fontFamily: "'Bebas Neue', Impact, sans-serif", cursor: "pointer", padding: 12 };
const btnBlue = { width: "100%", padding: 12, background: "linear-gradient(135deg, #1d4ed8, #3b82f6)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: 17, letterSpacing: 2, cursor: "pointer" };
