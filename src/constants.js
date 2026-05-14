// ── Shared constants ──────────────────────────────────────────────

export const API_BASE = import.meta.env.VITE_API_BASE || "";
export const API_KEY  = import.meta.env.VITE_API_KEY || "";

// Note: when Pexels requests are made directly from the browser, the key is still visible to users.
// This removes committed secrets from source, but a backend proxy is safer long-term.
export const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY || "";

export const CHANNELS = [
  { id: "ch_001", name: "True Crime Daily",  niche: "True Crime",  avatar: "🔍", videos: 312, subs: "284K", revenue: 1840, status: "live",     nextPublish: "2h",  voice: "Ava",    schedule: "3x/week" },
  { id: "ch_002", name: "Strategic Pulse Intel", niche: "Military & Defense", avatar: "🎖️", videos: 187, subs: "91K",  revenue: 620,  status: "live",     nextPublish: "5h",  voice: "Eric",   schedule: "2x/week" },
  { id: "ch_003", name: "Earth Unseen",      niche: "Nature Docs", avatar: "🌍", videos: 94,  subs: "42K",  revenue: 310,  status: "paused",   nextPublish: null,  voice: "Sofia",  schedule: "1x/week" },
  { id: "ch_004", name: "Finance Decoded",   niche: "Finance",     avatar: "📈", videos: 56,  subs: "18K",  revenue: 180,  status: "building", nextPublish: null,  voice: "Ava",    schedule: "2x/week" },
  { id: "ch_005", name: "Shorts — Facts That Hit Different", niche: "Finance Facts", avatar: "⚡", videos: 0, subs: "0",   revenue: 0,    status: "live",     nextPublish: null,  voice: "Charlie", schedule: "daily" },
];

// Channel → default voice mapping. ch_003 was historically misnamed "Rachel"
// but the actual ID was Adam — kept on Adam so the channel's sound is unchanged.
export const VOICES = {
  ch_001: { id: import.meta.env.VITE_VOICE_ARNOLD,  name: "Arnold (True Crime)" },
  ch_002: { id: import.meta.env.VITE_VOICE_ERIC,    name: "Eric (Strategic Pulse Intel)" },
  ch_003: { id: import.meta.env.VITE_VOICE_ADAM,    name: "Adam (Earth Unseen)" },
  ch_004: { id: import.meta.env.VITE_VOICE_DANIEL,  name: "Daniel (Finance)" },
  ch_005: { id: import.meta.env.VITE_VOICE_CHARLIE, name: "Charlie (Shorts)" },
};

// Full picker library shown in the Create Video voice dropdown.
// Includes voices not bound to a default channel (George) and the real Rachel.
export const VOICE_LIBRARY = [
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold — True Crime" },
  { id: "pqHfZKP75CvOlD17v9Eu", name: "Eric — Military" },
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel — Nature" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel — Finance" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie — Shorts" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George — British" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam — Documentary" },
];

export const PIPELINE_STAGES = {
  queued:           { color: "#4b5563", label: "Queued",           icon: "⏳", order: 0 },
  script_done:      { color: "#8b5cf6", label: "Script Ready",     icon: "✍️", order: 1 },
  voice_generating: { color: "#3b82f6", label: "Voice Generating", icon: "🎙️", order: 2 },
  voice_done:       { color: "#6366f1", label: "Voice Ready",      icon: "🎧", order: 3 },
  visuals_done:     { color: "#f59e0b", label: "Visuals Ready",    icon: "🎨", order: 4 },
  assembly_queued:  { color: "#ec4899", label: "Assembly Queued",  icon: "🎬", order: 5 },
  assembled:        { color: "#10b981", label: "Assembled",        icon: "✅", order: 6 },
  published:        { color: "#10b981", label: "Published",        icon: "🚀", order: 7 },
  failed:           { color: "#ef4444", label: "Failed",           icon: "❌", order: -1 },
};

export const QUEUE = [
  { id: "job_001", title: "The Disappearance of Flight MH370 — New Evidence", channelId: "ch_001", channel: "True Crime Daily", stage: "publishing", progress: 97, eta: "12m",  createdAt: "2h ago" },
  { id: "job_002", title: "Why Your Brain Lies To You Every Morning",          channelId: "ch_002", channel: "Mind Unlocked",   stage: "rendering",  progress: 72, eta: "45m",  createdAt: "3h ago" },
  { id: "job_003", title: "The Amazon River's Hidden Predators",               channelId: "ch_003", channel: "Earth Unseen",    stage: "voiceover",  progress: 41, eta: "1h 20m",createdAt: "4h ago" },
  { id: "job_004", title: "Compound Interest — The Silent Wealth Builder",     channelId: "ch_004", channel: "Finance Decoded", stage: "scripting",  progress: 18, eta: "3h",   createdAt: "5h ago" },
  { id: "job_005", title: "The Zodiac Killer's Unsolved Code",                 channelId: "ch_001", channel: "True Crime Daily",stage: "queued",     progress: 0,  eta: "5h",   createdAt: "6h ago" },
  { id: "job_006", title: "The Science of Lucid Dreaming",                     channelId: "ch_002", channel: "Mind Unlocked",   stage: "queued",     progress: 0,  eta: "7h",   createdAt: "6h ago" },
];

export const ANALYTICS_DATA = {
  views:    [12400, 18200, 15600, 22100, 19800, 28400, 31200, 27800, 35100, 41200, 38900, 45600],
  revenue:  [820, 1100, 940, 1380, 1220, 1740, 1890, 1650, 2100, 2480, 2290, 2950],
  uploads:  [8, 12, 10, 14, 11, 16, 18, 15, 19, 22, 20, 23],
  months:   ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
};

export const API_HEALTH = [
  { name: "Claude API",    status: "ok",   latency: "210ms" },
  { name: "ElevenLabs",    status: "ok",   latency: "340ms" },
  { name: "FAL.ai",        status: "ok",   latency: "520ms" },
  { name: "YouTube API",   status: "ok",   latency: "180ms" },
  { name: "AWS Lambda",    status: "warn", latency: "890ms" },
  { name: "S3 / FFmpeg",   status: "ok",   latency: "95ms"  },
];

export { MOCK_TOPICS } from "./pages/Topics";

export const PENDING_TOPICS_COUNT = 11; // updated dynamically in real app
