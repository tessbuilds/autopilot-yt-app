// ── Queue Page ────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { QUEUE, PIPELINE_STAGES } from "../constants";
import { ProgressBar, Badge, PageHeader, SectionLabel } from "../components/ui";

function QueueItem({ item, liveProgress }) {
  const meta = PIPELINE_STAGES[item.stage];
  const progress = Math.round(liveProgress[item.id] ?? item.progress);
  return (
    <div style={{ background:"#08081e", border:"1px solid #12122a", borderRadius:12, padding:"16px 20px", display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ color:"#c4c4e0", fontSize:13, fontWeight:600, lineHeight:1.4, marginBottom:2 }}>{item.title}</div>
          <div style={{ color:"#3d3d60", fontSize:11 }}>{item.channel} · {item.createdAt}</div>
        </div>
        <Badge label={meta.label} color={meta.color} icon={meta.icon} />
      </div>
      {item.stage !== "queued" && (
        <>
          <ProgressBar value={progress} color={meta.color} />
          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:11, color:"#3d3d60" }}>{progress}%</span>
            <span style={{ fontSize:11, color:"#3d3d60" }}>ETA {item.eta}</span>
          </div>
        </>
      )}
    </div>
  );
}

export function Queue() {
  const [liveProgress, setLiveProgress] = useState(() => {
    const init = {};
    QUEUE.forEach(q => { init[q.id] = q.progress; });
    return init;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveProgress(prev => {
        const next = { ...prev };
        QUEUE.forEach(q => {
          if (q.stage !== "queued" && q.stage !== "publishing" && q.stage !== "done") {
            next[q.id] = Math.min(99, (next[q.id] || 0) + Math.random() * 0.5);
          }
        });
        return next;
      });
    }, 700);
    return () => clearInterval(interval);
  }, []);

  const grouped = {};
  Object.keys(PIPELINE_STAGES).forEach(s => { grouped[s] = []; });
  QUEUE.forEach(item => { if (grouped[item.stage]) grouped[item.stage].push(item); });

  return (
    <div className="fade-in">
      <PageHeader title="Pipeline Queue" subtitle={`${QUEUE.length} videos · live updates`} />
      {/* Stage legend */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:24 }}>
        {Object.entries(PIPELINE_STAGES).filter(([k]) => k !== "done").map(([key, m]) => (
          <Badge key={key} label={`${m.label} (${grouped[key]?.length || 0})`} color={m.color} icon={m.icon} />
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {QUEUE.map(item => <QueueItem key={item.id} item={item} liveProgress={liveProgress} />)}
      </div>
    </div>
  );
}

// ── Voices Page ───────────────────────────────────────────────────
import { VOICES } from "../constants";
import { Button } from "../components/ui";

export function Voices() {
  const [playing, setPlaying] = useState(null);

  return (
    <div className="fade-in" style={{ maxWidth:640 }}>
      <PageHeader title="Voice Library" subtitle="Cloned voices via ElevenLabs · assign per channel" />
      <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:24 }}>
        {Object.entries(VOICES).map(([chId, v]) => (
          <div key={v.id} style={{
            background:"#08081e", border:"1px solid #12122a",
            borderRadius:14, padding:"20px 24px",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:16 }}>
              <div style={{ width:48, height:48, borderRadius:"50%", background:"linear-gradient(135deg,#7c3aed,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>🎙️</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <span style={{ color:"#e0e0ff", fontWeight:700, fontSize:15 }}>{v.name}</span>
                  <Badge label={chId.toUpperCase()} color="#7c3aed" />
                </div>
                <div style={{ color:"#3d3d60", fontSize:12, fontFamily:"'Space Mono',monospace" }}>ElevenLabs · {v.id}</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Button small variant="secondary" onClick={() => setPlaying(playing === v.id ? null : v.id)}>
                  {playing === v.id ? "⏹ Stop" : "▶ Preview"}
                </Button>
              </div>
            </div>
            {/* Settings */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
              {[["Stability", "0.75"], ["Similarity", "0.85"], ["Style", "0.40"], ["Speed", "1.0×"]].map(([k, val]) => (
                <div key={k} style={{ background:"#06061a", borderRadius:8, padding:"8px 12px" }}>
                  <div style={{ fontSize:10, color:"#2e2e50", marginBottom:4 }}>{k}</div>
                  <div style={{ fontSize:13, color:"#a78bfa", fontFamily:"'Space Mono',monospace" }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button style={{
        width:"100%", background:"transparent", border:"2px dashed #2d1b6e",
        borderRadius:14, color:"#7c3aed", padding:"18px", fontSize:13, fontWeight:700,
        cursor:"pointer",
      }}>+ Upload Voice Sample to Clone via ElevenLabs</button>
    </div>
  );
}

// ── Channels Page ─────────────────────────────────────────────────
import { CHANNELS } from "../constants";

export function Channels({ setActiveTab }) {
  return (
    <div className="fade-in">
      <PageHeader
        title="Channels"
        subtitle="Manage your faceless YouTube channels"
        actions={<Button onClick={() => setActiveTab && setActiveTab("create")}>+ New Channel</Button>}
      />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:16 }}>
        {CHANNELS.map(ch => {
          const statusColor = ch.status === "live" ? "#10b981" : ch.status === "paused" ? "#f59e0b" : "#6b7280";
          return (
            <div key={ch.id} style={{ background:"#08081e", border:"1px solid #12122a", borderRadius:16, padding:24 }}>
              <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
                <span style={{ fontSize:42 }}>{ch.avatar}</span>
                <div style={{ flex:1 }}>
                  <div style={{ color:"#e0e0ff", fontWeight:700, fontSize:16, marginBottom:2 }}>{ch.name}</div>
                  <div style={{ color:"#3d3d60", fontSize:12 }}>{ch.niche} · {ch.schedule}</div>
                </div>
                <Badge label={ch.status.toUpperCase()} color={statusColor} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
                {[["Videos", ch.videos], ["Subscribers", ch.subs], ["Revenue", `$${ch.revenue}/mo`]].map(([l, v]) => (
                  <div key={l} style={{ background:"#06061a", borderRadius:10, padding:"12px 14px" }}>
                    <div style={{ fontSize:10, color:"#2e2e50", marginBottom:4 }}>{l}</div>
                    <div style={{ color:"#e0e0ff", fontSize:16, fontFamily:"'Space Mono',monospace", fontWeight:700 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:"#06061a", borderRadius:10, padding:"10px 14px", marginBottom:16 }}>
                <div style={{ fontSize:10, color:"#2e2e50", marginBottom:2 }}>Voice Persona</div>
                <div style={{ fontSize:13, color:"#a78bfa", fontWeight:600 }}>🎙️ {ch.voice} · ElevenLabs</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <Button small variant="secondary" style={{ flex:1, justifyContent:"center" }}>Settings</Button>
                <Button small style={{ flex:1, justifyContent:"center" }}>+ Create Video</Button>
              </div>
            </div>
          );
        })}
        {/* Add channel card */}
        <button style={{
          background:"transparent", border:"2px dashed #2d1b6e", borderRadius:16, padding:24,
          cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", gap:12, minHeight:200, color:"#7c3aed",
        }}>
          <span style={{ fontSize:40 }}>➕</span>
          <span style={{ fontSize:13, fontWeight:700 }}>Add New Channel</span>
          <span style={{ fontSize:12, color:"#3d3d60" }}>Connect YouTube account & configure niche</span>
        </button>
      </div>
    </div>
  );
}

// ── Analytics Page ────────────────────────────────────────────────
import { ANALYTICS_DATA } from "../constants";

function LineChart({ data, months, color = "#7c3aed", label, height = 140 }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100 / (data.length - 1);
  const pts = data.map((v, i) => `${i * w},${height - ((v - min) / range) * (height - 12)}`).join(" ");
  return (
    <div style={{ background:"#08081e", border:"1px solid #12122a", borderRadius:14, padding:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
        <span style={{ fontSize:11, color:"#3d3d60", textTransform:"uppercase", letterSpacing:2 }}>{label}</span>
        <span style={{ fontSize:14, color, fontFamily:"'Space Mono',monospace", fontWeight:700 }}>
          {typeof data[11] === "number" && data[11] > 1000 ? `${(data[11]/1000).toFixed(1)}K` : data[11]}
        </span>
      </div>
      <svg viewBox={`0 0 100 ${height}`} style={{ width:"100%", height }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`g${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polygon points={`0,${height} ${pts} 100,${height}`} fill={`url(#g${label})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
        {data.map((v, i) => (
          <circle key={i} cx={i * w} cy={height - ((v - min) / range) * (height - 12)} r="1.8" fill={color} />
        ))}
      </svg>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
        {months.map(m => <span key={m} style={{ fontSize:9, color:"#2e2e50" }}>{m}</span>)}
      </div>
    </div>
  );
}

export function Analytics() {
  return (
    <div className="fade-in">
      <PageHeader title="Analytics" subtitle="Performance across all channels — 12 months" />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:24 }}>
        <div style={{ background:"#08081e", border:"1px solid #12122a", borderRadius:14, padding:20 }}>
          <div style={{ fontSize:11, color:"#3d3d60", textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>Total Views</div>
          <div style={{ fontSize:28, fontFamily:"'Space Mono',monospace", color:"#e0e0ff", fontWeight:700 }}>2.1M</div>
          <div style={{ fontSize:12, color:"#10b981" }}>+34% YoY</div>
        </div>
        <div style={{ background:"#08081e", border:"1px solid #12122a", borderRadius:14, padding:20 }}>
          <div style={{ fontSize:11, color:"#3d3d60", textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>Avg CTR</div>
          <div style={{ fontSize:28, fontFamily:"'Space Mono',monospace", color:"#e0e0ff", fontWeight:700 }}>6.8%</div>
          <div style={{ fontSize:12, color:"#10b981" }}>+1.2pp vs industry avg</div>
        </div>
        <div style={{ background:"#08081e", border:"1px solid #12122a", borderRadius:14, padding:20 }}>
          <div style={{ fontSize:11, color:"#3d3d60", textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>RPM (avg)</div>
          <div style={{ fontSize:28, fontFamily:"'Space Mono',monospace", color:"#e0e0ff", fontWeight:700 }}>$4.20</div>
          <div style={{ fontSize:12, color:"#10b981" }}>True Crime leads at $6.80</div>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
        <LineChart data={ANALYTICS_DATA.views}   months={ANALYTICS_DATA.months} color="#7c3aed" label="Monthly Views" />
        <LineChart data={ANALYTICS_DATA.revenue} months={ANALYTICS_DATA.months} color="#10b981" label="Monthly Revenue ($)" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <LineChart data={ANALYTICS_DATA.uploads} months={ANALYTICS_DATA.months} color="#3b82f6" label="Videos Published" height={100} />
        {/* Top videos table */}
        <div style={{ background:"#08081e", border:"1px solid #12122a", borderRadius:14, padding:20 }}>
          <SectionLabel>Top Performing Videos</SectionLabel>
          {[
            ["MH370 — New Evidence",       "True Crime Daily", "841K"],
            ["Your Brain Lies To You",     "Mind Unlocked",    "512K"],
            ["Amazon's Hidden Predators",  "Earth Unseen",     "298K"],
            ["Zodiac Killer's Code",       "True Crime Daily", "187K"],
          ].map(([title, ch, views]) => (
            <div key={title} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #10102a" }}>
              <div>
                <div style={{ fontSize:12, color:"#c4c4e0", fontWeight:600 }}>{title}</div>
                <div style={{ fontSize:11, color:"#3d3d60" }}>{ch}</div>
              </div>
              <div style={{ fontSize:13, color:"#a78bfa", fontFamily:"'Space Mono',monospace", fontWeight:700 }}>{views}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
