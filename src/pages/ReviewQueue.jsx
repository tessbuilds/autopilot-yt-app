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
        j => j.stage === "pending_review" || j.stage === "assembled" || j.stage === "approved"
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

  const pending  = jobs.filter(j => j.stage === "pending_review" || j.stage === "assembled");
  const approved = jobs.filter(j => j.stage === "approved")
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
            : `${pending.length} pending · ${approved.length} approved`}
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
