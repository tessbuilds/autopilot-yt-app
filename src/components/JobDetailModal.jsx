import { useState, useEffect } from "react";
import { CHANNELS, API_BASE, API_KEY } from "../constants";
import { Button, Spinner, SectionLabel } from "../components/ui";

const STAGE_META = {
  queued:       { label: "Queued",       color: "#6b7280", icon: "⏳" },
  script_done:  { label: "Script Ready", color: "#3b82f6", icon: "✍️" },
  voice_generating: { label: "Voice Generating", color: "#6366f1", icon: "🎙️" },
  voice_done:   { label: "Voice Ready",  color: "#8b5cf6", icon: "🎙️" },
  visuals_done: { label: "Visuals Done", color: "#f59e0b", icon: "🎨" },
  assembly_queued: { label: "Assembly Queued", color: "#ec4899", icon: "🎬" },
  assembled:    { label: "Assembled",    color: "#10b981", icon: "🎬" },
  published:    { label: "Published",    color: "#10b981", icon: "✅" },
  failed:       { label: "Failed",       color: "#ef4444", icon: "❌" },
};

function PresignedVideo({ s3Key, label }) {
  const [url, setUrl]       = useState(null);
  const [error, setError]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!s3Key) { setLoading(false); return; }
    // Fetch presigned URL from Lambda
    fetch(`${API_BASE}/api/autopilot/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
      body: JSON.stringify({ s3_key: s3Key }),
    })
      .then(r => r.json())
      .then(d => { setUrl(d.url); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [s3Key]);

  return (
    <div style={{
      background: "#06061a", border: "1px solid #12122a",
      borderRadius: 10, overflow: "hidden",
    }}>
      <div style={{ aspectRatio: "16/9", position: "relative", background: "#030310" }}>
        {loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Spinner size={20} />
          </div>
        )}
        {error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#3d3d60", fontSize: 12 }}>
            ❌ Failed to load
          </div>
        )}
        {url && (
          <video
            src={url}
            muted
            playsInline
            controls
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={() => setError(true)}
          />
        )}
      </div>
      <div style={{ padding: "8px 12px", fontSize: 11, color: "#3d3d60" }}>{label}</div>
    </div>
  );
}

function AudioPlayer({ s3Key }) {
  const [url, setUrl]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);

  useEffect(() => {
    if (!s3Key) { setLoading(false); return; }
    fetch(`${API_BASE}/api/autopilot/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
      body: JSON.stringify({ s3_key: s3Key }),
    })
      .then(r => r.json())
      .then(d => { setUrl(d.url); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [s3Key]);

  if (loading) return <div style={{ color: "#3d3d60", fontSize: 13 }}><Spinner size={14} /> Loading audio…</div>;
  if (error)   return <div style={{ color: "#ef4444", fontSize: 13 }}>❌ Failed to load audio</div>;
  if (!url)    return <div style={{ color: "#3d3d60", fontSize: 13 }}>No voiceover generated yet</div>;

  return (
    <audio
      controls
      src={url}
      style={{ width: "100%", marginTop: 8, borderRadius: 8 }}
    />
  );
}

export default function JobDetailModal({ job, onClose }) {
  if (!job) return null;

  const meta    = STAGE_META[job.stage] || STAGE_META.queued;
  const channel = CHANNELS.find(c => c.id === job.channel_id);
  const visuals = job.visuals || {};
  const hasVisuals = Object.keys(visuals).length > 0;
  const hasVoice   = !!job.voiceover_s3_key;
  const hasScript  = !!job.script;
  const visualEntries = Object.entries(visuals)
    .filter(([, s3Key]) => !!s3Key)
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
          zIndex: 100, backdropFilter: "blur(4px)",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(900px, 95vw)", maxHeight: "90vh",
        background: "#0a0a1e", border: "1px solid #1a1a3a",
        borderRadius: 20, zIndex: 101, overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid #12122a",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#e0e0ff", fontWeight: 700, fontSize: 16, lineHeight: 1.4, marginBottom: 6 }}>
              {job.topic || "Untitled Job"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: "#3d3d60" }}>
                {channel?.avatar} {job.channel_name || channel?.name}
              </span>
              <div style={{
                display: "flex", alignItems: "center", gap: 5,
                background: `${meta.color}18`, border: `1px solid ${meta.color}44`,
                borderRadius: 6, padding: "3px 8px",
              }}>
                <span style={{ fontSize: 12 }}>{meta.icon}</span>
                <span style={{ fontSize: 11, color: meta.color, fontWeight: 600 }}>{meta.label}</span>
              </div>
              <span style={{ fontSize: 11, color: "#2e2e50" }}>
                {new Date(job.created_at).toLocaleString()}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#12122a", border: "1px solid #1a1a3a",
              borderRadius: 8, color: "#6b7280", cursor: "pointer",
              fontSize: 18, width: 34, height: 34,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflow: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Job metadata */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {[
              ["Job ID",     job.job_id],
              ["Duration",   job.duration   || "medium"],
              ["Style",      job.visual_style || "cinematic"],
              ["Words",      job.script_word_count ? `${job.script_word_count} words` : "—"],
            ].map(([k, v]) => (
              <div key={k} style={{ background: "#06061a", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: "#2e2e50", marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 12, color: "#a78bfa", fontFamily: "'Space Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v || "—"}</div>
              </div>
            ))}
          </div>

          {/* Visuals grid */}
          <div>
            <SectionLabel>
              🎨 Generated Visuals {hasVisuals ? `(${visualEntries.length})` : "(not generated)"}
            </SectionLabel>
            {hasVisuals ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 10 }}>
                {visualEntries.map(([key, s3Key], index) => (
                  <PresignedVideo
                    key={key}
                    s3Key={s3Key}
                    label={`Clip ${String(index + 1).padStart(2, "0")} · ${key}`}
                  />
                ))}
              </div>
            ) : (
              <div style={{
                textAlign: "center", padding: "32px 0",
                color: "#3d3d60", fontSize: 13,
                background: "#06061a", borderRadius: 12, marginTop: 10,
              }}>
                No visuals generated yet. Go to Create → Generate Visuals.
              </div>
            )}
          </div>

          {/* Voiceover */}
          <div>
            <SectionLabel>🎙️ Voiceover {hasVoice ? "" : "(not generated)"}</SectionLabel>
            <div style={{ marginTop: 10 }}>
              <AudioPlayer s3Key={job.voiceover_s3_key} />
            </div>
          </div>

          {/* Script preview */}
          {hasScript && (
            <div>
              <SectionLabel>✍️ Script Preview</SectionLabel>
              <textarea
                readOnly
                value={job.script}
                rows={10}
                style={{
                  width: "100%", marginTop: 10,
                  background: "#06061a", border: "1px solid #1a1a3a",
                  borderRadius: 12, color: "#8888aa",
                  padding: "14px 18px", fontSize: 12,
                  fontFamily: "'Space Mono',monospace",
                  lineHeight: 1.8, resize: "none", outline: "none",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
