// ── Shared UI primitives ──────────────────────────────────────────

export function PulsingDot({ color = "#10b981" }) {
  return <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:color, boxShadow:`0 0 6px ${color}`, animation:"pulse 2s infinite", flexShrink:0 }} />;
}

export function ProgressBar({ value, color = "#7c3aed", height = 6 }) {
  return (
    <div style={{ background:"#10102a", borderRadius:4, height, overflow:"hidden", width:"100%" }}>
      <div style={{ width:`${Math.min(value,100)}%`, background:color, height:"100%", borderRadius:4, transition:"width 0.8s ease", boxShadow:`0 0 8px ${color}88` }} />
    </div>
  );
}

export function Badge({ label, color = "#7c3aed", icon }) {
  return (
    <div style={{ background:`${color}1a`, border:`1px solid ${color}44`, borderRadius:20, padding:"3px 10px", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}>
      {icon && <span style={{ fontSize:12 }}>{icon}</span>}
      <span style={{ color, fontSize:11, fontWeight:700 }}>{label}</span>
    </div>
  );
}

export function Card({ children, style = {}, glow = false }) {
  return (
    <div style={{
      background:"linear-gradient(135deg, #0c0c22 0%, #09091a 100%)",
      border:`1px solid ${glow ? "#2d1b6e" : "#12122a"}`,
      borderRadius:16, padding:24,
      boxShadow: glow ? "0 0 20px #7c3aed18" : "none",
      ...style
    }}>{children}</div>
  );
}

export function SectionLabel({ children }) {
  return <div style={{ fontSize:11, color:"#3d3d60", textTransform:"uppercase", letterSpacing:2, marginBottom:12 }}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{ marginBottom:28, display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
      <div>
        <h1 style={{ fontFamily:"'Space Mono',monospace", fontSize:22, fontWeight:700, color:"#e0e0ff", letterSpacing:-1 }}>{title}</h1>
        {subtitle && <div style={{ color:"#3d3d60", fontSize:13, marginTop:4 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display:"flex", gap:10 }}>{actions}</div>}
    </div>
  );
}

export function Button({ children, onClick, variant="primary", disabled=false, small=false, style={} }) {
  const base = {
    border:"none", borderRadius:10, cursor:disabled?"not-allowed":"pointer",
    fontSize: small ? 12 : 13, fontWeight:700, display:"flex", alignItems:"center",
    gap:6, padding: small ? "7px 14px" : "11px 20px", transition:"opacity 0.15s",
    opacity: disabled ? 0.5 : 1, whiteSpace:"nowrap", ...style,
  };
  const variants = {
    primary:   { background:"linear-gradient(135deg,#7c3aed,#4f46e5)", color:"#fff" },
    secondary: { background:"#0e0e28", border:"1px solid #1e1e3f", color:"#c4c4e0" },
    success:   { background:"linear-gradient(135deg,#0d9488,#0891b2)", color:"#fff" },
    warning:   { background:"linear-gradient(135deg,#d97706,#b45309)", color:"#fff" },
    danger:    { background:"linear-gradient(135deg,#dc2626,#b91c1c)", color:"#fff" },
    ghost:     { background:"transparent", color:"#6b7280" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

export function Spinner({ size = 16 }) {
  return <span style={{ display:"inline-block", width:size, height:size, border:"2px solid #2d1b6e", borderTopColor:"#a78bfa", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />;
}

export function StatCard({ label, value, delta, icon, deltaColor="#10b981" }) {
  return (
    <div style={{
      background:"linear-gradient(135deg,#0c0c22,#09091a)", border:"1px solid #12122a",
      borderRadius:16, padding:22, display:"flex", flexDirection:"column", gap:8,
      position:"relative", overflow:"hidden",
    }}>
      <div style={{ position:"absolute", top:-16, right:-8, fontSize:60, opacity:0.05 }}>{icon}</div>
      <div style={{ fontSize:28, fontFamily:"'Space Mono',monospace", color:"#e0e0ff", fontWeight:700, letterSpacing:-1 }}>{value}</div>
      <div style={{ fontSize:11, color:"#3d3d60", textTransform:"uppercase", letterSpacing:2 }}>{label}</div>
      {delta && <div style={{ fontSize:12, color:deltaColor, fontFamily:"'Space Mono',monospace" }}>{delta}</div>}
    </div>
  );
}

export function Select({ value, onChange, options, style={} }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      background:"#0a0a1c", border:"1px solid #1e1e3f", borderRadius:10,
      color:"#c4c4e0", padding:"10px 14px", fontSize:13, fontFamily:"'DM Sans',sans-serif",
      cursor:"pointer", ...style
    }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Input({ value, onChange, placeholder, onKeyDown, style={} }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} onKeyDown={onKeyDown}
      style={{
        background:"#0a0a1c", border:"1px solid #1e1e3f", borderRadius:10,
        color:"#e0e0ff", padding:"11px 15px", fontSize:14, fontFamily:"'DM Sans',sans-serif",
        width:"100%", ...style,
      }}
    />
  );
}
