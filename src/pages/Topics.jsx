import { useState, useEffect } from "react";
import { Button, Badge, PageHeader, SectionLabel, Spinner, Select } from "../components/ui";
import { CHANNELS, API_BASE, API_KEY } from "../constants";

// ── Mock topic candidates (replace with real API fetch) ───────────────────
export const MOCK_TOPICS = [
  { topic_id:"t001", channel_id:"ch_001", channel_name:"True Crime Daily",  title:"The Real Story Behind the Golden State Killer's 40-Year Escape",         hook:"In 1976, a killer slipped into a California home and was never caught — until DNA changed everything.",           why:"Golden State Killer remains one of the highest-search true crime topics post-documentary.", source:"evergreen", estimated_search_volume:"high",   status:"pending_review", created_at:"2026-04-06T08:00:00Z" },
  { topic_id:"t002", channel_id:"ch_001", channel_name:"True Crime Daily",  title:"The Disappearance That Stumped the FBI for 30 Years",                      hook:"She walked out of her house on a Tuesday morning and was never seen again. The FBI has no answers.",              why:"FBI cold cases trend consistently — 'disappeared without a trace' angle drives high watch time.", source:"trending", estimated_search_volume:"high",   status:"pending_review", created_at:"2026-04-06T08:00:00Z" },
  { topic_id:"t003", channel_id:"ch_001", channel_name:"True Crime Daily",  title:"Why Serial Killers Always Hide in Plain Sight",                            hook:"They have jobs. Families. Neighbors who call them 'such a nice guy.' Here's how they do it.",                   why:"Psychology-meets-crime angle gets shared heavily on social.", source:"evergreen", estimated_search_volume:"medium", status:"pending_review", created_at:"2026-04-06T08:00:00Z" },
  { topic_id:"t004", channel_id:"ch_001", channel_name:"True Crime Daily",  title:"The Unabomber's Manifesto: What He Actually Got Right",                    hook:"He mailed bombs for 17 years. But buried inside his 35,000-word manifesto were ideas that scientists now debate.", why:"Controversial intellectual angle — drives comments and debate.", source:"evergreen", estimated_search_volume:"medium", status:"pending_review", created_at:"2026-04-06T08:00:00Z" },
  { topic_id:"t005", channel_id:"ch_002", channel_name:"Mind Unlocked",     title:"The Psychological Trick Your Brain Uses to Rewrite Your Memories",         hook:"That vivid memory you're so sure about? It probably never happened — at least not the way you think it did.",     why:"Memory distortion is a proven high-CTR psychology topic with broad appeal.", source:"evergreen", estimated_search_volume:"high",   status:"pending_review", created_at:"2026-04-06T08:01:00Z" },
  { topic_id:"t006", channel_id:"ch_002", channel_name:"Mind Unlocked",     title:"Why Smart People Make Terrible Decisions",                                  hook:"Higher IQ correlates with more sophisticated rationalization of bad choices — not better decisions.",               why:"Counterintuitive 'smart people' hook performs extremely well in psychology.", source:"evergreen", estimated_search_volume:"high",   status:"pending_review", created_at:"2026-04-06T08:01:00Z" },
  { topic_id:"t007", channel_id:"ch_002", channel_name:"Mind Unlocked",     title:"The Science of Why You Can't Stop Doomscrolling",                          hook:"You open your phone for 5 minutes. An hour later you're watching a stranger's cat video from 2019.",               why:"Extremely timely — social media addiction is top-searched mental health topic in 2026.", source:"trending", estimated_search_volume:"high",   status:"pending_review", created_at:"2026-04-06T08:01:00Z" },
  { topic_id:"t008", channel_id:"ch_003", channel_name:"Earth Unseen",      title:"The Ocean Layer Scientists Refuse to Explore",                             hook:"Below 1,000 meters, 95% of the ocean has never been mapped. What lives there might change biology forever.",       why:"Mystery + ocean + science = proven high-retention combo for nature docs.", source:"evergreen", estimated_search_volume:"medium", status:"pending_review", created_at:"2026-04-06T08:02:00Z" },
  { topic_id:"t009", channel_id:"ch_003", channel_name:"Earth Unseen",      title:"The Creature That Survived All Five Mass Extinctions",                     hook:"It watched the dinosaurs die. It survived the Ice Age. It's still alive today — and it hasn't changed in 450 million years.", why:"Evolutionary resilience topics consistently outperform on nature channels.", source:"evergreen", estimated_search_volume:"medium", status:"pending_review", created_at:"2026-04-06T08:02:00Z" },
  { topic_id:"t010", channel_id:"ch_004", channel_name:"Finance Decoded",   title:"The Investment Strategy Warren Buffett Uses That Nobody Talks About",      hook:"Everyone knows 'buy and hold.' But Buffett's real edge isn't what he buys — it's the structure he uses to buy it.", why:"Buffett + hidden strategy angle drives massive search and shares in finance.", source:"evergreen", estimated_search_volume:"high",   status:"pending_review", created_at:"2026-04-06T08:03:00Z" },
  { topic_id:"t011", channel_id:"ch_004", channel_name:"Finance Decoded",   title:"Why 90% of Day Traders Lose Everything (The Math They Don't Show You)",   hook:"The brokerage apps are beautiful, the fees look tiny, and the math is quietly destroying you.",                    why:"Anti-day-trading content reliably gets saved and shared by finance community.", source:"evergreen", estimated_search_volume:"high",   status:"pending_review", created_at:"2026-04-06T08:03:00Z" },
];

