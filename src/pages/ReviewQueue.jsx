import { useState, useEffect, useCallback } from "react";
import { CHANNELS, API_BASE, API_KEY } from "../constants";
import { Button, Spinner, SectionLabel, Input } from "../components/ui";

// ── Split script into sentences; first 2 are the hook ────────────────
function splitHook(script) {
  if (!script) return { hook: "", rest: "" };
  const clean     = script.replace(/\[.*?\]\n?/g, "").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  const hook      = sentences.slice(0, 2).join(" ").trim();
  const rest      = sentences.slice(2).join(" ").trim();
  return { hook, rest };
}

// ── Fetch presigned URL for an S3 key ────────────────────────────────
async function presign(s3Key) {
  const res = await fetch(`${API_BASE}/api/autopilot/presign`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
    body:    JSON.stringify({ s3_key: s3Key }),
  });
  const data = await res.json();
  return data.url;
}

// ── Pending-review card (full: video + script + approve/reject) ──────
function PendingCard({ job, onAction }) {
  const [videoUrl,     setVideoUrl]     = useState(null);
  const [personalLine, setPersonalLine] = useState("");
  const [busy,         setBusy]         = useState(false);
  const [optimistic,   setOptimistic]   = useState(null); // 'approved' | 'rejected' | null
  const [error,        setError]        = useState("");

  const channel    = CHANNELS.find(c => c.id === job.channel_id);
  const { hook, rest } = splitHook(job.script || "");
  const duration   = job.audio_duration ? `${Math.round(parseFloat(job.audio_duration))}s` : "—";

  useEffect(() => {
    let cancelled = false;
    if (job.video_s3_key) {
      presign(job.video_s3_key).then(url => {
        if (!cancelled) setVideoUrl(url);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [job.video_s3_key]);

  const handleApprove = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/autopilot/jobs/${job.job_id}/approve`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
        body:    JSON.stringify({ personal_line: personalLine }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOptimistic("approved");
      onAction?.();
    } catch (e) {
      setError(e.message || "Approve failed");
    }
    setBusy(false);
  };

  const handleReject = async () => {
    const reason = window.prompt("Why are you rejecting this video?");
    if (!reason) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/autopilot/jobs/${job.job_id}/reject`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
        body:    JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOptimistic("rejected");
      onAction?.();
    } catch (e) {
      setError(e.message || "Reject failed");
    }
    setBusy(false);
  };

  return (
    <div style={{
      background: "#08081e", border: "1px solid #12122a",
      borderRadius: 14, padding: 22, marginBottom: 18,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#e0e0ff", fontSize: 15, fontWeight: 700, lineHeight: 1.35, marginBottom: 4 }}>
            {job.topic || "Untitled"}
          </div>
          <div style={{ color: "#3d3d60", fontSize: 12 }}>
            {channel?.avatar} {channel?.name || job.channel_id} · {duration} audio · job {job.job_id}
          </div>
        </div>
        {optimistic && (
          <div style={{
            fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6,
            background: optimistic === "approved" ? "#10b98118" : "#ef444418",
            color:      optimistic === "approved" ? "#10b981"   : "#ef4444",
            border:     `1px solid ${optimistic === "approved" ? "#10b98144" : "#ef444444"}`,
          }}>
            {optimistic === "approved" ? "✅ Approved" : "❌ Rejected"}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
        <div>
          <SectionLabel>Preview</SectionLabel>
          {videoUrl ? (
            <video controls src={videoUrl}
              style={{ width: "100%", borderRadius: 10, background: "#000", aspectRatio: "16/9" }}
            />
          ) : (
            <div style={{
              width: "100%", aspectRatio: "16/9", borderRadius: 10, background: "#000",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Spinner size={20} />
            </div>
          )}
        </div>

        <div>
          <SectionLabel>Script</SectionLabel>
          <div style={{
            background: "#06061a", border: "1px solid #1a1a3a", borderRadius: 10,
            padding: "14px 16px", fontSize: 12, lineHeight: 1.7,
            fontFamily: "'Space Mono',monospace", color: "#b4b4d0",
            maxHeight: 240, overflowY: "auto",
          }}>
            {hook && (
              <span style={{
                background: "#f59e0b22", color: "#fbbf24",
                padding: "1px 3px", borderRadius: 3,
              }}>
                {hook}
              </span>
            )}
            {rest && <span> {rest}</span>}
            {!hook && !rest && <span style={{ color: "#3d3d60" }}>No script attached.</span>}
          </div>
        </div>
      </div>

      {optimistic !== "rejected" && (
        <div style={{ marginBottom: 14 }}>
          <SectionLabel>Add your human touch (one sentence)</SectionLabel>
          <Input
            value={personalLine}
            onChange={setPersonalLine}
            placeholder="e.g. Stay safe out there — and if you know anything, speak up."
          />
        </div>
      )}

      {error && (
        <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 10 }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        {optimistic === "rejected" ? (
          <div style={{ flex: 1, textAlign: "center", color: "#6b7280", fontSize: 12, padding: "10px 0" }}>
            Sent back to the queue — will reassemble when ready.
          </div>
        ) : (
          <>
            <Button variant="success" style={{ flex: 1, justifyContent: "center" }}
              onClick={handleApprove} disabled={busy || optimistic === "approved"}>
              {busy ? <Spinner size={14} /> : optimistic === "approved" ? "✅ Approved" : "✅ Approve"}
            </Button>
            <Button variant="danger" style={{ flex: 1, justifyContent: "center" }}
              onClick={handleReject} disabled={busy || optimistic === "approved"}>
              ❌ Reject
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Approved job card (compact: topic + prominent download) ──────────
function ApprovedCard({ job }) {
  const [busy, setBusy] = useState(false);
  const channel  = CHANNELS.find(c => c.id === job.channel_id);
  const duration = job.audio_duration ? `${Math.round(parseFloat(job.audio_duration))}s` : "—";
  const approvedAt = job.approved_at ? new Date(job.approved_at).toLocaleString() : "";

  const handleDownload = async () => {
    setBusy(true);
    try {
      const url = await presign(job.video_s3_key);
      if (url) window.open(url, "_blank");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      background: "#08081e", border: "1px solid #10b98133",
      borderRadius: 14, padding: 18, marginBottom: 12,
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
            background: "#10b98118", color: "#10b981", border: "1px solid #10b98144",
          }}>✅ APPROVED</span>
          <span style={{ color: "#e0e0ff", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {job.topic || "Untitled"}
          </span>
        </div>
        <div style={{ color: "#3d3d60", fontSize: 11 }}>
          {channel?.avatar} {channel?.name || job.channel_id} · {duration} audio{approvedAt && ` · approved ${approvedAt}`}
        </div>
        {job.personal_line && (
          <div style={{ color: "#a78bfa", fontSize: 11, marginTop: 6, fontStyle: "italic" }}>
            “{job.personal_line}”
          </div>
        )}
      </div>
      <Button variant="success" onClick={handleDownload} disabled={busy || !job.video_s3_key}
        style={{ justifyContent: "center", flexShrink: 0 }}>
        {busy ? <Spinner size={14} /> : "⬇️ Download"}
      </Button>
    </div>
  );
}

// ── Render-ready card (draft MP4 from local FFmpeg, awaiting CapCut polish) ──
// Handles both landscape (16:9, 480px wide) and portrait (9:16, 220px wide)
// based on the orientation field on the job.
function RenderReadyCard({ job }) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const channel = CHANNELS.find(c => c.id === job.channel_id);
  const duration = job.draft_mp4_duration_seconds
    ? `${Math.round(parseFloat(job.draft_mp4_duration_seconds))}s`
    : "—";
  const sizeMb = job.draft_mp4_size_bytes
    ? `${Math.round(parseFloat(job.draft_mp4_size_bytes) / 1024 / 1024)} MB`
    : "";
  const renderTime = job.render_duration_seconds
    ? `${Math.round(parseFloat(job.render_duration_seconds))}s render`
    : "";
  const completedAt = job.render_completed_at
    ? new Date(job.render_completed_at).toLocaleString()
    : "";

  // Orientation: prefer explicit field, fall back to channel_id (ch_005 = portrait)
  const orientation = job.orientation
    || (job.channel_id === "ch_005" ? "portrait" : "landscape");
  const isPortrait = orientation === "portrait";

  // Vertical previews are narrower so the card stays compact.
  const videoMaxWidth = isPortrait ? 240 : 480;
  const videoAspectRatio = isPortrait ? "9/16" : "16/9";

  const s3Key = (job.draft_mp4_url || "").replace(/^s3:\/\/[^/]+\//, "");

  useEffect(() => {
    let cancelled = false;
    if (s3Key) {
      presign(s3Key).then(url => {
        if (!cancelled) setVideoUrl(url);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [s3Key]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const url = videoUrl || await presign(s3Key);
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = `draft-${job.job_id}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{
      background: "#08081e", border: "1px solid #6366f133",
      borderRadius: 14, padding: 18, marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
              background: "#6366f118", color: "#a78bfa", border: "1px solid #6366f144",
            }}>🎬 DRAFT READY</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
              background: isPortrait ? "#f59e0b18" : "#10b98118",
              color:      isPortrait ? "#f59e0b"   : "#10b981",
              border:     `1px solid ${isPortrait ? "#f59e0b44" : "#10b98144"}`,
            }}>{isPortrait ? "📱 9:16" : "🖥️ 16:9"}</span>
            <span style={{ color: "#e0e0ff", fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {job.topic || "Untitled"}
            </span>
          </div>
          <div style={{ color: "#3d3d60", fontSize: 11 }}>
            {channel?.avatar} {channel?.name || job.channel_id} · {duration} · {sizeMb}
            {renderTime && ` · ${renderTime}`}
            {completedAt && ` · ${completedAt}`}
          </div>
          <div style={{ color: "#6b7280", fontSize: 11, marginTop: 6 }}>
            job {job.job_id}
          </div>
        </div>
      </div>

      {videoUrl ? (
        <video controls src={videoUrl}
          style={{
            width: "100%",
            maxWidth: videoMaxWidth,
            borderRadius: 10,
            background: "#000",
            aspectRatio: videoAspectRatio,
            marginBottom: 12,
            display: "block",
          }}
        />
      ) : (
        <div style={{
          width: "100%",
          maxWidth: videoMaxWidth,
          aspectRatio: videoAspectRatio,
          borderRadius: 10,
          background: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}>
          <Spinner size={20} />
        </div>
      )}

      <Button
        variant="success"
        style={{ width: "100%", justifyContent: "center" }}
        onClick={handleDownload}
        disabled={downloading || !s3Key}
      >
        {downloading
          ? <Spinner size={14} />
          : isPortrait
            ? "⬇️ Download Vertical Short for CapCut"
            : "⬇️ Download Draft MP4 for CapCut"}
      </Button>
    </div>
  );
}

// ── Rendering-in-progress card (Lambda is still working) ────────────
function RenderingCard({ job }) {
  const channel = CHANNELS.find(c => c.id === job.channel_id);
  const startedAt = job.render_started_at
    ? new Date(job.render_started_at).toLocaleString()
    : "";
  const elapsed = job.render_started_at
    ? Math.round((Date.now() - new Date(job.render_started_at).getTime()) / 1000)
    : null;

  return (
    <div style={{
      background: "#08081e", border: "1px solid #f59e0b33",
      borderRadius: 14, padding: 16, marginBottom: 12,
      display: "flex", alignItems: "center", gap: 16,
    }}>
      <Spinner size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
            background: "#f59e0b18", color: "#f59e0b", border: "1px solid #f59e0b44",
          }}>🎬 RENDERING</span>
          <span style={{ color: "#e0e0ff", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {job.topic || "Untitled"}
          </span>
        </div>
        <div style={{ color: "#3d3d60", fontSize: 11 }}>
          {channel?.avatar} {channel?.name || job.channel_id}
          {elapsed !== null && ` · ${elapsed}s elapsed`}
          {startedAt && ` · started ${startedAt}`}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────
export default function ReviewQueue() {
  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const fetchJobs = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/autopilot/jobs`, {
        headers: { "x-app-key": API_KEY },
      });
      const data = await res.json();
      const relevant = (data.jobs || []).filter(
        j => j.stage === "pending_review" ||
             j.stage === "assembled" ||
             j.stage === "approved" ||
             j.stage === "rendering" ||
             j.stage === "draft_ready"
      );
      setJobs(relevant);
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 30000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const rendering   = jobs.filter(j => j.stage === "rendering");
  const draftReady  = jobs.filter(j => j.stage === "draft_ready")
                          .sort((a, b) => (b.render_completed_at || "").localeCompare(a.render_completed_at || ""));
  const pending     = jobs.filter(j => j.stage === "pending_review" || j.stage === "assembled");
  const approved    = jobs.filter(j => j.stage === "approved")
                          .sort((a, b) => (b.approved_at || "").localeCompare(a.approved_at || ""));

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Space Mono',monospace", fontSize: 22, fontWeight: 700, color: "#e0e0ff", letterSpacing: -1 }}>
          Review Queue
        </h1>
        <div style={{ color: "#3d3d60", fontSize: 13, marginTop: 4 }}>
          {loading
            ? "Loading…"
            : `${rendering.length} rendering · ${draftReady.length} draft ready · ${pending.length} pending · ${approved.length} approved`}
        </div>
      </div>

      {error && (
        <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 14 }}>{error}</div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#3d3d60" }}>
          <Spinner size={20} />
        </div>
      ) : (
        <>
          {/* Rendering section — Lambda is working */}
          {rendering.length > 0 && (
            <>
              <SectionLabel>Rendering · {rendering.length}</SectionLabel>
              <div style={{ marginBottom: 32 }}>
                {rendering.map(job => (
                  <RenderingCard key={job.job_id} job={job} />
                ))}
              </div>
            </>
          )}

          {/* Draft Ready section — download for CapCut polish */}
          {draftReady.length > 0 && (
            <>
              <SectionLabel>Draft MP4 Ready for CapCut · {draftReady.length}</SectionLabel>
              <div style={{ marginBottom: 32 }}>
                {draftReady.map(job => (
                  <RenderReadyCard key={job.job_id} job={job} />
                ))}
              </div>
            </>
          )}

          {/* Pending section */}
          <SectionLabel>Pending Review · {pending.length}</SectionLabel>
          {pending.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "40px 0", color: "#3d3d60",
              background: "#08081e", border: "1px solid #12122a", borderRadius: 14,
              marginBottom: 32,
            }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>✨</div>
              <div style={{ fontSize: 13 }}>Nothing waiting for review.</div>
            </div>
          ) : (
            <div style={{ marginBottom: 32 }}>
              {pending.map(job => (
                <PendingCard key={job.job_id} job={job} onAction={fetchJobs} />
              ))}
            </div>
          )}

          {/* Approved section */}
          <SectionLabel>Approved · Ready for YouTube Upload · {approved.length}</SectionLabel>
          {approved.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "28px 0", color: "#3d3d60",
              background: "#08081e", border: "1px solid #12122a", borderRadius: 14,
            }}>
              <div style={{ fontSize: 12 }}>No approved videos yet. Approve one above to see it here.</div>
            </div>
          ) : (
            <div>
              {approved.map(job => (
                <ApprovedCard key={job.job_id} job={job} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
