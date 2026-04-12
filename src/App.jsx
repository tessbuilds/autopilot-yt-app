import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import CreateVideo from "./pages/CreateVideo";
import Queue from "./pages/Queue";
import Voices from "./pages/Voices";
import Channels from "./pages/Channels";
import Analytics from "./pages/Analytics";
import Topics from "./pages/Topics";
import Sidebar from "./components/Sidebar";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div style={{ minHeight: "100vh", background: "#060612", color: "#e0e0ff", fontFamily: "'DM Sans', sans-serif", display: "flex" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,600;0,700;1,400&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
        @keyframes spin { to{transform:rotate(360deg);} }
        @keyframes shimmer { 0%{background-position:-200% 0;} 100%{background-position:200% 0;} }
        @keyframes progressGlow { 0%,100%{box-shadow:0 0 6px currentColor;} 50%{box-shadow:0 0 14px currentColor;} }
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:#0a0a18;}
        ::-webkit-scrollbar-thumb{background:#2a2a50;border-radius:4px;}
        textarea,input,select{outline:none;} button{font-family:'DM Sans',sans-serif;}
        .fade-in{animation:fadeIn 0.3s ease;}
      `}</style>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main style={{ flex: 1, padding: "28px 32px", marginLeft: 230, overflowY: "auto", minHeight: "100vh" }}>
        {activeTab === "dashboard"  && <Dashboard setActiveTab={setActiveTab} />}
        {activeTab === "create"     && <CreateVideo />}
        {activeTab === "queue"      && <Queue />}
        {activeTab === "voices"     && <Voices />}
        {activeTab === "channels"   && <Channels setActiveTab={setActiveTab} />}
        {activeTab === "analytics"  && <Analytics />}
        {activeTab === "topics"     && <Topics />}
      </main>
    </div>
  );
}
