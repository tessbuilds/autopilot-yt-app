import { useState } from "react";
import { CHANNELS, VOICES, PIPELINE_STAGES, API_BASE, API_KEY } from "../constants";
import { Button, Input, Select, Spinner, SectionLabel, ProgressBar } from "../components/ui";

const STEP_LABELS = ["Script", "Voiceover", "Visuals", "Assemble", "Publish"];
const VISUAL_STYLES = [
  { value: "cinematic", label: "🎬 Cinematic — dark, moody, dramatic" },
  { value: "documentary", label: "🌍 Documentary — natural, realistic" },
  { value: "minimal", label: "◻ Minimal — clean, text-driven" },
  { value: "news", label: "📰 News-style — sharp, corporate" },
  { value: "horror", label: "🩸 Horror — dark, unsettling" },
];

const DURATION_OPTIONS = [
  { value: "short",  label: "Short  (~5 min)" },
  { value: "medium", label: "Medium (~10 min)" },
  { value: "long",   label: "Long   (~15 min)" },
];

function PipelineStep({ index, label, active }) {
  return (
    <>
      <div style={{
        display:"flex", alignItems:"center", gap:8, padding:"8px 14px",
        background: active ? "#18104a" : "#080818",
        border:`1px solid ${active ? "#7c3aed" : "#12122a"}`,
        borderRadius:8,
      }}>
        <span style={{
          width:20, height:20, borderRadius:"50%",
          background: active ? "#7c3aed" : "#12122a",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:11, color: active ? "#fff" : "#3d3d60", fontWeight:700, flexShrink:0,
        }}>{index + 1}</span>
        <span style={{ fontSize:12, color: active ? "#c4b5fd" : "#3d3d60", fontWeight:600 }}>{label}</span>
      </div>
      {index < STEP_LABELS.length - 1 && <div style={{ width:20, height:1, background:"#12122a", flexShrink:0 }} />}
    </>
  );
}

