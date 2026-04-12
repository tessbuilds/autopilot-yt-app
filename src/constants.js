// ── Shared constants ──────────────────────────────────────────────

export const API_BASE = "https://dbz5w0lclb.execute-api.us-east-1.amazonaws.com";
export const API_KEY  = "ap-prod-2026";

export const CHANNELS = [
  { id: "ch_001", name: "True Crime Daily",  niche: "True Crime",  avatar: "🔍", videos: 312, subs: "284K", revenue: 1840, status: "live",     nextPublish: "2h",  voice: "Ava",    schedule: "3x/week" },
  { id: "ch_002", name: "Mind Unlocked",     niche: "Psychology",  avatar: "🧠", videos: 187, subs: "91K",  revenue: 620,  status: "live",     nextPublish: "5h",  voice: "Marcus", schedule: "2x/week" },
  { id: "ch_003", name: "Earth Unseen",      niche: "Nature Docs", avatar: "🌍", videos: 94,  subs: "42K",  revenue: 310,  status: "paused",   nextPublish: null,  voice: "Sofia",  schedule: "1x/week" },
  { id: "ch_004", name: "Finance Decoded",   niche: "Finance",     avatar: "📈", videos: 56,  subs: "18K",  revenue: 180,  status: "building", nextPublish: null,  voice: "Ava",    schedule: "2x/week" },
];

export const VOICES = [
  { id: "v_001", name: "Ava",    accent: "American",  style: "Calm narrator",   elevenId: "EXAVITQu4vr4xnSDxMaL", active: true,  samples: 3 },
  { id: "v_002", name: "Marcus", accent: "British",   style: "Authoritative",   elevenId: "VR6AewLTigWG4xSOukaG", active: false, samples: 2 },
  { id: "v_003", name: "Sofia",  accent: "Neutral",   style: "Warm & engaging", elevenId: "pNInz6obpgDQGcFmaJgB", active: false, samples: 4 },
];

export const PIPELINE_STAGES = {
  queued:     { color: "#4b5563", label: "Queued",     icon: "⏳", order: 0 },
  scripting:  { color: "#8b5cf6", label: "Scripting",  icon: "✍️",  order: 1 },
  voiceover:  { color: "#3b82f6", label: "Voiceover",  icon: "🎙️", order: 2 },
  visuals:    { color: "#f59e0b", label: "Visuals",    icon: "🎨", order: 3 },
  rendering:  { color: "#ec4899", label: "Rendering",  icon: "🎬", order: 4 },
  publishing: { color: "#10b981", label: "Publishing", icon: "🚀", order: 5 },
  done:       { color: "#6b7280", label: "Published",  icon: "✅", order: 6 },
  failed:     { color: "#ef4444", label: "Failed",     icon: "❌", order: -1 },
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
