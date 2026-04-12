import { CHANNELS, API_HEALTH, QUEUE, PENDING_TOPICS_COUNT } from "../constants";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "channels",  label: "Channels",  icon: "📺" },
  { id: "topics",    label: "Topics",    icon: "💡" },
  { id: "create",    label: "Create",    icon: "＋" },
  { id: "queue",     label: "Queue",     icon: "⚙" },
  { id: "voices",    label: "Voices",    icon: "🎙" },
  { id: "analytics", label: "Analytics", icon: "📊" },
];

function PulsingDot({ color }) {
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 5px ${color}`, animation: "pulse 2s infinite", flexShrink: 0 }} />;
}

export default function Sidebar({ activeTab, setActiveTab }) {
  const activeJobs = QUEUE.filter(q => q.stage !== "done" && q.stage !== "queued").length;

  return (
    <div style={{
      position: "fixed", left: 0, top: 0, bottom: 0, width: 230,
      background: "#07071a", borderRight: "1px solid #10102a",
      display: "flex", flexDirection: "column", padding: "22px 0", zIndex: 200,
    }}>
      {/* Logo */}
      <div style={{ padding: "0 22px 26px" }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 17, fontWeight: 700, color: "#a78bfa", letterSpacing: -0.5 }}>
          autopilot<span style={{ color: "#6d28d9" }}>.yt</span>
        </div>
        <div style={{ fontSize: 10, color: "#2e2e50", marginTop: 3, letterSpacing: 2.5, textTransform: "uppercase" }}>Faceless · Automated</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {TABS.map(t => {
          const isActive = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: isActive ? "linear-gradient(90deg, #18104a, #0e1030)" : "transparent",
              border: isActive ? "1px solid #2d1b6e" : "1px solid transparent",
              borderRadius: 10, color: isActive ? "#c4b5fd" : "#3d3d60",
              padding: "10px 13px", display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", textAlign: "left", fontSize: 13, fontWeight: 600,
              transition: "all 0.15s", width: "100%",
            }}>
              <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{t.icon}</span>
              {t.label}
              {t.id === "queue" && activeJobs > 0 && (
                <span style={{ marginLeft: "auto", background: "#7c3aed", color: "#fff", fontSize: 10, padding: "1px 7px", borderRadius: 20, fontFamily: "'Space Mono', monospace" }}>
                  {activeJobs}
                </span>
              )}
              {t.id === "topics" && PENDING_TOPICS_COUNT > 0 && (
                <span style={{ marginLeft: "auto", background: "#f59e0b", color: "#000", fontSize: 10, padding: "1px 7px", borderRadius: 20, fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>
                  {PENDING_TOPICS_COUNT}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Channels quick view */}
      <div style={{ padding: "14px 14px", borderTop: "1px solid #10102a", borderBottom: "1px solid #10102a", margin: "0 0 14px" }}>
        <div style={{ fontSize: 10, color: "#2e2e50", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Active Channels</div>
        {CHANNELS.filter(c => c.status === "live").map(ch => (
          <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
            <span style={{ fontSize: 16 }}>{ch.avatar}</span>
            <span style={{ fontSize: 12, color: "#6b7280", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ch.name}</span>
            <PulsingDot color="#10b981" />
          </div>
        ))}
      </div>

      {/* API Health */}
      <div style={{ padding: "0 16px" }}>
        <div style={{ fontSize: 10, color: "#2e2e50", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>API Health</div>
        {API_HEALTH.map(api => (
          <div key={api.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0" }}>
            <span style={{ fontSize: 11, color: "#3d3d60" }}>{api.name}</span>
            <PulsingDot color={api.status === "ok" ? "#10b981" : api.status === "warn" ? "#f59e0b" : "#ef4444"} />
          </div>
        ))}
      </div>
    </div>
  );
}
