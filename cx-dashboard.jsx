import { useState, useRef, useEffect, useCallback } from "react";

// ── SIGNAL DEFS ───────────────────────────────────────────────────────────────
const SIGNAL_DEFS = [
  { id:"clarity",        label:"Process Clarity" },
  { id:"accuracy",       label:"Process Accuracy" },
  { id:"system",         label:"System Functionality" },
  { id:"accountability", label:"Accountability & Visibility" },
  { id:"effectiveness",  label:"Overall Effectiveness" },
];
function mkSig(scores) {
  return SIGNAL_DEFS.map((def,i) => ({ ...def, score: scores[i] }));
}

// ── TEAM ──────────────────────────────────────────────────────────────────────
const TEAM_MEMBERS = [
  { id:"t1",  name:"FDE 1",  role:"FDE"     },
  { id:"t2",  name:"FDE 2",  role:"FDE"     },
  { id:"t3",  name:"FDE 3",  role:"FDE"     },
  { id:"t4",  name:"FDE 4",  role:"FDE"     },
  { id:"t5",  name:"FDE 5",  role:"FDE"     },
  { id:"t6",  name:"FDE 6",  role:"FDE"     },
  { id:"t7",  name:"FDE 7",  role:"FDE"     },
  { id:"t8",  name:"Mgr 1",  role:"Manager" },
  { id:"t9",  name:"Mgr 2",  role:"Manager" },
  { id:"t10", name:"CS Pro", role:"CS"      },
];

// ── DOMAINS ───────────────────────────────────────────────────────────────────
// scores: [clarity, accuracy, system, accountability, effectiveness]
const DOMAINS_INIT = [
  {
    id:"dops", label:"Deployed Operations", abbr:"DOPS", color:"#38bdf8",
    desc:"9 FDEs + 1 CS executing onboardings, support requests, and field documentation.",
    functions:[
      { id:"onboardings",  label:"Onboardings",         weight:0.38, desc:"Every purchase includes a customer onboarding.",
        signals: mkSig([52,61,55,44,58]) },
      { id:"cx_requests",  label:"CX Support Requests", weight:0.38, desc:"BD-initiated requests routed to FDEs.",
        signals: mkSig([58,70,62,55,65]) },
      { id:"field_docs",   label:"Field Documentation", weight:0.24, desc:"Trip reports and field logs per engagement.",
        signals: mkSig([40,45,35,30,38]) },
    ],
  },
  {
    id:"voc", label:"Voice of Customer", abbr:"VOC", color:"#fb923c",
    desc:"Most critical, least systemized. Field intelligence feeding product roadmap, QA, and BVA.",
    functions:[
      { id:"voc_loop",      label:"VOC Feedback Loop",    weight:0.40, desc:"Capture and route customer feedback into BVA and product pipeline.",
        signals: mkSig([35,38,28,32,30]) },
      { id:"bug_reporting", label:"Bug Reporting",         weight:0.35, desc:"Field-identified bugs submitted to QA via Jira.",
        signals: mkSig([48,52,55,42,50]) },
      { id:"cust_zero",     label:"Customer Zero Testing", weight:0.25, desc:"Early product testing with select customer partners.",
        signals: mkSig([30,40,38,28,35]) },
    ],
  },
  {
    id:"cs", label:"Customer Support", abbr:"CS", color:"#f472b6",
    desc:"Ticket management, technical resolution, and satisfaction measurement.",
    functions:[
      { id:"ticket_mgmt",     label:"Ticket Management",    weight:0.35, desc:"Routing, SLA tracking, and throughput of inbound tickets.",
        signals: mkSig([65,60,58,60,62]) },
      { id:"tech_resolution", label:"Technical Resolution", weight:0.40, desc:"FDE-backed SME coverage for complex technical issues.",
        signals: mkSig([70,74,60,65,70]) },
      { id:"csat_nps",        label:"CSAT / NPS",           weight:0.25, desc:"Survey generation habit and automated NPS. Critical gap.",
        signals: mkSig([38,42,50,30,38]) },
    ],
  },
  {
    id:"ops", label:"Internal Operations", abbr:"OPS", color:"#34d399",
    desc:"Training content, knowledge base health, and upward reporting to VP.",
    functions:[
      { id:"training",       label:"Training Content",  weight:0.35, desc:"FDE-generated training materials for internal teams and new hires.",
        signals: mkSig([60,68,55,58,63]) },
      { id:"knowledge_base", label:"Knowledge Base",    weight:0.35, desc:"Maintenance of internal knowledge resources — accuracy, coverage, findability.",
        signals: mkSig([55,58,48,50,52]) },
      { id:"reporting",      label:"Upward Reporting",  weight:0.30, desc:"Regular reporting cadence to VP — trends, team performance, customer pulse.",
        signals: mkSig([75,72,70,78,73]) },
    ],
  },
  {
    id:"team", label:"Team Health", abbr:"TEAM", color:"#a78bfa",
    desc:"Team-level health scored per individual across travel load, team satisfaction, and company satisfaction.",
    isTeamDomain: true,
    functions:[
      { id:"travel_load", label:"Travel Load / PTO",    weight:0.35, desc:"Balance between travel requirements and rest/PTO.",
        signals: TEAM_MEMBERS.map(m=>({ id:m.id, label:m.name, role:m.role, score:65 })) },
      { id:"team_sat",    label:"Team Satisfaction",    weight:0.35, desc:"Individual satisfaction with team dynamics and management.",
        signals: TEAM_MEMBERS.map(m=>({ id:m.id, label:m.name, role:m.role, score:72 })) },
      { id:"company_sat", label:"Company Satisfaction", weight:0.30, desc:"Individual satisfaction with company direction and career trajectory.",
        signals: TEAM_MEMBERS.map(m=>({ id:m.id, label:m.name, role:m.role, score:68 })) },
    ],
  },
];