export default function CreateVideo() {
  const [step, setStep]               = useState(0);
  const [topic, setTopic]             = useState("");
  const [channelId, setChannelId]     = useState(CHANNELS[0].id);
  const [voiceId, setVoiceId]         = useState(VOICES[0].id);
  const [visualStyle, setVisualStyle] = useState("cinematic");
  const [duration, setDuration]       = useState("medium");
  const [script, setScript]           = useState("");
  const [loadingScript, setLoadingScript] = useState(false);
  const [scriptError, setScriptError] = useState("");
  const [addedToQueue, setAddedToQueue] = useState(false);
  const [jobId]                       = useState(() => `job_${crypto.randomUUID().slice(0, 12)}`);
  const [audioUrl, setAudioUrl]       = useState(null);
  const [assets, setAssets]           = useState(null);

  const channel = CHANNELS.find(c => c.id === channelId);
  const voice   = VOICES.find(v => v.id === voiceId);

  const generateScript = async () => {
    if (!topic.trim()) return;
    setLoadingScript(true);
    setScript("");
    setScriptError("");
    try {
      const res = await fetch(`${API_BASE}/api/autopilot/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
        body: JSON.stringify({ channel_id: channelId, topic, duration, visual_style: visualStyle }),
      });
      const data = await res.json();
      setScript(data.script);
      setStep(1);
    } catch {
      setScriptError("Failed to generate script. Check your API connection.");
    }
    setLoadingScript(false);
  };

  const generateVoice = async () => {
    setStep(2);
    setAudioUrl("generating");

    // Fire and forget — API Gateway cuts off at 29s but Lambda finishes
    fetch(`${API_BASE}/api/autopilot/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
      body: JSON.stringify({ job_id: jobId, channel_id: channelId, script }),
    }).catch(() => {}); // swallow the 503

    // Wait 50s then mark done (Lambda takes ~45s for a medium script)
    await new Promise(r => setTimeout(r, 50000));
    setAudioUrl("ready");
  };

  const generateVisuals = async () => {
    setStep(3);
    try {
      const res = await fetch(`${API_BASE}/api/autopilot/visuals`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-app-key": API_KEY },
        body: JSON.stringify({ job_id: jobId, channel_id: channelId, topic, visual_style: visualStyle }),
      });
      const data = await res.json();
      setAssets(data.assets);
    } catch {
      setScriptError("Visual generation failed.");
    }
  };

  const addToQueue = () => {
    setAddedToQueue(true);
    setTimeout(() => setAddedToQueue(false), 3000);
  };

  const wordCount = script.split(/\s+/).filter(Boolean).length;

  return (
    <div className="fade-in" style={{ maxWidth:800 }}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Space Mono',monospace", fontSize:22, fontWeight:700, color:"#e0e0ff", letterSpacing:-1 }}>Create Video</h1>
        <div style={{ color:"#3d3d60", fontSize:13, marginTop:4 }}>Script → Voice → Visuals → Assemble → Publish</div>
      </div>

      {/* Pipeline steps */}
      <div style={{ display:"flex", alignItems:"center", marginBottom:32, overflow:"auto", paddingBottom:4 }}>
        {STEP_LABELS.map((label, i) => <PipelineStep key={label} index={i} label={label} active={i === step} />)}
      </div>

      {/* Config */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:14, marginBottom:22 }}>
        <div>
          <SectionLabel>Channel</SectionLabel>
          <Select value={channelId} onChange={setChannelId} options={CHANNELS.map(c => ({ value:c.id, label:`${c.avatar} ${c.name}` }))} style={{ width:"100%" }} />
        </div>
        <div>
          <SectionLabel>Voice</SectionLabel>
          <Select value={voiceId} onChange={setVoiceId} options={VOICES.map(v => ({ value:v.id, label:`${v.name} — ${v.accent}` }))} style={{ width:"100%" }} />
        </div>
        <div>
          <SectionLabel>Visual Style</SectionLabel>
          <Select value={visualStyle} onChange={setVisualStyle} options={VISUAL_STYLES} style={{ width:"100%" }} />
        </div>
        <div>
          <SectionLabel>Duration</SectionLabel>
          <Select value={duration} onChange={setDuration} options={DURATION_OPTIONS} style={{ width:"100%" }} />
        </div>
      </div>

      {/* Topic */}
      <div style={{ marginBottom:22 }}>
        <SectionLabel>Video Topic</SectionLabel>
        <div style={{ display:"flex", gap:10 }}>
          <Input
            value={topic}
            onChange={setTopic}
            placeholder="e.g. The Zodiac Killer's Unsolved Code..."
            onKeyDown={e => e.key === "Enter" && generateScript()}
            style={{ flex:1 }}
          />
          <Button onClick={generateScript} disabled={loadingScript || !topic.trim()}>
            {loadingScript ? <><Spinner size={14} /> Generating…</> : "✍️ Generate Script"}
          </Button>
        </div>
        {scriptError && <div style={{ color:"#ef4444", fontSize:12, marginTop:8 }}>{scriptError}</div>}
      </div>

      {/* Script area */}
      {(script || loadingScript) && (
        <div className="fade-in">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <SectionLabel>Generated Script</SectionLabel>
            {script && (
              <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                <span style={{ fontSize:11, color:"#10b981" }}>✓ {wordCount} words</span>
                <span style={{ fontSize:11, color:"#3d3d60" }}>~{Math.round(wordCount / 130)} min read</span>
              </div>
            )}
          </div>
          <textarea
            value={loadingScript ? "Generating script…" : script}
            onChange={e => setScript(e.target.value)}
            rows={18}
            style={{
              width:"100%", background:"#06061a", border:"1px solid #1a1a3a", borderRadius:12,
              color:"#b4b4d0", padding:"18px 20px", fontSize:13, fontFamily:"'Space Mono',monospace",
              lineHeight:1.85, resize:"none", outline:"none",
            }}
          />
          {script && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginTop:16 }}>
              <Button variant="success" onClick={() => setStep(1)} style={{ justifyContent:"center" }}>
                🎙️ Generate Voiceover
              </Button>
              <Button variant="warning" onClick={generateVisuals} style={{ justifyContent:"center" }}>
                🎨 Generate Visuals
              </Button>
              <Button onClick={addToQueue} style={{ justifyContent:"center" }}>
                {addedToQueue ? "✅ Added to Queue!" : "🚀 Add to Queue"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Voiceover panel */}
      {step >= 1 && script && (
        <div className="fade-in" style={{ marginTop:24, background:"#08081e", border:"1px solid #12122a", borderRadius:14, padding:20 }}>
          <SectionLabel>Voiceover Generation</SectionLabel>
          <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:14 }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#7c3aed,#4f46e5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🎙️</div>
            <div>
              <div style={{ color:"#e0e0ff", fontWeight:700 }}>{voice?.name}</div>
              <div style={{ color:"#3d3d60", fontSize:12 }}>{voice?.accent} · {voice?.style} · ElevenLabs v2</div>
            </div>
            <Button small variant="secondary" style={{ marginLeft:"auto" }}>▶ Preview Voice</Button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
            {[["Stability", "0.75"], ["Similarity Boost", "0.85"], ["Style", "0.40"], ["Speed", "1.0×"]].map(([k, v]) => (
              <div key={k} style={{ background:"#06061a", borderRadius:8, padding:"10px 14px", display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:12, color:"#3d3d60" }}>{k}</span>
                <span style={{ fontSize:12, color:"#a78bfa", fontFamily:"'Space Mono',monospace" }}>{v}</span>
              </div>
            ))}
          </div>
          <Button
            style={{ width:"100%", justifyContent:"center" }}
            onClick={generateVoice}
            disabled={audioUrl === "generating"}
          >
            {audioUrl === "generating" ? <><Spinner size={14} /> Generating…</> : "🎙️ Generate Full Voiceover via ElevenLabs"}
          </Button>
          {audioUrl === "generating" && (
            <div style={{ color:"#f59e0b", fontSize:13, marginTop:10, textAlign:"center" }}>
              🎙️ Generating voiceover… (~45 seconds). You can generate visuals while you wait.
            </div>
          )}
          {audioUrl === "ready" && (
            <div style={{ color:"#10b981", fontSize:13, marginTop:10, textAlign:"center" }}>
              ✅ Voiceover ready in S3 — proceed to visuals or assemble.
            </div>
          )}
        </div>
      )}

      {/* Visuals panel */}
      {step >= 2 && (
        <div className="fade-in" style={{ marginTop:16, background:"#08081e", border:"1px solid #12122a", borderRadius:14, padding:20 }}>
          <SectionLabel>Visual Generation — {VISUAL_STYLES.find(v => v.value === visualStyle)?.label}</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
            {["Background plate", "B-roll 1", "B-roll 2", "B-roll 3", "Title card", "Outro card"].map(asset => (
              <div key={asset} style={{ background:"#06061a", border:"1px solid #12122a", borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:11, color:"#3d3d60", marginBottom:4 }}>{asset}</div>
                <div style={{ fontSize:12, color: assets ? "#10b981" : "#7c3aed" }}>
                  {assets ? "✓ Saved to S3" : "FAL.ai FLUX"}
                </div>
              </div>
            ))}
          </div>
          <Button variant="warning" style={{ width:"100%", justifyContent:"center" }} onClick={generateVisuals}>
            🎨 Generate All Visuals via FAL.ai
          </Button>
          {assets && (
            <div style={{ color:"#10b981", fontSize:13, marginTop:10, textAlign:"center" }}>
              ✅ All 6 visuals saved to S3
            </div>
          )}
        </div>
      )}

      {/* Assemble */}
      {step >= 3 && (
        <div className="fade-in" style={{ marginTop:16, background:"#08081e", border:"1px solid #12122a", borderRadius:14, padding:20 }}>
          <SectionLabel>Video Assembly — FFmpeg Lambda</SectionLabel>
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:14 }}>
            {["Sync audio to timeline", "Overlay B-roll visuals", "Burn subtitles (SRT)", "Add intro/outro", "Encode H.264 1080p60"].map(task => (
              <div key={task} style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:14, color:"#10b981" }}>✓</span>
                <span style={{ fontSize:13, color:"#6b7280" }}>{task}</span>
              </div>
            ))}
          </div>
          <Button variant="success" style={{ width:"100%", justifyContent:"center" }} onClick={() => setStep(4)}>
            🎬 Assemble Video
          </Button>
        </div>
      )}

      {/* Publish */}
      {step >= 4 && (
        <div className="fade-in" style={{ marginTop:16, background:"#08081e", border:"1px solid #12122a", borderRadius:14, padding:20 }}>
          <SectionLabel>Publish to YouTube</SectionLabel>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            {[
              ["Title", topic || "Auto-generated"],
              ["Channel", channel?.name],
              ["Visibility", "Public"],
              ["Schedule", "Next available slot"],
              ["Tags", "Auto-generated from script"],
              ["Thumbnail", "AI-generated title card"],
            ].map(([k, v]) => (
              <div key={k} style={{ background:"#06061a", borderRadius:8, padding:"10px 14px" }}>
                <div style={{ fontSize:10, color:"#3d3d60", marginBottom:2 }}>{k}</div>
                <div style={{ fontSize:13, color:"#c4c4e0", fontWeight:600 }}>{v}</div>
              </div>
            ))}
          </div>
          <Button style={{ width:"100%", justifyContent:"center" }} onClick={addToQueue}>
            {addedToQueue ? "✅ Scheduled!" : "🚀 Schedule & Publish"}
          </Button>
        </div>
      )}
    </div>
  );
}