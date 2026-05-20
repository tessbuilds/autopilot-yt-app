import { useState, useEffect } from "react";
import { CHANNELS, VOICE_LIBRARY, API_BASE, API_KEY, PEXELS_API_KEY } from "../constants";
import { Button, Input, Select, Spinner, SectionLabel } from "../components/ui";

const STEP_LABELS = ["Script", "Voiceover", "Visuals", "Assemble", "Publish"];

const VISUAL_STYLES = [
  { value: "cinematic",   label: "🎬 Cinematic — dark, moody, dramatic" },
  { value: "documentary", label: "🌍 Documentary — natural, realistic" },
  { value: "minimal",     label: "◻ Minimal — clean, text-driven" },
  { value: "news",        label: "📰 News-style — sharp, corporate" },
  { value: "horror",      label: "🩸 Horror — dark, unsettling" },
];

const DURATION_OPTIONS = [
  { value: "short",  label: "Short  (~5 min)" },
  { value: "medium", label: "Medium (~10 min)" },
  { value: "long",   label: "Long   (~15 min)" },
];

const VOICE_DEFAULTS = {
  'VR6AewLTigWG4xSOukaG': { stability: 0.35, similarity: 0.85, style: 0.60 }, // Arnold
  'pqHfZKP75CvOlD17v9Eu': { stability: 0.80, similarity: 0.80, style: 0.20 }, // Eric
  '21m00Tcm4TlvDq8ikWAM': { stability: 0.60, similarity: 0.80, style: 0.40 }, // Rachel
  'onwK4e9ZLuTAKqWW03F9': { stability: 0.75, similarity: 0.82, style: 0.20 }, // Daniel
  'IKne3meq5aSn9XLyUdCD': { stability: 0.65, similarity: 0.85, style: 0.55 }, // Charlie
  'JBFqnCBsd6RMkjVDRZzb': { stability: 0.50, similarity: 0.82, style: 0.50 }, // George
  'pNInz6obpgDQGcFmaJgB': { stability: 0.70, similarity: 0.85, style: 0.62 }, // Adam
};

const SLIDER_LABELS = {
  stability:  'Voice Control',
  similarity: 'Voice Identity',
  style:      'Dramatic Energy',
};

const VOICE_PRESETS = [
  { name: 'Cinematic Doc',  icon: '🎬', stability: 0.70, similarity: 0.85, style: 0.62, speed: 0.95 },
  { name: 'Breaking News',  icon: '🔴', stability: 0.55, similarity: 0.85, style: 0.55, speed: 1.05 },
  { name: 'High Tension',   icon: '⚡', stability: 0.45, similarity: 0.85, style: 0.75, speed: 1.05 },
  { name: 'Calm Authority', icon: '🎙️', stability: 0.80, similarity: 0.85, style: 0.35, speed: 0.95 },
  { name: 'Viral Energy',   icon: '🔥', stability: 0.40, similarity: 0.82, style: 0.80, speed: 1.10 },
];

function PipelineStep({ index, label, active, done }) {
  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
        background: active ? "#18104a" : done ? "#0a1a0a" : "#080818",
        border: `1px solid ${active ? "#7c3aed" : done ? "#10b981" : "#12122a"}`,
        borderRadius: 8,
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: "50%",
          background: active ? "#7c3aed" : done ? "#10b981" : "#12122a",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: "#fff", fontWeight: 700, flexShrink: 0,
        }}>{done ? "✓" : index + 1}</span>
        <span style={{ fontSize: 12, color: active ? "#c4b5fd" : done ? "#10b981" : "#3d3d60", fontWeight: 600 }}>
          {label}
        </span>
      </div>
      {index < STEP_LABELS.length - 1 && (
        <div style={{ width: 20, height: 1, background: "#12122a", flexShrink: 0 }} />
      )}
    </>
  );
}

// ── Pexels search (runs in browser — no IP block) ─────────────────
async function searchPexelsVideos(keyword, apiKey) {
  const encoded = encodeURIComponent(keyword);
  const res = await fetch(
    `https://api.pexels.com/videos/search?query=${encoded}&per_page=3&size=medium`,
    { headers: { Authorization: apiKey } }
  );
  if (!res.ok) throw new Error(`Pexels ${res.status}: ${keyword}`);
  const data = await res.json();
  const videos = data.videos || [];
  if (!videos.length) return null;

  // Pick first video, prefer 720p file
  const files   = videos[0].video_files || [];
  const hd      = files.find(f => f.height === 720) || files[0];
  return hd?.link || null;
}

// ── Download video blob from Pexels CDN ──────────────────────────
async function downloadBlob(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return await res.blob();
}

