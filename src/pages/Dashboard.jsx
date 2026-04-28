import { useState, useEffect, useCallback } from "react";
import { CHANNELS, API_BASE, API_KEY } from "../constants";
import { StatCard, PulsingDot, SectionLabel, Button, Spinner } from "../components/ui";
import JobDetailModal from "../components/JobDetailModal";

// ── Stage metadata ────────────────────────────────────────────────────
const STAGE_META = {
  queued:           { label: "Queued",           color: "#6b7280", icon: "⏳" },
  script_done:      { label: "Script Ready",     color: "#3b82f6", icon: "✍️" },
  voice_generating: { label: "Voice Generating", color: "#6366f1", icon: "🎙️" },
  voice_done:       { label: "Voice Ready",      color: "#8b5cf6", icon: "🎧" },
  visuals_done:     { label: "Visuals Done",     color: "#f59e0b", icon: "🎨" },
  assembly_queued:  { label: "Assembly Queued",  color: "#ec4899", icon: "🎬" },
  assembled:        { label: "Assembled",        color: "#10b981", icon: "✅" },
  published:        { label: "Published",        color: "#10b981", icon: "🚀" },
  failed:           { label: "Failed",           color: "#ef4444", icon: "❌" },
};

const STAGE_ORDER = ["queued","script_done","voice_generating","voice_done","visuals_done","assembly_queued","assembled","published"];

async function apiFetchJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed: ${res.status}`);
  }

  return data;
}

function stageProgress(stage) {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < 0) return 0;
  return Math.round((idx / (STAGE_ORDER.length - 1)) * 100);
}

// ── Mini sparkline chart ──────────────────────────────────────────────
function MiniChart({ data, color = "#7c3aed", height = 56 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100 / (data.length - 1);
  const pts = data.map((v, i) => `${i * w},${height - ((v - min) / range) * (height - 4)}`).join(" ");
  const gradId = `grad-${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 100 ${height}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} 100,${height}`} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// ── Channel row ───────────────────────────────────────────────────────
function ChannelRow({ ch, jobCount, pendingTopics }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 18px", background: "#08081e",
      border: "1px solid #12122a", borderRadius: 12,
    }}>
      <span style={{ fontSize: 28 }}>{ch.avatar}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ color: "#d4d4f0", fontWeight: 700, fontSize: 13 }}>{ch.name}</span>
          <PulsingDot color="#10b981" />
        </div>
        <span style={{ color: "#3d3d60", fontSize: 11 }}>{ch.niche}</span>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ color: "#a78bfa", fontSize: 12, fontFamily: "'Space Mono',monospace" }}>
          {jobCount} jobs
        </div>
        <div style={{ color: "#f59e0b", fontSize: 12, fontFamily: "'Space Mono',monospace" }}>
          {pendingTopics} topics
        </div>
      </div>
    </div>
  );
}

// ── Pipeline job row ──────────────────────────────────────────────────
function JobRow({ job, onClick }) {
  const meta     = STAGE_META[job.stage] || STAGE_META.queued;
  const progress = stageProgress(job.stage);
  const title    = job.topic || "Untitled";
  const channel  = CHANNELS.find(c => c.id === job.channel_id);

  return (
    <div
      onClick={onClick}
      style={{
        background: "#08081e", border: "1px solid #12122a",
        borderRadius: 12, padding: "14px 18px",
        cursor: "pointer", transition: "border-color 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "#7c3aed44"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "#12122a"}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: "#c4c4e0", fontSize: 13, fontWeight: 600, lineHeight: 1.4,
            marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{title}</div>
          <div style={{ color: "#3d3d60", fontSize: 11 }}>
            {channel?.avatar} {job.channel_name || channel?.name || job.channel_id}
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: `${meta.color}18`, border: `1px solid ${meta.color}44`,
          borderRadius: 6, padding: "3px 8px", flexShrink: 0,
        }}>
          <span style={{ fontSize: 12 }}>{meta.icon}</span>
          <span style={{ fontSize: 11, color: meta.color, fontWeight: 600 }}>{meta.label}</span>
        </div>
      </div>

      <div style={{ height: 4, background: "#12122a", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${progress}%`,
          background: meta.color, borderRadius: 2,
          transition: "width 0.4s ease",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "#3d3d60" }}>{progress}%</span>
        <span style={{ fontSize: 10, color: "#4b5563" }}>Click to preview →</span>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────
