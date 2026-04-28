import { useState, useEffect } from "react";
import { API_BASE, API_KEY, PEXELS_API_KEY } from "../constants";
import { Button, Spinner, SectionLabel, Input, Select } from "../components/ui";

const CHANNEL_ID = "ch_005";
const DURATIONS  = [
  { value: "30s", label: "30 seconds" },
  { value: "45s", label: "45 seconds" },
  { value: "60s", label: "60 seconds" },
];
const VOICES = [
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie — Energetic" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George — British Punchy" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel — Finance Pro" },
];

// ── Pexels search (vertical) ─────────────────────────────────────────
async function searchPexelsVertical(keyword, apiKey) {
  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&per_page=3&orientation=portrait&size=medium`,
    { headers: { Authorization: apiKey } }
  );
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const data = await res.json();
  const v = (data.videos || [])[0];
  if (!v) return null;
  const files = v.video_files || [];
  // prefer 1080-tall files for vertical
  const tall = files.find(f => f.height >= 1080) || files[0];
  return tall?.link || null;
}

async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { "x-app-key": API_KEY, ...(opts.headers || {}) },
  });
  let data = {};
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export default function Shorts() {
  const [mode,     setMode]     = useState("new");        // "new" | "from"
  const [topic,    setTopic]    = useState("");
  const [duration, setDuration]           = useState("45s");
  const [selectedVoice, setSelectedVoice] = useState("IKne3meq5aSn9XLyUdCD");
  const [sourceJobs,    setSourceJobs]    = useState([]);
  const [sourceJobId,   setSourceJobId]   = useState("");

  const [jobId,        setJobId]        = useState(null);
  const [script,       setScript]       = useState("");
  const [scriptStatus, setScriptStatus] = useState("");
  const [scriptBusy,   setScriptBusy]   = useState(false);

  const [voiceStatus,     setVoiceStatus]     = useState("");
  const [voiceBusy,       setVoiceBusy]       = useState(false);
  const [audioReady,      setAudioReady]      = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [voiceApproved,   setVoiceApproved]   = useState(false);

  const [visualsStatus, setVisualsStatus] = useState("");
  const [visualsBusy,   setVisualsBusy]   = useState(false);
  const [assets,        setAssets]        = useState(null);

  const [assembleStatus, setAssembleStatus] = useState("");
  const [assembleBusy,   setAssembleBusy]   = useState(false);
  const [videoUrl,       setVideoUrl]       = useState(null);

  const [error, setError] = useState("");

  // Load completed long-form jobs for "From Video" dropdown
  useEffect(() => {
    if (mode !== "from") return;
    let cancelled = false;
    api("/api/autopilot/jobs")
      .then(d => {
        if (cancelled) return;
        const eligible = (d.jobs || [])
          .filter(j => j.script && j.channel_id !== "ch_005")
          .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
          .slice(0, 30);
        setSourceJobs(eligible);
        if (!sourceJobId && eligible[0]) setSourceJobId(eligible[0].job_id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [mode, sourceJobId]);

  // ── Step 1: Generate script ─────────────────────────────────────
  const generateScript = async () => {
    setError(""); setScript(""); setScriptStatus("");
    setAudioReady(false); setVoiceStatus(""); setAssets(null);
    setVisualsStatus(""); setVideoUrl(null); setAssembleStatus("");
    setScriptBusy(true);
    try {
      let data;
      if (mode === "from") {
        if (!sourceJobId) throw new Error("Pick a source video first.");
        setScriptStatus("✍️ Extracting the most shocking fact…");
        data = await api("/api/autopilot/shorts/from-job", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ source_job_id: sourceJobId, duration: parseInt(duration) }),
        });
      } else {
        if (!topic.trim()) throw new Error("Enter a topic first.");
        setScriptStatus("✍️ Writing punchy Short script…");
        data = await api("/api/autopilot/shorts/script", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ topic, duration: parseInt(duration) }),
        });
      }
      setJobId(data.job_id);
      setScript(data.script || "");
      setScriptStatus(`✅ Script ready — ${data.word_count} words`);
    } catch (e) {
      setError(e.message);
      setScriptStatus("");
    }
    setScriptBusy(false);
  };

  // ── Step 2: Generate voice (async, poll) ────────────────────────
  const generateVoice = async () => {
    if (!jobId || !script) return;
    setError(""); setVoiceBusy(true); setVoiceStatus("🎙️ Starting voiceover…");
    setAudioReady(false); setAudioPreviewUrl(null); setVoiceApproved(false);
    try {
      await api("/api/autopilot/voice", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ job_id: jobId, channel_id: CHANNEL_ID, voice_id: selectedVoice, script }),
      });
    } catch (e) {
      setError(e.message); setVoiceStatus(""); setVoiceBusy(false); return;
    }
    for (let i = 0; i < 18; i++) {
      await new Promise(r => setTimeout(r, 5000));
      setVoiceStatus(`🎙️ Generating voiceover… (${(i + 1) * 5}s)`);
      try {
        const job = await api(`/api/autopilot/jobs/${jobId}`);
        if (job.audio_duration && parseFloat(job.audio_duration) > 0) {
          setAudioReady(true);
          setVoiceStatus(`✅ Voiceover ready — ${Math.round(parseFloat(job.audio_duration))}s`);
          if (job.voiceover_s3_key) {
            try {
              const { url } = await api("/api/autopilot/presign", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ s3_key: job.voiceover_s3_key }),
              });
              setAudioPreviewUrl(url);
            } catch { /* preview optional */ }
          }
          setVoiceBusy(false);
          return;
        }
        if (job.stage === "failed") {
          setError(job.error || "Voice generation failed.");
          setVoiceStatus(""); setVoiceBusy(false); return;
        }
      } catch { /* keep polling */ }
    }
    setVoiceStatus("⚠️ Voice timed out — proceeding anyway");
    setAudioReady(true);
    setVoiceBusy(false);
  };

  // ── Step 3: Generate visuals (vertical Pexels) ──────────────────
  const generateVisuals = async () => {
    if (!jobId || !script) return;
    setError(""); setVisualsBusy(true); setVisualsStatus("🧠 Analyzing script…");
    setAssets(null);
    try {
      // Ask backend for keywords (channel-aware)
      const job = await api(`/api/autopilot/jobs/${jobId}`);
      const audioDur   = parseFloat(job.audio_duration || duration);
      const clipsNeeded = Math.max(6, Math.ceil(audioDur / 3) + 2);

      const kw = await api("/api/autopilot/visuals-keywords", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ topic: job.topic || topic, script, channel_id: CHANNEL_ID, clips_needed: clipsNeeded }),
      });
      const keywords = (kw.keywords || []).slice(0, clipsNeeded);

      const newAssets = {};
      for (let i = 0; i < keywords.length; i++) {
        const k = keywords[i];
        setVisualsStatus(`🎬 Vertical clip ${i + 1}/${keywords.length}: "${k}"…`);
        try {
          const url = await searchPexelsVertical(k, PEXELS_API_KEY);
          if (!url) continue;
          const blob = await (await fetch(url)).blob();
          const s3Key = `autopilot/jobs/${jobId}/visuals/clip_${String(i).padStart(2, "0")}.mp4`;
          const presign = await api("/api/autopilot/presign-upload", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ s3_key: s3Key }),
          });
          const up = await fetch(presign.upload_url, {
            method: "PUT",
            headers: { "Content-Type": "video/mp4" },
            body: blob,
          });
          if (!up.ok) throw new Error(`S3 upload ${up.status}`);
          newAssets[`clip_${String(i).padStart(2, "0")}`] = s3Key;
        } catch (e) {
          console.warn(`Clip ${i} skipped:`, e.message);
        }
      }
      if (!Object.keys(newAssets).length) throw new Error("No vertical clips found on Pexels.");

      setVisualsStatus("💾 Saving to database…");
      await api("/api/autopilot/visuals-save", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ job_id: jobId, assets: newAssets }),
      });
      setAssets(newAssets);
      setVisualsStatus(`✅ ${Object.keys(newAssets).length} clips ready`);
    } catch (e) {
      setError(e.message);
      setVisualsStatus("");
    }
    setVisualsBusy(false);
  };

  // ── Step 4: Assemble (vertical 1080×1920) ───────────────────────
  const assemble = async () => {
    if (!jobId) return;
    setError(""); setAssembleBusy(true); setAssembleStatus("🎬 Queueing assembly…");
    try {
      await api("/api/autopilot/assemble", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ job_id: jobId }),
      });
    } catch (e) {
      setError(e.message); setAssembleStatus(""); setAssembleBusy(false); return;
    }
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 10000));
      setAssembleStatus(`🎬 Rendering vertical Short… (${(i + 1) * 10}s)`);
      try {
        const job = await api(`/api/autopilot/jobs/${jobId}`);
        if (job.stage === "failed") {
          setError(job.error || "Assembly failed."); setAssembleStatus(""); setAssembleBusy(false); return;
        }
        if (job.stage === "pending_review" || job.stage === "assembled") {
          if (job.video_s3_key) {
            const { url } = await api("/api/autopilot/presign", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ s3_key: job.video_s3_key }),
            });
            setVideoUrl(url);
          }
          setAssembleStatus("✅ Short assembled.");
          setAssembleBusy(false);
          return;
        }
      } catch { /* keep polling */ }
    }
    setError("Assembly timed out."); setAssembleStatus(""); setAssembleBusy(false);
  };

  const download = () => { if (videoUrl) window.open(videoUrl, "_blank"); };

  const handleApproveVoice    = () => setVoiceApproved(true);
  const handleRegenerateVoice = async () => {
    setVoiceApproved(false);
    setAudioPreviewUrl(null);
    setAudioReady(false);
    setAssets(null);
    setVisualsStatus("");
    setVideoUrl(null);
    setAssembleStatus("");
    await generateVoice();
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="fade-in" style={{ maxWidth: 880 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Space Mono',monospace", fontSize: 22, fontWeight: 700, color: "#e0e0ff", letterSpacing: -1 }}>
          ⚡ Shorts Studio
        </h1>
        <div style={{ color: "#3d3d60", fontSize: 13, marginTop: 4 }}>
          Vertical 1080×1920 · Charlie voice · 60-80 word punchy fact
        </div>
      </div>

      {/* Channel lock badge — Shorts is always ch_005 */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: "#08081e", border: "1px solid #2d1b6e",
        borderRadius: 999, padding: "6px 14px", marginBottom: 14,
        fontSize: 12, color: "#c4b5fd", fontWeight: 600,
      }}>
        ⚡ Shorts — Facts That Hit Different
      </div>

      {/* Voice selector */}
      <div style={{ marginBottom: 18, maxWidth: 320 }}>
        <SectionLabel>Voice</SectionLabel>
        <Select
          value={selectedVoice}
          onChange={setSelectedVoice}
          options={VOICES.map(v => ({ value: v.id, label: v.name }))}
          style={{ width: "100%" }}
        />
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
        {[["new", "✍️ New Topic"], ["from", "♻️ From Video"]].map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            cursor: "pointer", border: "1px solid",
            background:  mode === m ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "#0e0e28",
            borderColor: mode === m ? "#7c3aed" : "#1e1e3f",
            color:       mode === m ? "#fff" : "#c4c4e0",
          }}>{label}</button>
        ))}
      </div>

      {/* Mode body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 12, marginBottom: 18 }}>
        {mode === "new" ? (
          <div>
            <SectionLabel>Topic</SectionLabel>
            <Input value={topic} onChange={setTopic} placeholder="e.g. Tesla just spent two billion dollars and told nobody"
                   onKeyDown={e => e.key === "Enter" && generateScript()} />
          </div>
        ) : (
          <div>
            <SectionLabel>Source Video</SectionLabel>
            <Select value={sourceJobId} onChange={setSourceJobId}
              options={sourceJobs.length === 0
                ? [{ value: "", label: "No source videos found yet" }]
                : sourceJobs.map(j => ({ value: j.job_id, label: (j.topic || j.job_id).slice(0, 70) }))}
              style={{ width: "100%" }} />
          </div>
        )}
        <div>
          <SectionLabel>Duration</SectionLabel>
          <Select value={duration} onChange={setDuration} options={DURATIONS} style={{ width: "100%" }} />
        </div>
      </div>

      <Button onClick={generateScript} disabled={scriptBusy} style={{ width: "100%", justifyContent: "center", marginBottom: 14 }}>
        {scriptBusy ? <><Spinner size={14} /> Generating…</> : "✍️ Generate Script"}
      </Button>

      {scriptStatus && (
        <div style={{ color: scriptStatus.startsWith("✅") ? "#10b981" : "#f59e0b", fontSize: 12, marginBottom: 14, textAlign: "center" }}>
          {scriptStatus}
        </div>
      )}
      {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 14 }}>{error}</div>}

      {/* Script editor */}
      {script && (
        <div className="fade-in" style={{ marginBottom: 18 }}>
          <SectionLabel>Script (editable)</SectionLabel>
          <textarea value={script} onChange={e => setScript(e.target.value)} rows={6}
            style={{
              width: "100%", background: "#06061a", border: "1px solid #1a1a3a",
              borderRadius: 12, color: "#b4b4d0", padding: "16px 18px",
              fontSize: 13, fontFamily: "'Space Mono',monospace", lineHeight: 1.7,
              resize: "vertical", outline: "none",
            }}
          />
          <div style={{ color: "#3d3d60", fontSize: 11, marginTop: 4 }}>
            {script.split(/\s+/).filter(Boolean).length} words
          </div>
        </div>
      )}

      {/* Voice button (always shown when script is ready) */}
      {script && (
        <div style={{ marginBottom: 14 }}>
          <Button variant="success" onClick={generateVoice}
            disabled={voiceBusy || (audioReady && !voiceApproved)}
            style={{ width: "100%", justifyContent: "center" }}>
            {voiceBusy ? <Spinner size={14} /> : audioReady ? "✓ Voice ready" : "🎙️ Generate Voice"}
          </Button>
        </div>
      )}

      {/* Audio preview — appears after voice is ready */}
      {audioPreviewUrl && (
        <div className="fade-in" style={{
          background: "#08081e", border: "1px solid #2d1b6e",
          borderRadius: 12, padding: 16, marginBottom: 14,
        }}>
          <div style={{ color: "#a78bfa", fontSize: 12, marginBottom: 10, fontWeight: 600 }}>
            🎧 Preview voiceover before continuing:
          </div>
          <audio controls src={audioPreviewUrl} style={{ width: "100%", marginBottom: voiceApproved ? 0 : 12 }} />
          {!voiceApproved ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Button variant="success" onClick={handleApproveVoice} disabled={voiceBusy}
                style={{ justifyContent: "center" }}>
                ✅ Sounds Good — Generate Visuals
              </Button>
              <Button variant="danger" onClick={handleRegenerateVoice} disabled={voiceBusy}
                style={{ justifyContent: "center" }}>
                {voiceBusy ? <Spinner size={14} /> : "🔄 Regenerate Voice"}
              </Button>
            </div>
          ) : (
            <div style={{ color: "#10b981", fontSize: 12, fontWeight: 600, marginTop: 10, textAlign: "center" }}>
              ✅ Voice approved — proceed to visuals below
            </div>
          )}
        </div>
      )}

      {/* Visuals + Assemble — appear only after voice is approved */}
      {voiceApproved && (
        <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <Button variant="warning" onClick={generateVisuals} disabled={visualsBusy} style={{ justifyContent: "center" }}>
            {visualsBusy  ? <Spinner size={14} /> : assets   ? "✓ Visuals"   : "🎨 Generate Visuals"}
          </Button>
          <Button variant="primary" onClick={assemble} disabled={assembleBusy || !assets} style={{ justifyContent: "center" }}>
            {assembleBusy ? <Spinner size={14} /> : videoUrl ? "✓ Assembled" : "🎬 Assemble"}
          </Button>
        </div>
      )}

      {/* Live status messages */}
      {(voiceStatus || visualsStatus || assembleStatus) && (
        <div style={{ background: "#08081e", border: "1px solid #12122a", borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 12, color: "#a78bfa", lineHeight: 1.7 }}>
          {voiceStatus    && <div>{voiceStatus}</div>}
          {visualsStatus  && <div>{visualsStatus}</div>}
          {assembleStatus && <div>{assembleStatus}</div>}
        </div>
      )}

      {/* Vertical preview + download */}
      {videoUrl && (
        <div className="fade-in" style={{ background: "#08081e", border: "1px solid #10b98133", borderRadius: 14, padding: 20, display: "flex", gap: 20, alignItems: "flex-start" }}>
          <video controls src={videoUrl}
            style={{ width: 220, aspectRatio: "9/16", borderRadius: 10, background: "#000", flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <SectionLabel>✅ Short Ready</SectionLabel>
            <div style={{ color: "#c4c4e0", fontSize: 13, marginBottom: 14 }}>
              Vertical 1080×1920 · {duration} · Charlie
            </div>
            <Button variant="success" onClick={download} style={{ justifyContent: "center" }}>
              ⬇️ Download MP4
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