const VOL_COLOR = { high: "#10b981", medium: "#f59e0b", low: "#6b7280" };
const SRC_COLOR = { trending: "#3b82f6", evergreen: "#8b5cf6" };

function TopicCard({ topic, selected, onSelect, onApprove, onReject, approving, rejecting }) {
  return (
    <div style={{
      background: selected ? "#0e0e2a" : "#08081e",
      border: `1px solid ${selected ? "#4f46e5" : "#12122a"}`,
      borderRadius: 14, padding: "18px 20px",
      transition: "all 0.15s",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <input
          type="checkbox" checked={selected} onChange={onSelect}
          style={{ marginTop: 3, accentColor: "#7c3aed", cursor: "pointer", flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#e0e0ff", fontSize: 14, fontWeight: 700, lineHeight: 1.4, marginBottom: 6 }}>
            {topic.title}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Badge label={topic.source}                         color={SRC_COLOR[topic.source] || "#6b7280"} />
            <Badge label={`${topic.estimated_search_volume} volume`} color={VOL_COLOR[topic.estimated_search_volume] || "#6b7280"} />
          </div>
        </div>
      </div>

      {/* Hook */}
      <div style={{ background: "#06061a", borderRadius: 8, padding: "10px 14px", marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "#3d3d60", marginBottom: 3, textTransform: "uppercase", letterSpacing: 1 }}>Hook (first 15 sec)</div>
        <div style={{ fontSize: 12, color: "#8888aa", fontStyle: "italic", lineHeight: 1.5 }}>"{topic.hook}"</div>
      </div>

      {/* Why */}
      <div style={{ fontSize: 12, color: "#4b5563", marginBottom: 14, lineHeight: 1.5 }}>
        💡 {topic.why}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          variant="success" small
          onClick={onApprove}
          disabled={approving || rejecting}
          style={{ flex: 1, justifyContent: "center" }}
        >
          {approving ? <><Spinner size={12} /> Queuing…</> : "✓ Approve"}
        </Button>
        <Button
          variant="secondary" small
          onClick={onReject}
          disabled={approving || rejecting}
          style={{ flex: 1, justifyContent: "center", color: rejecting ? "#ef4444" : undefined }}
        >
          {rejecting ? <><Spinner size={12} /> …</> : "✕ Reject"}
        </Button>
      </div>
    </div>
  );
}

export default function Topics() {
  const [topics, setTopics]         = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/autopilot/topics?status=pending_review`, {
      headers: { "x-app-key": API_KEY },
    })
      .then(r => r.json())
      .then(d => setTopics(d.topics || []));
  }, []);
  const [selected, setSelected]     = useState(new Set());
  const [filterCh, setFilterCh]     = useState("all");
  const [filterSrc, setFilterSrc]   = useState("all");
  const [filterVol, setFilterVol]   = useState("all");
  const [loading, setLoading]       = useState({});
  const [generating, setGenerating] = useState(false);
  const [toast, setToast]           = useState(null);

  const pending = topics.filter(t => t.status === "pending_review");

  const filtered = pending.filter(t => {
    if (filterCh  !== "all" && t.channel_id !== filterCh)   return false;
    if (filterSrc !== "all" && t.source     !== filterSrc)  return false;
    if (filterVol !== "all" && t.estimated_search_volume !== filterVol) return false;
    return true;
  });

  // Group by channel
  const grouped = {};
  filtered.forEach(t => {
    grouped[t.channel_id] = grouped[t.channel_id] || { name: t.channel_name, topics: [] };
    grouped[t.channel_id].topics.push(t);
  });

  const showToast = (msg, color = "#10b981") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3000);
  };

  const approve = async (topicId) => {
    setLoading(p => ({ ...p, [topicId]: "approving" }));
    await fetch(`${API_BASE}/api/autopilot/topics/${topicId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
      body: JSON.stringify({}),
    });
    setTopics(p => p.map(t => t.topic_id === topicId ? { ...t, status: "approved" } : t));
    setLoading(p => ({ ...p, [topicId]: null }));
    showToast("✅ Approved — job created in pipeline");
  };

  const reject = async (topicId) => {
    setLoading(p => ({ ...p, [topicId]: "rejecting" }));
    await fetch(`${API_BASE}/api/autopilot/topics/${topicId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
      body: JSON.stringify({ reason: "Rejected from dashboard" }),
    });
    setTopics(p => p.map(t => t.topic_id === topicId ? { ...t, status: "rejected" } : t));
    setLoading(p => ({ ...p, [topicId]: null }));
    setSelected(p => { const n = new Set(p); n.delete(topicId); return n; });
    showToast("✕ Rejected", "#ef4444");
  };

  const bulkApprove = () => {
    if (!selected.size) return;
    [...selected].forEach(id => approve(id));
    setSelected(new Set());
  };

  const bulkReject = () => {
    if (!selected.size) return;
    [...selected].forEach(id => reject(id));
    setSelected(new Set());
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(t => t.topic_id)));
    }
  };

const generateNew = async () => {
  setGenerating(true);
  
  // Fire and forget — don't await
  fetch(`${API_BASE}/api/autopilot/topics/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
    body: JSON.stringify({ candidate_count: 10 }),
  });

  // Wait 30 seconds then re-fetch
  await new Promise(r => setTimeout(r, 30000));
  
  const res = await fetch(`${API_BASE}/api/autopilot/topics?status=pending_review`, {
    headers: { "x-app-key": API_KEY },
  });
  const d = await res.json();
  setTopics(d.topics || []);
  setGenerating(false);
  showToast("✅ New topics generated");
};

  const approvedCount = topics.filter(t => t.status === "approved").length;
  const rejectedCount = topics.filter(t => t.status === "rejected").length;

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 1000,
          background: "#0e0e28", border: `1px solid ${toast.color}44`,
          borderRadius: 10, padding: "12px 20px",
          color: toast.color, fontSize: 13, fontWeight: 600,
          boxShadow: `0 0 20px ${toast.color}22`,
          animation: "fadeIn 0.2s ease",
        }}>{toast.msg}</div>
      )}

      <PageHeader
        title="Topic Queue"
        subtitle={`${pending.length} pending review · ${approvedCount} approved · ${rejectedCount} rejected this week`}
        actions={
          <Button onClick={generateNew} disabled={generating}>
            {generating ? <><Spinner size={14} /> Generating…</> : "🔄 Generate New Topics"}
          </Button>
        }
      />

      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Pending Review", value: pending.length,   color: "#f59e0b" },
          { label: "Approved",       value: approvedCount,    color: "#10b981" },
          { label: "Rejected",       value: rejectedCount,    color: "#ef4444" },
          { label: "In Pipeline",    value: approvedCount,    color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} style={{ background: "#08081e", border: "1px solid #12122a", borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 24, fontFamily: "'Space Mono',monospace", color: s.color, fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "#3d3d60", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters + bulk actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <Select value={filterCh} onChange={setFilterCh} options={[
          { value: "all", label: "All Channels" },
          ...CHANNELS.map(c => ({ value: c.id, label: `${c.avatar} ${c.name}` })),
        ]} />
        <Select value={filterSrc} onChange={setFilterSrc} options={[
          { value: "all",       label: "All Sources"  },
          { value: "trending",  label: "🔥 Trending"  },
          { value: "evergreen", label: "🌲 Evergreen" },
        ]} />
        <Select value={filterVol} onChange={setFilterVol} options={[
          { value: "all",    label: "All Volumes" },
          { value: "high",   label: "📈 High"     },
          { value: "medium", label: "📊 Medium"   },
          { value: "low",    label: "📉 Low"      },
        ]} />

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {selected.size > 0 && (
            <>
              <span style={{ fontSize: 12, color: "#6b7280" }}>{selected.size} selected</span>
              <Button small variant="success" onClick={bulkApprove}>✓ Approve All</Button>
              <Button small variant="danger"  onClick={bulkReject}>✕ Reject All</Button>
            </>
          )}
          <Button small variant="secondary" onClick={selectAll}>
            {selected.size === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
          </Button>
        </div>
      </div>

      {/* Topic groups by channel */}
      {Object.keys(grouped).length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#3d3d60" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>All caught up!</div>
          <div style={{ fontSize: 13 }}>No topics pending review. Generate new ones above.</div>
        </div>
      ) : (
        Object.entries(grouped).map(([chId, group]) => {
          const ch = CHANNELS.find(c => c.id === chId);
          return (
            <div key={chId} style={{ marginBottom: 32 }}>
              {/* Channel header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 24 }}>{ch?.avatar || "📺"}</span>
                <div>
                  <div style={{ color: "#c4c4e0", fontWeight: 700, fontSize: 15 }}>{group.name}</div>
                  <div style={{ color: "#3d3d60", fontSize: 12 }}>{group.topics.length} topics pending</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <Button small variant="success" onClick={() => group.topics.forEach(t => approve(t.topic_id))}>
                    ✓ Approve All {group.name.split(" ")[0]}
                  </Button>
                </div>
              </div>

              {/* Topic cards grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }}>
                {group.topics.map(topic => (
                  <TopicCard
                    key={topic.topic_id}
                    topic={topic}
                    selected={selected.has(topic.topic_id)}
                    onSelect={() => {
                      setSelected(p => {
                        const n = new Set(p);
                        n.has(topic.topic_id) ? n.delete(topic.topic_id) : n.add(topic.topic_id);
                        return n;
                      });
                    }}
                    onApprove={() => approve(topic.topic_id)}
                    onReject={()  => reject(topic.topic_id)}
                    approving={loading[topic.topic_id] === "approving"}
                    rejecting={loading[topic.topic_id] === "rejecting"}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