export default function Dashboard({ setActiveTab }) {
  const [jobs,        setJobs]        = useState([]);
  const [topics,      setTopics]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setError("");
      const [jobsData, topicsData] = await Promise.all([
        apiFetchJson(`/api/autopilot/jobs`,                         { headers: { "x-app-key": API_KEY } }),
        apiFetchJson(`/api/autopilot/topics?status=pending_review`, { headers: { "x-app-key": API_KEY } }),
      ]);
      setJobs(jobsData.jobs     || []);
      setTopics(topicsData.topics || []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("Dashboard fetch failed:", e);
      setError(e.message || "Dashboard fetch failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const activeJobs    = jobs.filter(j => !["published", "failed"].includes(j.stage));
  const completedJobs = jobs.filter(j => j.stage === "published");
  const pendingTopics = topics.filter(t => t.status === "pending_review");

  const jobsByChannel   = {};
  const topicsByChannel = {};
  CHANNELS.forEach(c => {
    jobsByChannel[c.id]   = jobs.filter(j => j.channel_id === c.id).length;
    topicsByChannel[c.id] = pendingTopics.filter(t => t.channel_id === c.id).length;
  });

  const stageSparkline = STAGE_ORDER.map(s => jobs.filter(j => j.stage === s).length);
  const recentJobs     = [...jobs]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontFamily: "'Space Mono',monospace", fontSize: 22, fontWeight: 700, color: "#e0e0ff", letterSpacing: -1 }}>
            Dashboard
          </h1>
          <div style={{ color: "#3d3d60", fontSize: 13, marginTop: 4 }}>
            {loading ? "Loading…" : `${jobs.length} total jobs · ${activeJobs.length} active · ${pendingTopics.length} topics pending`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: "#2e2e50" }}>
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button small variant="secondary" onClick={fetchData} disabled={loading}>
            {loading ? <Spinner size={12} /> : "↻ Refresh"}
          </Button>
          <Button onClick={() => setActiveTab("create")}>＋ New Video</Button>
        </div>
      </div>

      {error && (
        <div style={{
          marginBottom: 20, padding: "12px 14px",
          background: "#1a0d12", border: "1px solid #5b1d2b",
          borderRadius: 12, color: "#fca5a5", fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Jobs"     value={loading ? "—" : jobs.length}          delta={`${activeJobs.length} active`} icon="⚙️"  deltaColor="#a78bfa" />
        <StatCard label="Topics Pending" value={loading ? "—" : pendingTopics.length} delta="across 4 channels"             icon="📋"  deltaColor="#f59e0b" />
        <StatCard label="Published"      value={loading ? "—" : completedJobs.length} delta="all time"                      icon="✅"  deltaColor="#10b981" />
        <StatCard label="Channels"       value={4}                                     delta="all active"                    icon="📺"  deltaColor="#3b82f6" />
      </div>

      {/* Pipeline sparkline */}
      <div style={{ background: "#08081e", border: "1px solid #12122a", borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <SectionLabel>Pipeline Distribution</SectionLabel>
          <span style={{ fontSize: 12, color: "#a78bfa", fontFamily: "'Space Mono',monospace" }}>
            {jobs.length} jobs total
          </span>
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#3d3d60" }}><Spinner size={20} /></div>
        ) : (
          <>
            <MiniChart data={stageSparkline.length ? stageSparkline : [0,0,0,0,0,0]} color="#7c3aed" height={64} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              {STAGE_ORDER.map(s => (
                <div key={s} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14 }}>{STAGE_META[s].icon}</div>
                  <div style={{ fontSize: 9, color: "#2e2e50", marginTop: 2 }}>
                    {jobs.filter(j => j.stage === s).length}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Channels + Recent Jobs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 20 }}>
        <div>
          <SectionLabel>Channels</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#3d3d60" }}><Spinner size={20} /></div>
            ) : (
              CHANNELS.map(ch => (
                <ChannelRow
                  key={ch.id}
                  ch={ch}
                  jobCount={jobsByChannel[ch.id] || 0}
                  pendingTopics={topicsByChannel[ch.id] || 0}
                />
              ))
            )}
          </div>

          {!loading && (
            <div style={{ marginTop: 16, background: "#08081e", border: "1px solid #12122a", borderRadius: 12, padding: "14px 18px" }}>
              <SectionLabel>Stage Legend</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {Object.entries(STAGE_META).map(([key, meta]) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12 }}>{meta.icon}</span>
                      <span style={{ fontSize: 12, color: meta.color }}>{meta.label}</span>
                    </div>
                    <span style={{
                      fontSize: 11, fontFamily: "'Space Mono',monospace",
                      color: "#a78bfa", background: "#12122a",
                      borderRadius: 4, padding: "1px 6px",
                    }}>
                      {jobs.filter(j => j.stage === key).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <SectionLabel>Recent Jobs</SectionLabel>
            <Button small variant="secondary" onClick={() => setActiveTab("queue")}>View All</Button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "#3d3d60" }}><Spinner size={20} /></div>
            ) : recentJobs.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "40px 0", color: "#3d3d60",
                background: "#08081e", border: "1px solid #12122a", borderRadius: 12,
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>No jobs yet</div>
                <div style={{ fontSize: 12 }}>Approve a topic to create your first job</div>
              </div>
            ) : (
              recentJobs.map(job => (
                <JobRow key={job.job_id} job={job} onClick={() => setSelectedJob(job)} />
              ))
            )}
          </div>

          {!loading && (
            <div style={{ marginTop: 16, background: "#08081e", border: "1px solid #12122a", borderRadius: 12, padding: "14px 18px" }}>
              <SectionLabel>Quick Actions</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                <Button style={{ width: "100%", justifyContent: "center" }} onClick={() => setActiveTab("topics")}>
                  📋 Review {pendingTopics.length} Pending Topics
                </Button>
                <Button style={{ width: "100%", justifyContent: "center" }} onClick={() => setActiveTab("create")}>
                  ✍️ Create New Video
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Job Detail Modal */}
      <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}