// ── SCORING ───────────────────────────────────────────────────────────────────
function fnScore(fn)    { return fn.signals.reduce((a,s)=>a+s.score,0)/fn.signals.length; }
function domainScore(d) { return d.functions.reduce((a,fn)=>a+fnScore(fn)*fn.weight,0); }
function tier(s)        { return s>=75?"nominal":s>=55?"watch":"critical"; }
function tierColor(s)   { return s>=75?"#4ade80":s>=55?"#facc15":"#f87171"; }
function tierLabel(s)   { return s>=75?"NOMINAL":s>=55?"WATCH":"CRITICAL"; }
function tierBg(s)      { return s>=75?"rgba(74,222,128,0.07)":s>=55?"rgba(250,204,21,0.06)":"rgba(248,113,113,0.09)"; }
function tierBorder(s)  { return s>=75?"rgba(74,222,128,0.22)":s>=55?"rgba(250,204,21,0.2)":"rgba(248,113,113,0.28)"; }
function hexToRgb(hex)  { return [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]; }

// ── ISO RADAR (3D stacked view) ───────────────────────────────────────────────
// Uses canvas to render all 5 domains as stacked planes on an isometric grid
function IsoView({ domains, onClick }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const hoverRef  = useRef(false);
  const progRef   = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Isometric projection helpers
    const ISO_ANGLE = Math.PI / 6; // 30 degrees
    const toIso = (x, y, z) => ({
      sx: (x - y) * Math.cos(ISO_ANGLE),
      sy: (x + y) * Math.sin(ISO_ANGLE) - z,
    });

    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2 + 40;

    // Radar geometry — 3 axes (one per function) on the XY plane
    const RADAR_SCALE = 110;
    const N = 3; // functions per domain

    const radarPt = (fnIdx, score, z) => {
      const a = (fnIdx / N) * Math.PI * 2 - Math.PI / 2;
      const r = (score / 100) * RADAR_SCALE;
      const rx = Math.cos(a) * r;
      const ry = Math.sin(a) * r;
      const iso = toIso(rx, ry, z);
      return { x: cx + iso.sx, y: cy + iso.sy };
    };

    const gridPt = (x, y, z) => {
      const iso = toIso(x, y, z);
      return { x: cx + iso.sx, y: cy + iso.sy };
    };

    const LAYER_Z = 54; // Z spacing between domain planes
    const NUM_DOMAINS = domains.length;

    let startTime = null;
    const ANIM_DURATION = 1800;

    const draw = (ts) => {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      progRef.current = Math.min(1, elapsed / ANIM_DURATION);
      const p = progRef.current;

      // Easing
      const ease = t => t<0.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
      const ep = ease(p);

      ctx.clearRect(0, 0, W, H);

      // ── ISOMETRIC GRID (XY base plane) ────────────────────────
      const GRID_SIZE = 160;
      const GRID_LINES = 6;
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 0.5;
      for (let i = -GRID_LINES; i <= GRID_LINES; i++) {
        const step = GRID_SIZE / GRID_LINES;
        // X-parallel lines
        const a = gridPt(-GRID_SIZE, i * step, 0);
        const b = gridPt( GRID_SIZE, i * step, 0);
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
        // Y-parallel lines
        const c = gridPt(i * step, -GRID_SIZE, 0);
        const d = gridPt(i * step,  GRID_SIZE, 0);
        ctx.beginPath(); ctx.moveTo(c.x,c.y); ctx.lineTo(d.x,d.y); ctx.stroke();
      }
      ctx.restore();

      // ── Z AXIS PILLARS (at radar vertices) ────────────────────
      for (let fnIdx = 0; fnIdx < N; fnIdx++) {
        const a_base = (fnIdx / N) * Math.PI * 2 - Math.PI / 2;
        const rx = Math.cos(a_base) * RADAR_SCALE;
        const ry = Math.sin(a_base) * RADAR_SCALE;
        const topZ = (NUM_DOMAINS - 1) * LAYER_Z + 20;
        const bot = gridPt(rx, ry, 0);
        const top = gridPt(rx, ry, topZ);
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(bot.x,bot.y); ctx.lineTo(top.x,top.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ── DOMAIN PLANES — bottom to top ─────────────────────────
      domains.forEach((domain, di) => {
        const z = di * LAYER_Z * ep;
        const [r,g,b] = hexToRgb(domain.color);
        const ds = domainScore(domain);
        const tc = tierColor(ds);
        const fns = domain.functions;

        // Plane ghost (flat polygon at this Z)
        ctx.save();
        ctx.globalAlpha = 0.04;
        ctx.fillStyle = domain.color;
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const pt = radarPt(i, 100, z);
          i===0 ? ctx.moveTo(pt.x,pt.y) : ctx.lineTo(pt.x,pt.y);
        }
        ctx.closePath(); ctx.fill();
        ctx.restore();

        // Plane border (outer ring)
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = domain.color;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const pt = radarPt(i, 100, z);
          i===0 ? ctx.moveTo(pt.x,pt.y) : ctx.lineTo(pt.x,pt.y);
        }
        ctx.closePath(); ctx.stroke();
        ctx.restore();

        // Data polygon fill
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = tc;
        ctx.beginPath();
        fns.forEach((fn,i) => {
          const pt = radarPt(i, fnScore(fn), z);
          i===0 ? ctx.moveTo(pt.x,pt.y) : ctx.lineTo(pt.x,pt.y);
        });
        ctx.closePath(); ctx.fill();
        ctx.restore();

        // Data polygon stroke
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = tc;
        ctx.lineWidth = tier(ds)==="critical" ? 2.0 : 1.6;
        ctx.lineJoin = "round";
        ctx.shadowColor = tc;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        fns.forEach((fn,i) => {
          const pt = radarPt(i, fnScore(fn), z);
          i===0 ? ctx.moveTo(pt.x,pt.y) : ctx.lineTo(pt.x,pt.y);
        });
        ctx.closePath(); ctx.stroke();
        ctx.restore();

        // Vertex dots
        fns.forEach((fn,i) => {
          const fs = fnScore(fn);
          const vc = tierColor(fs);
          const pt = radarPt(i, fs, z);
          ctx.save();
          ctx.fillStyle = vc; ctx.shadowColor = vc; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.arc(pt.x,pt.y,3,0,Math.PI*2); ctx.fill();
          ctx.restore();
        });

        // Domain label at top of each plane
        if (ep > 0.3) {
          const labelAlpha = Math.max(0, (ep - 0.3) / 0.7);
          const labelPt = radarPt(1, 115, z);
          ctx.save();
          ctx.globalAlpha = labelAlpha * 0.9;
          ctx.fillStyle = domain.color;
          ctx.font = `bold 9px 'SF Mono','Fira Code',monospace`;
          ctx.textAlign = "center";
          ctx.shadowColor = domain.color;
          ctx.shadowBlur = 6;
          ctx.fillText(domain.abbr, labelPt.x, labelPt.y);
          // Score
          ctx.fillStyle = tierColor(ds);
          ctx.font = `bold 11px 'SF Mono','Fira Code',monospace`;
          ctx.fillText(Math.round(ds), labelPt.x, labelPt.y + 13);
          ctx.restore();
        }
      });

      // ── AXIS LABELS at base ────────────────────────────────────
      if (ep > 0.5) {
        const la = Math.max(0, (ep-0.5)/0.5);
        // Use first domain's function labels
        domains[0].functions.forEach((fn, i) => {
          const a  = (i / N) * Math.PI * 2 - Math.PI / 2;
          const lx = cx + toIso(Math.cos(a)*(RADAR_SCALE+28), Math.sin(a)*(RADAR_SCALE+28), 0).sx;
          const ly = cy + toIso(Math.cos(a)*(RADAR_SCALE+28), Math.sin(a)*(RADAR_SCALE+28), 0).sy;
          ctx.save();
          ctx.globalAlpha = la * 0.5;
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.font = `700 7.5px 'SF Mono','Fira Code',monospace`;
          ctx.textAlign = Math.cos(a) > 0.2 ? "left" : Math.cos(a) < -0.2 ? "right" : "center";
          ctx.fillText(fn.label.toUpperCase(), lx, ly);
          ctx.restore();
        });
      }

      // ── CLICK HINT ────────────────────────────────────────────
      if (ep === 1) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 600);
        ctx.save();
        ctx.globalAlpha = 0.3 + 0.3 * pulse;
        ctx.fillStyle = "white";
        ctx.font = `700 8px 'SF Mono','Fira Code',monospace`;
        ctx.textAlign = "center";
        ctx.letterSpacing = "0.18em";
        ctx.fillText("CLICK TO EXPAND", cx, cy + 130);
        ctx.restore();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [domains]);

  return (
    <canvas ref={canvasRef} width={700} height={520}
      onClick={onClick}
      style={{ display:"block", cursor:"pointer", margin:"0 auto" }} />
  );
}