// ── Get presigned S3 upload URL from Lambda ──────────────────────
async function getPresignedUploadUrl(s3Key) {
  const res = await fetch(`${API_BASE}/api/autopilot/presign-upload`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
    body:    JSON.stringify({ s3_key: s3Key }),
  });
  const data = await res.json();
  return data.upload_url;
}

// ── Upload blob directly to S3 via presigned URL ─────────────────
async function uploadToS3(presignedUrl, blob) {
  const res = await fetch(presignedUrl, {
    method:  "PUT",
    headers: { "Content-Type": "video/mp4" },
    body:    blob,
  });
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`);
}

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

export default function CreateVideo() {
  const [step, setStep]               = useState(0);
  const [topic, setTopic]             = useState("");
  const [channelId, setChannelId]     = useState(CHANNELS[0].id);
  const [voiceId, setVoiceId]         = useState(() => {
    const saved = localStorage.getItem('voiceId');
    return saved && VOICE_LIBRARY.some(v => v.id === saved) ? saved : VOICE_LIBRARY[0].id;
  });
  const [voiceSettings, setVoiceSettings] = useState(() => {
    const saved = localStorage.getItem('voiceSettings');
    if (saved) {
      try { return JSON.parse(saved); } catch { /* fall through */ }
    }
    const initialId = localStorage.getItem('voiceId') || VOICE_LIBRARY[0].id;
    return VOICE_DEFAULTS[initialId] ?? { stability: 0.70, similarity: 0.85, style: 0.62 };
  });

  useEffect(() => {
    localStorage.setItem('voiceId', voiceId);
  }, [voiceId]);

  useEffect(() => {
    localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
  }, [voiceSettings]);

  const [voiceSpeed, setVoiceSpeed] = useState(() => {
    const saved = localStorage.getItem('voiceSpeed');
    return saved ? parseFloat(saved) : 1.0;
  });

  useEffect(() => {
    localStorage.setItem('voiceSpeed', voiceSpeed.toString());
  }, [voiceSpeed]);

  const [previewAudioUrl, setPreviewAudioUrl] = useState(null);
  const [previewLoading,  setPreviewLoading]  = useState(false);

  const [checkResults, setCheckResults] = useState(null);
  const [checking,     setChecking]     = useState(false);

  const handleCheckScript = async () => {
    if (!script.trim()) return;
    setChecking(true);
    setCheckResults(null);
    try {
      const res = await fetch(`${API_BASE}/api/autopilot/script/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-key': API_KEY },
        body: JSON.stringify({ script }),
      });
      const data = await res.json();
      setCheckResults(data);
    } finally {
      setChecking(false);
    }
  };

  const handleVoicePreview = async () => {
    setPreviewLoading(true);
    setPreviewAudioUrl(null);
    try {
      const res = await fetch(`${API_BASE}/api/autopilot/voice/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-app-key': API_KEY },
        body: JSON.stringify({
          voice_id:   voiceId,
          stability:  voiceSettings.stability,
          similarity: voiceSettings.similarity,
          style:      voiceSettings.style,
          speed:      voiceSpeed,
          text: 'The market is about to face its biggest test yet. And most investors have no idea what is coming.',
        }),
      });
      const data = await res.json();
      if (data.url) setPreviewAudioUrl(data.url);
    } finally {
      setPreviewLoading(false);
    }
  };
  const [visualStyle, setVisualStyle] = useState("cinematic");
  const [duration, setDuration]       = useState("medium");
  const [script, setScript]           = useState("");
  const [loadingScript, setLoadingScript]   = useState(false);
  const [scriptError, setScriptError]       = useState("");
  const [addedToQueue, setAddedToQueue]     = useState(false);
  const [jobId]                             = useState(() => `job_${crypto.randomUUID().slice(0, 12)}`);
  const [audioUrl, setAudioUrl]             = useState(null);
  const [assets, setAssets]                 = useState(null);
  const [visualsLoading, setVisualsLoading] = useState(false);
  const [visualsProgress, setVisualsProgress] = useState("");
  const [visualsError, setVisualsError]     = useState("");
  const [assembling, setAssembling]         = useState(false);
  const [videoUrl, setVideoUrl]             = useState(null);
  const [voiceStatus, setVoiceStatus]       = useState("");
  const [assembleStatus, setAssembleStatus] = useState("");
  const [assembleError, setAssembleError]   = useState("");
  const [scriptStatus, setScriptStatus]     = useState("");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);

  const channel  = CHANNELS.find(c => c.id === channelId);
  const voice    = VOICE_LIBRARY.find(v => v.id === voiceId);
  const wordCount = script.split(/\s+/).filter(Boolean).length;

  const handleVoiceChange = (id) => {
    setVoiceId(id);
    if (VOICE_DEFAULTS[id]) setVoiceSettings(VOICE_DEFAULTS[id]);
  };

  // ── Step 1: Generate script (fire & poll) ────────────────────────
  const generateScript = async () => {
    if (!topic.trim()) return;
    setLoadingScript(true);
    setScript("");
    setScriptError("");
    setScriptStatus("✍️ Starting script generation…");
    setVoiceStatus("");
    setAssembleStatus("");
    setAssembleError("");
    setAssets(null);
    setVideoUrl(null);

    try {
      await apiFetchJson(`/api/autopilot/script`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
        body:    JSON.stringify({ job_id: jobId, channel_id: channelId, topic, duration, visual_style: visualStyle }),
      });
    } catch (e) {
      setScriptError(e.message || "Failed to start script generation.");
      setScriptStatus("");
      setLoadingScript(false);
      return;
    }

    // Poll every 5s up to 2 minutes for stage = script_done.
    for (let i = 0; i < 24; i++) {
      await new Promise(r => setTimeout(r, 5000));
      setScriptStatus(`✍️ Writing script… (${(i + 1) * 5}s)`);
      try {
        const job = await apiFetchJson(`/api/autopilot/jobs/${jobId}`, {
          headers: { "x-app-key": API_KEY },
        });
        if (job.stage === "script_done" && job.script) {
          setScript(job.script);
          const wc = job.script.split(/\s+/).filter(Boolean).length;
          setScriptStatus(`✅ Script ready — ${wc} words`);
          setStep(1);
          setLoadingScript(false);
          return;
        }
        if (job.stage === "failed") {
          setScriptError(job.error || "Script generation failed.");
          setScriptStatus("");
          setLoadingScript(false);
          return;
        }
      } catch (_e) { /* keep polling */ }
    }

    setScriptError("Script generation timed out after 2 minutes.");
    setScriptStatus("");
    setLoadingScript(false);
  };

  // ── Step 2: Generate voiceover (fire & forget) ───────────────────
  const generateVoice = async () => {
    setStep(2);
    setAudioUrl("generating");
    setVoiceStatus("🎙️ Starting voiceover generation…");
    setAudioPreviewUrl(null);
    setAssembleStatus("");
    setAssembleError("");

    try {
      await apiFetchJson(`/api/autopilot/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
        body: JSON.stringify({
          job_id: jobId,
          channel_id: channelId,
          voice_id: voiceId,
          script,
          stability:  voiceSettings.stability,
          similarity: voiceSettings.similarity,
          style:      voiceSettings.style,
          speed:      voiceSpeed,
          voice_settings: {
            stability:         voiceSettings.stability,
            similarity_boost:  voiceSettings.similarity,
            style:             voiceSettings.style,
            speed:             voiceSpeed,
            use_speaker_boost: true,
          },
        }),
      });
    } catch (e) {
      setAudioUrl(null);
      setVoiceStatus(`❌ ${e.message || "Voice generation failed."}`);
      return;
    }

    // Poll DynamoDB until voice is ready or failed (max 3 minutes)
    for (let i = 0; i < 18; i++) {
      await new Promise(r => setTimeout(r, 10000));
      setVoiceStatus(`🎙️ Generating voiceover… (${(i + 1) * 10}s)`);
      try {
        const job = await apiFetchJson(`/api/autopilot/jobs/${jobId}`, {
          headers: { "x-app-key": API_KEY },
        });

        if (job.stage === "failed") {
          setAudioUrl(null);
          setVoiceStatus(`❌ ${job.error || "Voice generation failed."}`);
          return;
        }

        if (job.audio_duration && parseFloat(job.audio_duration) > 0 && job.voiceover_s3_key) {
          setAudioUrl("ready");
          setVoiceStatus(`✅ Voiceover ready — ${Math.round(parseFloat(job.audio_duration))}s audio`);
          try {
            const data = await apiFetchJson(`/api/autopilot/presign`, {
              method:  "POST",
              headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
              body:    JSON.stringify({ s3_key: job.voiceover_s3_key }),
            });
            setAudioPreviewUrl(data.url);
          } catch (_e) { /* preview optional */ }
          return;
        }
      } catch (_e) {
        // keep polling
      }
    }

    setAudioUrl(null);
    setVoiceStatus("❌ Voiceover timed out. Check the job status before continuing.");
  };

  // ── Step 3: Generate visuals (browser → Pexels → S3) ────────────
  const generateVisuals = async () => {
    setVisualsLoading(true);
    setVisualsError("");
    setAssets(null);
    setStep(3);

    try {
      if (!PEXELS_API_KEY) {
        throw new Error("Pexels API key is missing. Set VITE_PEXELS_API_KEY before generating visuals.");
      }

      // 3a. Fetch job to get audio duration and calculate clips needed
      const jobData = await apiFetchJson(`/api/autopilot/jobs/${jobId}`, {
        headers: { 'x-app-key': API_KEY },
      });
      const audioDuration = jobData.audio_duration || 300;
      const clipsNeeded  = Math.ceil(audioDuration / 5) + 4;

      // 3b. Ask Lambda/Claude for keywords per script section
      setVisualsProgress("🧠 Analyzing script sections…");
      const kwData = await apiFetchJson(`/api/autopilot/visuals-keywords`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
        body:    JSON.stringify({ topic, script, channel_id: channelId, clips_needed: clipsNeeded }),
      });

      const sections = Array.isArray(kwData.sections) ? kwData.sections : [];
      const newAssets = {};

      if (sections.length) {
        // v2 path: nested sections with per-clip duration/mood/visual_type
        const clipMetadata = [];
        let globalClipIndex = 0;

        for (const section of sections) {
          const clips = Array.isArray(section.clips) ? section.clips : [];
          for (let i = 0; i < clips.length; i++) {
            const clip = clips[i];
            const keywords = Array.isArray(clip.keywords) ? clip.keywords : [];
            if (!keywords.length) continue;

            const clipKey = `clip_${String(globalClipIndex).padStart(2, "0")}_${section.section}`;
            const s3Key   = `autopilot/jobs/${jobId}/visuals/${clipKey}.mp4`;

            setVisualsProgress(`🎬 ${section.section} clip ${i + 1}/${clips.length}: "${keywords[0]}"…`);

            // Pexels fallback chain — try keyword[0], then [1], then [2]
            let videoUrl = null;
            let usedKeyword = null;
            for (const kw of keywords) {
              try {
                videoUrl = await searchPexelsVideos(kw, PEXELS_API_KEY);
                if (videoUrl) { usedKeyword = kw; break; }
              } catch (e) {
                console.warn(`Pexels keyword failed: ${kw}`, e.message);
              }
            }
            if (!videoUrl) {
              console.warn(`All keywords failed for ${clipKey}, skipping`);
              continue;
            }

            try {
              setVisualsProgress(`⬇️ Downloading ${clipKey}…`);
              const blob = await downloadBlob(videoUrl);

              setVisualsProgress(`☁️ Uploading ${clipKey}…`);
              const uploadUrl = await getPresignedUploadUrl(s3Key);
              await uploadToS3(uploadUrl, blob);

              newAssets[clipKey] = s3Key;
              clipMetadata.push({
                key:          clipKey,
                section:      section.section,
                duration:     clip.duration,
                mood:         clip.mood,
                visual_type:  clip.visual_type,
                priority:     section.priority,
                keyword_used: usedKeyword,
              });
              globalClipIndex++;
            } catch (e) {
              console.warn(`Upload failed for ${clipKey}:`, e.message);
            }
          }
        }

        if (!Object.keys(newAssets).length) {
          throw new Error("No clips could be downloaded from Pexels.");
        }

        setVisualsProgress("💾 Saving to database…");
        await apiFetchJson(`/api/autopilot/visuals-save`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
          body:    JSON.stringify({ job_id: jobId, assets: newAssets, clip_metadata: clipMetadata }),
        });
      } else {
        // v1 fallback: flat keyword array, fixed clip naming
        const keywords = kwData.keywords || [topic, topic, topic, topic, topic, topic];

        for (let i = 0; i < keywords.length; i++) {
          const kw      = keywords[i];
          const clipKey = `clip_${String(i).padStart(2, "0")}`;
          const s3Key   = `autopilot/jobs/${jobId}/visuals/${clipKey}.mp4`;

          setVisualsProgress(`🎬 Fetching clip ${i + 1}/${keywords.length}: "${kw}"…`);

          try {
            const videoUrl = await searchPexelsVideos(kw, PEXELS_API_KEY);
            if (!videoUrl) {
              console.warn(`No Pexels result for "${kw}", skipping`);
              continue;
            }

            setVisualsProgress(`⬇️ Downloading clip ${i + 1}/${keywords.length}…`);
            const blob = await downloadBlob(videoUrl);

            setVisualsProgress(`☁️ Uploading clip ${i + 1}/${keywords.length} to S3…`);
            const uploadUrl = await getPresignedUploadUrl(s3Key);
            await uploadToS3(uploadUrl, blob);

            newAssets[clipKey] = s3Key;
          } catch (e) {
            console.warn(`Clip ${i} failed:`, e.message);
          }
        }

        if (!Object.keys(newAssets).length) {
          throw new Error("No clips could be downloaded from Pexels.");
        }

        setVisualsProgress("💾 Saving to database…");
        await apiFetchJson(`/api/autopilot/visuals-save`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
          body:    JSON.stringify({ job_id: jobId, assets: newAssets }),
        });
      }

      setAssets(newAssets);
      setVisualsProgress("");
    } catch (e) {
      setVisualsError(e.message || "Visual generation failed.");
      setVisualsProgress("");
    }
    setVisualsLoading(false);
  };

  // ── Step 4: Assemble video ───────────────────────────────────────
  const assembleVideo = async () => {
    setAssembling(true);
    setStep(4);
    setAssembleStatus("🎬 Queueing assembly…");
    setAssembleError("");

    try {
      await apiFetchJson(`/api/autopilot/assemble`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
        body: JSON.stringify({ job_id: jobId }),
      });
    } catch (e) {
      setAssembling(false);
      setAssembleError(e.message || "Assembly could not be started.");
      setAssembleStatus("");
      return;
    }

    // Poll job stage via Lambda until assembly completes. 25 × 10s = 250s
    // (a 4-min video takes ~130s to render plus download time).
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 10000));
      setAssembleStatus(`🎬 Rendering video… (${(i + 1) * 10}s)`);
      try {
        const job = await apiFetchJson(`/api/autopilot/jobs/${jobId}`, {
          headers: { 'x-app-key': API_KEY },
        });

        if (job.stage === 'pending_review' || job.stage === 'assembled') {
          setAssembleStatus("✅ Video assembled! Check Review Queue.");
          setAssembling(false);
          return;
        }

        if (job.stage === "failed") {
          setAssembleError(job.error || "❌ Assembly failed. Check logs.");
          setAssembleStatus("");
          setAssembling(false);
          return;
        }
      } catch (_e) {
        // keep polling
      }
    }

    setAssembleError("Assembly timed out. Check the job details and Lambda logs.");
    setAssembleStatus("");
    setAssembling(false);
  };

  const addToQueue = () => {
    setAddedToQueue(true);
    setTimeout(() => setAddedToQueue(false), 3000);
  };

  return (
    <div className="fade-in" style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Space Mono',monospace", fontSize: 22, fontWeight: 700, color: "#e0e0ff", letterSpacing: -1 }}>
          Create Video
        </h1>
        <div style={{ color: "#3d3d60", fontSize: 13, marginTop: 4 }}>
          Script → Voice → Visuals → Assemble → Publish
        </div>
      </div>

      {/* Pipeline steps */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 32, overflow: "auto", paddingBottom: 4 }}>
        {STEP_LABELS.map((label, i) => (
          <PipelineStep key={label} index={i} label={label} active={i === step} done={i < step} />
        ))}
      </div>

      {/* Config row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 22 }}>
        <div>
          <SectionLabel>Channel</SectionLabel>
          <Select value={channelId} onChange={setChannelId}
            options={CHANNELS.filter(c => c.id !== "ch_005").map(c => ({ value: c.id, label: `${c.avatar} ${c.name}` }))}
            style={{ width: "100%" }} />
        </div>
        <div>
          <SectionLabel>Voice</SectionLabel>
          <Select value={voiceId} onChange={handleVoiceChange}
            options={VOICE_LIBRARY.map(v => ({ value: v.id, label: v.name }))}
            style={{ width: "100%" }} />
        </div>
        <div>
          <SectionLabel>Visual Style</SectionLabel>
          <Select value={visualStyle} onChange={setVisualStyle} options={VISUAL_STYLES} style={{ width: "100%" }} />
        </div>
        <div>
          <SectionLabel>Duration</SectionLabel>
          <Select value={duration} onChange={setDuration} options={DURATION_OPTIONS} style={{ width: "100%" }} />
        </div>
      </div>

      {/* Voice settings sliders */}
      <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 16, marginBottom: 22, border: "1px solid #333" }}>
        <div style={{ color: "#aaa", fontSize: 13, marginBottom: 12 }}>🎙️ Voice Settings</div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {VOICE_PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => {
                setVoiceSettings({
                  stability:  preset.stability,
                  similarity: preset.similarity,
                  style:      preset.style,
                });
                setVoiceSpeed(preset.speed);
              }}
              style={{
                background: "#0f0f23",
                border: "1px solid #333",
                borderRadius: 8,
                padding: "6px 12px",
                color: "#ccc",
                cursor: "pointer",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}>
              {preset.icon} {preset.name}
            </button>
          ))}
        </div>

        {Object.entries(SLIDER_LABELS).map(([key, label]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#ccc", fontSize: 13 }}>
              <span>{label}</span>
              <span style={{ color: "#a78bfa" }}>{voiceSettings[key].toFixed(2)}</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.01"
              value={voiceSettings[key]}
              onChange={e => setVoiceSettings(p => ({ ...p, [key]: parseFloat(e.target.value) }))}
              style={{ width: "100%", accentColor: "#a78bfa" }}
            />
          </div>
        ))}

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#ccc", fontSize: 13 }}>
            <span>Speed</span>
            <span style={{ color: "#a78bfa" }}>{voiceSpeed.toFixed(2)}×</span>
          </div>
          <input
            type="range" min="0.7" max="1.2" step="0.05"
            value={voiceSpeed}
            onChange={e => setVoiceSpeed(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#a78bfa" }}
          />
        </div>

        <button
          onClick={handleVoicePreview}
          disabled={previewLoading}
          style={{
            background: "#1e1e3f",
            border: "1px solid #6366f1",
            borderRadius: 8,
            padding: "8px 16px",
            color: "#a78bfa",
            cursor: previewLoading ? "wait" : "pointer",
            fontSize: 13,
            width: "100%",
            marginTop: 8,
          }}>
          {previewLoading ? "⏳ Generating preview..." : "▶ Preview Voice"}
        </button>
        {previewAudioUrl && (
          <audio controls src={previewAudioUrl} style={{ width: "100%", marginTop: 8 }} />
        )}
      </div>

      {/* Topic */}
      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Video Topic</SectionLabel>
        <div style={{ display: "flex", gap: 10 }}>
          <Input
            value={topic}
            onChange={setTopic}
            placeholder="e.g. The Zodiac Killer's Unsolved Code…"
            onKeyDown={e => e.key === "Enter" && generateScript()}
            style={{ flex: 1 }}
          />
          <Button onClick={generateScript} disabled={loadingScript || !topic.trim()}>
            {loadingScript ? <><Spinner size={14} /> Generating…</> : "✍️ Generate Script"}
          </Button>
        </div>
        {scriptError && <div style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>{scriptError}</div>}
        {!scriptError && scriptStatus && (
          <div style={{
            color: scriptStatus.startsWith("✅") ? "#10b981" : "#f59e0b",
            fontSize: 12, marginTop: 8,
          }}>
            {scriptStatus}
          </div>
        )}
      </div>

      {/* ── STEP 1: Script ── */}
      {(script || loadingScript) && (
        <div className="fade-in">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <SectionLabel>Generated Script</SectionLabel>
            {script && (
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#10b981" }}>✓ {wordCount} words</span>
                <span style={{ fontSize: 11, color: "#3d3d60" }}>~{Math.round(wordCount / 130)} min</span>
              </div>
            )}
          </div>
          <textarea
            value={loadingScript ? "Generating script…" : script}
            onChange={e => setScript(e.target.value)}
            rows={16}
            style={{
              width: "100%", background: "#06061a", border: "1px solid #1a1a3a",
              borderRadius: 12, color: "#b4b4d0", padding: "18px 20px",
              fontSize: 13, fontFamily: "'Space Mono',monospace",
              lineHeight: 1.85, resize: "none", outline: "none",
            }}
          />
          {script && (
            <>
              <button
                onClick={handleCheckScript}
                disabled={checking}
                style={{
                  background: "#1e1e3f",
                  border: "1px solid #6366f1",
                  borderRadius: 8,
                  padding: "10px 16px",
                  color: "#a78bfa",
                  cursor: checking ? "wait" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  width: "100%",
                  marginTop: 12,
                }}>
                {checking ? "⏳ Checking…" : "🔍 Check Script"}
              </button>

              {checkResults && (
                <div style={{
                  background: "#0f0f23",
                  borderRadius: 12,
                  padding: 16,
                  marginTop: 12,
                  border: `1px solid ${checkResults.score > 80 ? "#10b981" : checkResults.score > 60 ? "#f59e0b" : "#ef4444"}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ color: "#aaa", fontSize: 14 }}>Script Quality Score</span>
                    <span style={{
                      fontSize: 24, fontWeight: 900,
                      color: checkResults.score > 80 ? "#10b981" : checkResults.score > 60 ? "#f59e0b" : "#ef4444",
                    }}>{checkResults.score}/100</span>
                  </div>

                  {checkResults.summary && (
                    <div style={{ color: "#ccc", fontSize: 13, marginBottom: 12 }}>
                      {checkResults.summary}
                    </div>
                  )}

                  {checkResults.errors?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        🔴 Errors ({checkResults.errors.length})
                      </div>
                      {checkResults.errors.map((e, i) => (
                        <div key={i} style={{
                          background: "#1a0000", borderRadius: 6, padding: "6px 10px",
                          marginBottom: 4, fontSize: 12, color: "#fca5a5",
                        }}>
                          <strong>{e.severity?.toUpperCase()}</strong> — {e.issue}
                          {e.line && <div style={{ color: "#888", marginTop: 2 }}>"{e.line}"</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {checkResults.duplicates?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        🟡 Duplicates ({checkResults.duplicates.length})
                      </div>
                      {checkResults.duplicates.map((d, i) => (
                        <div key={i} style={{
                          background: "#1a1200", borderRadius: 6, padding: "6px 10px",
                          marginBottom: 4, fontSize: 12, color: "#fde68a",
                        }}>
                          "{d.text}"
                        </div>
                      ))}
                    </div>
                  )}

                  {checkResults.style_issues?.length > 0 && (
                    <div>
                      <div style={{ color: "#6366f1", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        🔵 Style Issues ({checkResults.style_issues.length})
                      </div>
                      {checkResults.style_issues.map((s, i) => (
                        <div key={i} style={{
                          background: "#0a0a1a", borderRadius: 6, padding: "6px 10px",
                          marginBottom: 4, fontSize: 12, color: "#a5b4fc",
                        }}>
                          {s.issue}
                          {s.line && <div style={{ color: "#888", marginTop: 2 }}>"{s.line}"</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {checkResults.error && (
                    <div style={{ color: "#fca5a5", fontSize: 12 }}>
                      ⚠ {checkResults.error}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16 }}>
                <Button variant="success" onClick={() => setStep(1)} style={{ justifyContent: "center" }}>
                  🎙️ Go to Voiceover
                </Button>
                <Button variant="warning" onClick={generateVisuals}
                  disabled={visualsLoading || !audioPreviewUrl}
                  title={!audioPreviewUrl ? "Generate and preview voiceover first" : ""}
                  style={{ justifyContent: "center" }}>
                  🎨 Generate Visuals
                </Button>
                <Button onClick={addToQueue} style={{ justifyContent: "center" }}>
                  {addedToQueue ? "✅ Added!" : "🚀 Add to Queue"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STEP 2: Voiceover ── */}
      {step >= 1 && script && (
        <div className="fade-in" style={{ marginTop: 24, background: "#08081e", border: "1px solid #12122a", borderRadius: 14, padding: 20 }}>
          <SectionLabel>Voiceover Generation</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎙️</div>
            <div>
              <div style={{ color: "#e0e0ff", fontWeight: 700 }}>{voice?.name}</div>
              <div style={{ color: "#3d3d60", fontSize: 12 }}>ElevenLabs v2</div>
            </div>
          </div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
  {[
    ["Stability",        voiceSettings.stability.toFixed(2)],
    ["Similarity Boost", voiceSettings.similarity.toFixed(2)],
    ["Style",            voiceSettings.style.toFixed(2)],
    ["Speed",            `${voiceSpeed.toFixed(2)}×`],
  ].map(([k, v]) => (
    <div key={k} style={{ background: "#06061a", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontSize: 12, color: "#3d3d60" }}>{k}</span>
      <span style={{ fontSize: 12, color: "#a78bfa", fontFamily: "'Space Mono',monospace" }}>{v}</span>
    </div>
  ))}
</div>
          <Button style={{ width: "100%", justifyContent: "center" }} onClick={generateVoice} disabled={audioUrl === "generating"}>
            {audioUrl === "generating" ? <><Spinner size={14} /> Generating…</> : "🎙️ Generate Full Voiceover via ElevenLabs"}
          </Button>
          {(audioUrl === "generating" || voiceStatus) && (
            <div style={{
              color: voiceStatus?.startsWith("✅") ? "#10b981" : voiceStatus?.startsWith("❌") ? "#ef4444" : "#f59e0b",
              fontSize: 13, marginTop: 10, textAlign: "center",
            }}>
              {voiceStatus || "🎙️ Starting voiceover generation…"}
            </div>
          )}

          {/* Audio preview — appears once voiceover is ready */}
          {audioPreviewUrl && (
            <div className="fade-in" style={{
              background: "#08081e", border: "1px solid #2d1b6e",
              borderRadius: 12, padding: 16, marginTop: 14,
            }}>
              <div style={{ color: "#a78bfa", fontSize: 12, marginBottom: 10, fontWeight: 600 }}>
                🎧 Preview voiceover:
              </div>
              <audio controls src={audioPreviewUrl} style={{ width: "100%" }} />
              <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = audioPreviewUrl;
                    a.download = `voice-${jobId}.mp3`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  style={{
                    background: '#6366f1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 20px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    flex: 1
                  }}>
                  ⬇️ Download Audio
                </button>
                <Button variant="danger" onClick={generateVoice} disabled={audioUrl === "generating"}
                  style={{ flex: 1, justifyContent: "center" }}>
                  🔄 Regenerate Voice
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Visuals ── */}
      {step >= 2 && (
        <div className="fade-in" style={{ marginTop: 16, background: "#08081e", border: "1px solid #12122a", borderRadius: 14, padding: 20 }}>
          <SectionLabel>Visual Generation — Pexels Stock Footage</SectionLabel>

          {/* Progress */}
          {visualsLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, color: "#a78bfa", fontSize: 13 }}>
              <Spinner size={14} />
              {visualsProgress || "Working…"}
            </div>
          )}

          {/* Asset grid */}
          {assets && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
              {Object.entries(assets).map(([key]) => (
                <div key={key} style={{ background: "#06061a", border: "1px solid #12122a", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "#3d3d60", marginBottom: 4 }}>{key}</div>
                  <div style={{ fontSize: 12, color: "#10b981" }}>✓ Uploaded to S3</div>
                </div>
              ))}
            </div>
          )}

          {!assets && !visualsLoading && (
            <div style={{ color: "#3d3d60", fontSize: 13, marginBottom: 14 }}>
              Claude picks keywords from your script → searches Pexels → uploads HD clips to S3.
            </div>
          )}

          {visualsError && (
            <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 14 }}>{visualsError}</div>
          )}

          <Button
            variant="warning"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={generateVisuals}
            disabled={visualsLoading}
          >
            {visualsLoading
              ? <><Spinner size={14} /> {visualsProgress || "Generating…"}</>
              : assets
              ? "🔄 Regenerate Visuals"
              : "🎬 Generate Visuals from Pexels"}
          </Button>

          {assets && (
            <div style={{ color: "#10b981", fontSize: 13, marginTop: 10, textAlign: "center" }}>
              ✅ {Object.keys(assets).length} clips ready in S3
            </div>
          )}
        </div>
      )}

      {/* ── STEP 4: Assemble ── */}
      {step >= 3 && assets && audioUrl === "ready" && (
        <div className="fade-in" style={{ marginTop: 16, background: "#08081e", border: "1px solid #12122a", borderRadius: 14, padding: 20 }}>
          <SectionLabel>Video Assembly — Shotstack Cloud Render</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {[
              `${Object.keys(assets).length} Pexels clips → Shotstack timeline`,
              "Sync ElevenLabs voiceover",
              "Burn subtitles (SRT)",
              "Render via Shotstack API",
              "Upload final MP4 to S3",
            ].map(task => (
              <div key={task} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, color: "#10b981" }}>✓</span>
                <span style={{ fontSize: 13, color: "#6b7280" }}>{task}</span>
              </div>
            ))}
          </div>
          <Button
            variant="success"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={assembleVideo}
            disabled={assembling}
          >
            {assembling ? <><Spinner size={14} /> Assembling… (~2 min)</> : "🎬 Assemble Video"}
          </Button>
          {assembling && (
            <div style={{ color: "#f59e0b", fontSize: 13, marginTop: 10, textAlign: "center" }}>
              {assembleStatus || "Shotstack is rendering your video. Polling every 10 seconds…"}
            </div>
          )}
          {!assembling && assembleStatus && (
            <div style={{ color: "#10b981", fontSize: 13, marginTop: 10, textAlign: "center" }}>
              {assembleStatus}
            </div>
          )}
          {assembleError && (
            <div style={{ color: "#ef4444", fontSize: 13, marginTop: 10, textAlign: "center" }}>
              {assembleError}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 5: Publish ── */}
      {step >= 5 && videoUrl && (
        <div className="fade-in" style={{ marginTop: 16, background: "#08081e", border: "1px solid #12122a", borderRadius: 14, padding: 20 }}>
          <SectionLabel>✅ Video Ready — Preview & Publish</SectionLabel>

          {/* Video preview */}
          <video
            controls
            src={videoUrl}
            style={{ width: "100%", borderRadius: 10, marginBottom: 16, background: "#000" }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {[
              ["Title",      topic || "Auto-generated"],
              ["Channel",    channel?.name],
              ["Visibility", "Public"],
              ["Schedule",   "Publish now"],
              ["Tags",       "Auto from script"],
              ["Thumbnail",  "First frame"],
            ].map(([k, v]) => (
              <div key={k} style={{ background: "#06061a", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: "#3d3d60", marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 13, color: "#c4c4e0", fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button
              variant="success"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={addToQueue}
            >
              {addedToQueue ? "✅ Scheduled!" : "🚀 Publish to YouTube"}
            </Button>
            <Button
              variant="secondary"
              style={{ justifyContent: "center" }}
              onClick={() => window.open(videoUrl, "_blank")}
            >
              ⬇️ Download
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