// ── RADAR CHART (domain card view) ───────────────────────────────────────────
function RadarChart({ domain, size, doAnim }) {
  const canvasRef   = useRef(null);
  const animRef     = useRef(null);
  const progressRef = useRef(doAnim ? 0 : 1);
  const ds = domainScore(domain);
  const tc = tierColor(ds);

  useEffect(() => { progressRef.current = doAnim ? 0 : 1; }, [doAnim, domain.id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W=canvas.width, H=canvas.height, cx=W/2, cy=H/2;
    const maxR = Math.min(W,H)*0.27;
    const fns  = domain.functions;
    const N    = fns.length;

    const pt = (i,r) => {
      const a=(i/N)*Math.PI*2-Math.PI/2;
      return [cx+Math.cos(a)*r, cy+Math.sin(a)*r, a];
    };

    const draw = () => {
      if (progressRef.current<1) progressRef.current=Math.min(1,progressRef.current+0.04);
      const p=progressRef.current;
      ctx.clearRect(0,0,W,H);

      [0.33,0.66,1].forEach((pct,ri) => {
        ctx.save();
        ctx.strokeStyle=ri===2?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.04)";
        ctx.lineWidth=ri===2?0.8:0.5;
        ctx.beginPath();
        fns.forEach((_,i)=>{ const [x,y]=pt(i,maxR*pct); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
        ctx.closePath(); ctx.stroke(); ctx.restore();
      });

      fns.forEach((_,i)=>{
        const [x,y]=pt(i,maxR);
        ctx.save(); ctx.strokeStyle="rgba(255,255,255,0.07)"; ctx.lineWidth=0.5;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x,y); ctx.stroke(); ctx.restore();
      });

      ctx.save();
      ctx.globalAlpha=tier(ds)==="critical"?0.20:0.12;
      ctx.fillStyle=tc;
      ctx.beginPath();
      fns.forEach((fn,i)=>{ const [x,y]=pt(i,maxR*(fnScore(fn)/100)*p); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
      ctx.closePath(); ctx.fill(); ctx.restore();

      ctx.save();
      ctx.strokeStyle=tc; ctx.lineWidth=tier(ds)==="critical"?2.2:1.8;
      ctx.lineJoin="round"; ctx.shadowColor=tc; ctx.shadowBlur=tier(ds)==="critical"?14:7; ctx.globalAlpha=0.95;
      ctx.beginPath();
      fns.forEach((fn,i)=>{ const [x,y]=pt(i,maxR*(fnScore(fn)/100)*p); i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
      ctx.closePath(); ctx.stroke(); ctx.restore();

      fns.forEach((fn,i)=>{
        const fs=fnScore(fn), vc=tierColor(fs);
        const [x,y]=pt(i,maxR*(fs/100)*p);
        ctx.save(); ctx.fillStyle=vc; ctx.shadowColor=vc; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fill(); ctx.restore();
      });

      const lblR=maxR+40;
      fns.forEach((fn,i)=>{
        const [,,a]=pt(i,maxR);
        const lx=cx+Math.cos(a)*lblR, ly=cy+Math.sin(a)*lblR;
        const fs=fnScore(fn), vc=tierColor(fs);
        ctx.save();
        ctx.textAlign   =Math.cos(a)>0.15?"left":Math.cos(a)<-0.15?"right":"center";
        ctx.textBaseline=Math.sin(a)>0.15?"top" :Math.sin(a)<-0.15?"bottom":"middle";
        ctx.fillStyle="rgba(255,255,255,0.5)";
        ctx.font=`700 9px 'SF Mono','Fira Code',monospace`;
        ctx.fillText(fn.label.toUpperCase(),lx,ly-7);
        ctx.fillStyle=vc; ctx.shadowColor=vc; ctx.shadowBlur=5;
        ctx.font=`bold 14px 'SF Mono','Fira Code',monospace`;
        ctx.fillText(Math.round(fs),lx,ly+7);
        ctx.restore();
      });

      if (p<1) animRef.current=requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [domain, size, tc, ds]);

  return <canvas ref={canvasRef} width={size} height={size} style={{display:"block"}} />;
}

// ── SIGNAL BAR ────────────────────────────────────────────────────────────────
function SignalBar({ sig, onUpdate }) {
  const tc=tierColor(sig.score);
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
        <span style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.06em",color:"rgba(255,255,255,0.45)",textTransform:"uppercase"}}>{sig.label}</span>
        <span style={{fontFamily:"monospace",fontSize:11,fontWeight:"bold",color:tc}}>{sig.score}</span>
      </div>
      <div style={{position:"relative",height:3,background:"rgba(255,255,255,0.07)",borderRadius:2}}>
        <div style={{height:"100%",width:`${sig.score}%`,background:tc,borderRadius:2,boxShadow:`0 0 6px ${tc}77`,transition:"width 0.2s"}} />
        <input type="range" min={0} max={100} value={sig.score}
          onChange={e=>onUpdate(Number(e.target.value))}
          style={{position:"absolute",top:-10,left:0,width:"100%",opacity:0,cursor:"pointer",height:22,margin:0}} />
      </div>
    </div>
  );
}

// ── TEAM HEALTH PANEL ─────────────────────────────────────────────────────────
function TeamHealthPanel({ domain, selected, onUpdateMember }) {
  const [expandedFn,setExpandedFn]=useState(null);
  return (
    <div style={{padding:"0 20px 16px"}}>
      {domain.functions.map(fn=>{
        const fs=fnScore(fn), fc=tierColor(fs), isSel=expandedFn===fn.id&&selected;
        return (
          <div key={fn.id}
            onClick={e=>{e.stopPropagation();if(selected)setExpandedFn(isSel?null:fn.id);}}
            style={{borderTop:"1px solid rgba(255,255,255,0.05)",padding:"9px 0",cursor:selected?"pointer":"default"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:fc,boxShadow:`0 0 5px ${fc}`}} />
                <span style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.08em",color:isSel?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.45)",textTransform:"uppercase"}}>{fn.label}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontFamily:"monospace",fontSize:12,fontWeight:"bold",color:fc}}>{Math.round(fs)}</span>
                {selected&&<span style={{fontSize:8,color:"rgba(255,255,255,0.18)"}}>{isSel?"▲":"▼"}</span>}
              </div>
            </div>
            {isSel&&(
              <div style={{marginTop:12,paddingLeft:15,animation:"fadeIn 0.15s ease"}}>
                {["Manager","FDE","CS"].map(role=>{
                  const members=fn.signals.filter(s=>s.role===role);
                  if(!members.length)return null;
                  return (
                    <div key={role} style={{marginBottom:12}}>
                      <div style={{fontFamily:"monospace",fontSize:7,letterSpacing:"0.22em",color:"rgba(255,255,255,0.22)",textTransform:"uppercase",marginBottom:7,borderBottom:"1px solid rgba(255,255,255,0.04)",paddingBottom:4}}>{role}</div>
                      {members.map(sig=>{
                        const sc=tierColor(sig.score);
                        return (
                          <div key={sig.id} style={{marginBottom:9}}>
                            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                              <span style={{fontFamily:"monospace",fontSize:9,color:"rgba(255,255,255,0.45)",textTransform:"uppercase",letterSpacing:"0.05em"}}>{sig.label}</span>
                              <span style={{fontFamily:"monospace",fontSize:10,fontWeight:"bold",color:sc}}>{sig.score}</span>
                            </div>
                            <div style={{position:"relative",height:3,background:"rgba(255,255,255,0.06)",borderRadius:2}}>
                              <div style={{height:"100%",width:`${sig.score}%`,background:sc,borderRadius:2,boxShadow:`0 0 5px ${sc}66`,transition:"width 0.2s"}} />
                              <input type="range" min={0} max={100} value={sig.score}
                                onChange={e=>onUpdateMember(domain.id,fn.id,sig.id,Number(e.target.value))}
                                onClick={e=>e.stopPropagation()}
                                style={{position:"absolute",top:-10,left:0,width:"100%",opacity:0,cursor:"pointer",height:22,margin:0}} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── DOMAIN CARD ───────────────────────────────────────────────────────────────
function DomainCard({ domain, selected, onClick, onUpdateSig, compact, slideIn, slideDelay }) {
  const [expandedFn,setExpandedFn]=useState(null);
  const ds=domainScore(domain), tc=tierColor(ds), tl=tierLabel(ds), t=tier(ds);
  const radarSize=compact?120:selected?270:200;
  const [r,g,b]=hexToRgb(domain.color);

  return (
    <div onClick={onClick} style={{
      background:selected?tierBg(ds):"rgba(255,255,255,0.018)",
      border:`1px solid ${selected?tierBorder(ds):"rgba(255,255,255,0.07)"}`,
      borderLeft:`3px solid ${t==="critical"?"#f87171":t==="watch"?"#facc15":`rgba(${r},${g},${b},0.5)`}`,
      borderRadius:4, cursor:"pointer",
      display:"flex", flexDirection:"column", overflow:"hidden",
      boxShadow:t==="critical"&&!compact?"0 0 28px rgba(248,113,113,0.1)":selected?`0 0 24px ${tc}15`:"none",
      animation: slideIn ? `slideIn 0.5s ease ${slideDelay}ms both` : "none",
      transition:"border 0.2s, background 0.2s, box-shadow 0.2s",
    }}>
      <div style={{padding:compact?"10px 14px 8px":"16px 20px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:compact?2:5}}>
              <span style={{fontFamily:"monospace",fontSize:compact?7:8,letterSpacing:"0.38em",color:`rgba(${r},${g},${b},0.7)`,textTransform:"uppercase"}}>{domain.abbr}</span>
              {domain.isTeamDomain&&!compact&&(
                <span style={{fontFamily:"monospace",fontSize:6.5,letterSpacing:"0.14em",color:"rgba(255,255,255,0.2)",textTransform:"uppercase",border:"1px solid rgba(255,255,255,0.1)",padding:"1px 5px",borderRadius:2}}>10 members</span>
              )}
            </div>
            {!compact&&<div style={{fontFamily:"monospace",fontSize:12,fontWeight:"bold",letterSpacing:"0.05em",color:"rgba(255,255,255,0.88)",textTransform:"uppercase",lineHeight:1.3}}>{domain.label}</div>}
            {!compact&&selected&&<div style={{fontFamily:"monospace",fontSize:7.5,color:"rgba(255,255,255,0.28)",marginTop:5,lineHeight:1.5}}>{domain.desc}</div>}
          </div>
          <div style={{textAlign:"right",flexShrink:0,marginLeft:14}}>
            <div style={{fontFamily:"monospace",fontSize:compact?22:40,fontWeight:"bold",color:tc,lineHeight:1,letterSpacing:"-0.04em",textShadow:`0 0 18px ${tc}55`}}>{Math.round(ds)}</div>
            <div style={{fontFamily:"monospace",fontSize:compact?6.5:8,letterSpacing:"0.26em",color:tc,fontWeight:"bold",marginTop:2}}>{tl}</div>
          </div>
        </div>
        {!compact&&<div style={{marginTop:11,height:2.5,background:"rgba(255,255,255,0.06)",borderRadius:2}}>
          <div style={{height:"100%",width:`${ds}%`,background:tc,borderRadius:2,boxShadow:`0 0 8px ${tc}55`,transition:"width 0.4s"}} />
        </div>}
      </div>

      <div style={{display:"flex",justifyContent:"center",alignItems:"center",padding:compact?"2px 0":"6px 0 0"}}>
        <RadarChart domain={domain} size={radarSize} doAnim={!compact} />
      </div>

      {!compact&&!domain.isTeamDomain&&(
        <div style={{padding:"2px 20px 16px"}}>
          {domain.functions.map(fn=>{
            const fs=fnScore(fn),fc=tierColor(fs),ft=tier(fs),isSel=expandedFn===fn.id&&selected;
            return (
              <div key={fn.id}
                onClick={e=>{e.stopPropagation();if(selected)setExpandedFn(isSel?null:fn.id);}}
                style={{borderTop:"1px solid rgba(255,255,255,0.05)",padding:"9px 0",cursor:selected?"pointer":"default"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:ft==="critical"?6:5,height:ft==="critical"?6:5,borderRadius:ft==="critical"?1:"50%",background:fc,boxShadow:`0 0 5px ${fc}`,flexShrink:0}} />
                    <div>
                      <span style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.08em",fontWeight:isSel?"bold":"normal",color:isSel?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.45)",textTransform:"uppercase",transition:"color 0.15s"}}>{fn.label}</span>
                      {isSel&&<div style={{fontFamily:"monospace",fontSize:7,color:"rgba(255,255,255,0.22)",marginTop:2,lineHeight:1.4}}>{fn.desc}</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                    <span style={{fontFamily:"monospace",fontSize:12,fontWeight:"bold",color:fc,textShadow:`0 0 5px ${fc}44`}}>{Math.round(fs)}</span>
                    {selected&&<span style={{fontSize:8,color:"rgba(255,255,255,0.18)"}}>{isSel?"▲":"▼"}</span>}
                  </div>
                </div>
                {isSel&&(
                  <div style={{marginTop:12,paddingLeft:15,animation:"fadeIn 0.15s ease"}}>
                    {fn.signals.map(sig=>(
                      <SignalBar key={sig.id} sig={sig} onUpdate={val=>onUpdateSig(domain.id,fn.id,sig.id,val)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!compact&&domain.isTeamDomain&&(
        <TeamHealthPanel domain={domain} selected={selected}
          onUpdateMember={(domId,fnId,sigId,val)=>onUpdateSig(domId,fnId,sigId,val)} />
      )}

      {compact&&(
        <div style={{padding:"4px 14px 10px",display:"flex",flexDirection:"column",gap:5}}>
          {domain.functions.map(fn=>{
            const fs=fnScore(fn),fc=tierColor(fs);
            return (
              <div key={fn.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:3,height:3,borderRadius:"50%",background:fc,boxShadow:`0 0 3px ${fc}`}} />
                  <span style={{fontFamily:"monospace",fontSize:7,letterSpacing:"0.06em",color:"rgba(255,255,255,0.28)",textTransform:"uppercase"}}>{fn.label}</span>
                </div>
                <span style={{fontFamily:"monospace",fontSize:9,fontWeight:"bold",color:fc}}>{Math.round(fs)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SYSTEM BAR ────────────────────────────────────────────────────────────────
function SystemBar({ domains, selected, onSelect, onReset }) {
  const overall=domains.reduce((a,d)=>a+domainScore(d),0)/domains.length;
  const tc=tierColor(overall);
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 22px",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0,background:"rgba(0,0,0,0.25)"}}>
      <div style={{display:"flex",alignItems:"baseline",gap:12}}>
        <span
          onClick={onReset}
          style={{fontFamily:"monospace",fontSize:8,letterSpacing:"0.44em",color:"rgba(255,255,255,0.2)",textTransform:"uppercase",cursor:"pointer"}}
          title="Return to overview">goTenna</span>
        <span style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.18em",color:"rgba(255,255,255,0.35)",textTransform:"uppercase"}}>CX Health</span>
      </div>
      <div style={{display:"flex",gap:7}}>
        {domains.map(d=>{
          const ds=domainScore(d),dc=tierColor(ds),t=tier(ds),isSel=selected===d.id;
          const [r,g,b]=hexToRgb(d.color);
          return (
            <div key={d.id} onClick={()=>onSelect(isSel?null:d.id)}
              style={{display:"flex",alignItems:"center",gap:7,padding:"4px 11px",borderRadius:3,cursor:"pointer",
                border:`1px solid ${isSel?tierBorder(ds):`rgba(${r},${g},${b},0.18)`}`,
                background:isSel?tierBg(ds):`rgba(${r},${g},${b},0.04)`,transition:"all 0.15s"}}>
              <div style={{width:t==="critical"?6:4,height:t==="critical"?6:4,borderRadius:t==="critical"?1:"50%",background:dc,boxShadow:`0 0 5px ${dc}`}} />
              <span style={{fontFamily:"monospace",fontSize:7.5,letterSpacing:"0.16em",color:`rgba(${r},${g},${b},0.9)`,textTransform:"uppercase"}}>{d.abbr}</span>
              <span style={{fontFamily:"monospace",fontSize:11,fontWeight:"bold",color:dc}}>{Math.round(ds)}</span>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",alignItems:"baseline",gap:10}}>
        <span style={{fontFamily:"monospace",fontSize:7.5,letterSpacing:"0.16em",color:"rgba(255,255,255,0.22)",textTransform:"uppercase"}}>CX System</span>
        <span style={{fontFamily:"monospace",fontSize:34,fontWeight:"bold",color:tc,lineHeight:1,letterSpacing:"-0.04em",textShadow:`0 0 22px ${tc}55`}}>{Math.round(overall)}</span>
        <span style={{fontFamily:"monospace",fontSize:8,letterSpacing:"0.26em",color:tc,fontWeight:"bold"}}>{tierLabel(overall)}</span>
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
// view: "iso" | "grid" | "expanded"
export default function App() {
  const [domains,  setDomains]  = useState(DOMAINS_INIT);
  const [view,     setView]     = useState("iso");   // iso → grid → expanded
  const [selected, setSelected] = useState(null);
  const [slideIn,  setSlideIn]  = useState(false);

  const handleIsoClick = () => {
    setSlideIn(true);
    setView("grid");
  };

  const handleSelect = (id) => {
    if (id === null) { setSelected(null); setView("grid"); return; }
    setSelected(id);
    setView("expanded");
  };

  const handleReset = () => {
    setSelected(null);
    setSlideIn(false);
    setView("iso");
  };

  const updateSig = (domId,fnId,sigId,val) =>
    setDomains(prev=>prev.map(d=>d.id!==domId?d:{
      ...d,functions:d.functions.map(fn=>fn.id!==fnId?fn:{
        ...fn,signals:fn.signals.map(s=>s.id!==sigId?s:{...s,score:val})
      })
    }));

  const selDomain    = domains.find(d=>d.id===selected);
  const otherDomains = domains.filter(d=>d.id!==selected);

  return (
    <div style={{minHeight:"100vh",background:"#020408",color:"white",display:"flex",flexDirection:"column"}}>

      <SystemBar domains={domains} selected={selected} onSelect={handleSelect} onReset={handleReset} />

      <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column"}}>

        {/* ── ISO VIEW ─────────────────────────────────────────── */}
        {view==="iso"&&(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px"}}>
            {/* Header */}
            <div style={{marginBottom:16,textAlign:"center"}}>
              <div style={{fontFamily:"monospace",fontSize:8,letterSpacing:"0.4em",color:"rgba(255,255,255,0.2)",textTransform:"uppercase",marginBottom:6}}>
                System Overview — All Domains
              </div>
              <div style={{display:"flex",justifyContent:"center",gap:16,flexWrap:"wrap"}}>
                {domains.map(d=>{
                  const ds=domainScore(d),dc=tierColor(ds);
                  const [r,g,b]=hexToRgb(d.color);
                  return (
                    <div key={d.id} style={{display:"flex",alignItems:"center",gap:5}}>
                      <div style={{width:8,height:2,background:d.color,borderRadius:1}} />
                      <span style={{fontFamily:"monospace",fontSize:7,letterSpacing:"0.14em",color:`rgba(${r},${g},${b},0.7)`,textTransform:"uppercase"}}>{d.abbr}</span>
                      <span style={{fontFamily:"monospace",fontSize:8,fontWeight:"bold",color:dc}}>{Math.round(ds)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <IsoView domains={domains} onClick={handleIsoClick} />
          </div>
        )}

        {/* ── GRID VIEW ────────────────────────────────────────── */}
        {view==="grid"&&(
          <div style={{padding:"16px 20px"}}>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
                {domains.slice(0,3).map((d,i)=>(
                  <DomainCard key={d.id} domain={d} selected={false} compact={false}
                    onClick={()=>handleSelect(d.id)} onUpdateSig={updateSig}
                    slideIn={slideIn} slideDelay={i*80} />
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,maxWidth:"66.8%",margin:"0 auto",width:"100%"}}>
                {domains.slice(3).map((d,i)=>(
                  <DomainCard key={d.id} domain={d} selected={false} compact={false}
                    onClick={()=>handleSelect(d.id)} onUpdateSig={updateSig}
                    slideIn={slideIn} slideDelay={(i+3)*80} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── EXPANDED VIEW ─────────────────────────────────────── */}
        {view==="expanded"&&selDomain&&(
          <div style={{padding:"16px 20px"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 230px",gap:14,minHeight:500}}>
              <DomainCard domain={selDomain} selected={true} compact={false}
                onClick={()=>handleSelect(null)} onUpdateSig={updateSig}
                slideIn={false} slideDelay={0} />
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {otherDomains.map(d=>(
                  <DomainCard key={d.id} domain={d} selected={false} compact={true}
                    onClick={()=>handleSelect(d.id)} onUpdateSig={updateSig}
                    slideIn={false} slideDelay={0} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{padding:"7px 22px",borderTop:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <span style={{fontFamily:"monospace",fontSize:7.5,letterSpacing:"0.1em",color:"rgba(255,255,255,0.14)",textTransform:"uppercase"}}>
          {view==="iso"?"Click to expand domains":view==="grid"?"Click domain to drill down · Click goTenna to return to overview":"Click header to return · Click function to drill into signals"}
        </span>
        <div style={{display:"flex",gap:16}}>
          {[["#4ade80","≥75 Nominal"],["#facc15","≥55 Watch"],["#f87171","<55 Critical"]].map(([c,l])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:c}} />
              <span style={{fontFamily:"monospace",fontSize:7.5,letterSpacing:"0.1em",color:"rgba(255,255,255,0.28)",textTransform:"uppercase"}}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity:0; transform: translateY(24px); }
          to   { opacity:1; transform: translateY(0); }
        }
        @keyframes fadeIn{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}
        input[type=range]{-webkit-appearance:none;appearance:none;background:transparent}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;border-radius:50%;background:white;cursor:pointer}
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.07);border-radius:2px}
        *{box-sizing:border-box}
      `}</style>
    </div>
  );
}
