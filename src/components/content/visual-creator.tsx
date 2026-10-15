"use client";

import { useRef, useState } from "react";

import type { VisualSpecification } from "@/features/content-studio/content-types";

const ACCENTS = {
  amber: { bright: "#fbbf24", soft: "#451a03" },
  blue: { bright: "#60a5fa", soft: "#172554" },
  cyan: { bright: "#22d3ee", soft: "#083344" },
  violet: { bright: "#a78bfa", soft: "#2e1065" },
} as const;

function splitLines(value: string, maxCharacters: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1) ?? "";
    if (!current || current.length + word.length + 1 > maxCharacters) {
      if (lines.length === maxLines) break;
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }
  if (words.length > 0 && lines.length === maxLines && lines.join(" ").length < value.trim().length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.…]+$/, "")}…`;
  }
  return lines;
}

function Diagram({ spec }: { spec: VisualSpecification }) {
  const accent = ACCENTS[spec.accent];
  switch (spec.templateId) {
    case "cloud-architecture":
      return (
        <g>
          <rect x="76" y="322" width="210" height="112" rx="22" fill="#111d35" stroke={accent.bright} strokeWidth="3" />
          <text x="181" y="387" textAnchor="middle" className="visual-node-text">{spec.leftLabel || "Client"}</text>
          <path d="M286 378H430" stroke={accent.bright} strokeWidth="4" markerEnd="url(#arrow)" />
          <rect x="442" y="292" width="250" height="172" rx="28" fill={accent.soft} stroke={accent.bright} strokeWidth="3" />
          <text x="567" y="367" textAnchor="middle" className="visual-node-text">Cloud service</text>
          <text x="567" y="400" textAnchor="middle" className="visual-small-text">controlled boundary</text>
          <path d="M692 378H836" stroke={accent.bright} strokeWidth="4" markerEnd="url(#arrow)" />
          <rect x="848" y="322" width="210" height="112" rx="22" fill="#111d35" stroke={accent.bright} strokeWidth="3" />
          <text x="953" y="387" textAnchor="middle" className="visual-node-text">{spec.rightLabel || "Data"}</text>
        </g>
      );
    case "network-troubleshooting":
      return (
        <g>
          <circle cx="190" cy="378" r="82" fill="#111d35" stroke="#34d399" strokeWidth="5" />
          <text x="190" y="367" textAnchor="middle" className="visual-node-text">IP path</text>
          <text x="190" y="403" textAnchor="middle" fill="#6ee7b7" className="visual-small-text">reachable ✓</text>
          <path d="M278 378H500" stroke="#34d399" strokeWidth="5" />
          <circle cx="600" cy="378" r="82" fill="#111d35" stroke={accent.bright} strokeWidth="5" />
          <text x="600" y="367" textAnchor="middle" className="visual-node-text">Service</text>
          <text x="600" y="403" textAnchor="middle" className="visual-small-text">same endpoint</text>
          <path d="M700 378H922" stroke="#fb7185" strokeWidth="5" strokeDasharray="18 14" />
          <circle cx="1010" cy="378" r="82" fill="#111d35" stroke="#fb7185" strokeWidth="5" />
          <text x="1010" y="367" textAnchor="middle" className="visual-node-text">DNS name</text>
          <text x="1010" y="403" textAnchor="middle" fill="#fda4af" className="visual-small-text">fails ✕</text>
        </g>
      );
    case "technical-comparison":
      return (
        <g>
          <rect x="82" y="288" width="464" height="220" rx="28" fill="#111d35" stroke={accent.bright} strokeWidth="3" />
          <rect x="654" y="288" width="464" height="220" rx="28" fill={accent.soft} stroke={accent.bright} strokeWidth="3" />
          <text x="314" y="365" textAnchor="middle" className="visual-node-text">{spec.leftLabel || "Option A"}</text>
          <text x="886" y="365" textAnchor="middle" className="visual-node-text">{spec.rightLabel || "Option B"}</text>
          <text x="314" y="420" textAnchor="middle" className="visual-small-text">Evaluate with shared criteria</text>
          <text x="886" y="420" textAnchor="middle" className="visual-small-text">Match the workload</text>
          <circle cx="600" cy="398" r="42" fill="#081225" stroke={accent.bright} strokeWidth="3" />
          <text x="600" y="410" textAnchor="middle" className="visual-node-text">vs</text>
        </g>
      );
    case "question-answer":
      return (
        <g>
          <circle cx="310" cy="390" r="112" fill={accent.soft} stroke={accent.bright} strokeWidth="4" />
          <text x="310" y="425" textAnchor="middle" fill={accent.bright} fontSize="112" fontWeight="800">?</text>
          <path d="M442 390H682" stroke={accent.bright} strokeWidth="4" strokeDasharray="14 12" markerEnd="url(#arrow)" />
          <rect x="710" y="300" width="370" height="180" rx="32" fill="#111d35" stroke={accent.bright} strokeWidth="3" />
          <text x="895" y="380" textAnchor="middle" className="visual-node-text">{spec.rightLabel || "Your diagnosis"}</text>
          <text x="895" y="420" textAnchor="middle" className="visual-small-text">Show the evidence</text>
        </g>
      );
    case "visual-analogy":
      return (
        <g>
          <rect x="112" y="300" width="390" height="205" rx="26" fill="#111d35" stroke={accent.bright} strokeWidth="3" />
          <path d="M172 450V352L307 292L442 352V450" fill={accent.soft} stroke={accent.bright} strokeWidth="4" />
          <rect x="282" y="383" width="50" height="67" fill="#081225" />
          <text x="307" y="548" textAnchor="middle" className="visual-small-text">{spec.leftLabel || "Familiar system"}</text>
          <path d="M522 396H676" stroke={accent.bright} strokeWidth="4" markerEnd="url(#arrow)" />
          <rect x="700" y="300" width="390" height="205" rx="26" fill={accent.soft} stroke={accent.bright} strokeWidth="3" />
          <circle cx="895" cy="384" r="55" fill="#081225" stroke={accent.bright} strokeWidth="3" />
          <path d="M840 454H950" stroke={accent.bright} strokeWidth="8" />
          <text x="895" y="548" textAnchor="middle" className="visual-small-text">{spec.rightLabel || "Technical mechanism"}</text>
        </g>
      );
    default:
      return (
        <g>
          <rect x="120" y="292" width="960" height="212" rx="32" fill={accent.soft} stroke={accent.bright} strokeWidth="3" />
          <text x="184" y="374" fill={accent.bright} fontSize="32" fontWeight="800">TECHNICAL FACT</text>
          {splitLines(spec.caption || "One accurate mechanism, clearly explained.", 48, 2).map((line, index) => (
            <text key={line} x="184" y={430 + index * 42} className="visual-node-text">{line}</text>
          ))}
        </g>
      );
  }
}

function VisualSvg({ spec }: { spec: VisualSpecification }) {
  const accent = ACCENTS[spec.accent];
  const titleLines = splitLines(spec.title || "Untitled visual", 34, 2);
  const subtitleLines = splitLines(spec.subtitle, 62, 2);
  const canvasHeight = spec.aspect === "square" ? 1200 : 675;
  const offsetY = spec.aspect === "square" ? 262.5 : 0;
  return (
    <svg viewBox={`0 0 1200 ${canvasHeight}`} role="img" aria-label={`Preview: ${spec.title || "untitled educational visual"}`}>
      <defs>
        <linearGradient id="visual-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#081225" />
          <stop offset="1" stopColor="#0f1f3d" />
        </linearGradient>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L0,6 L9,3 z" fill={accent.bright} />
        </marker>
      </defs>
      <rect width="1200" height={canvasHeight} fill="url(#visual-bg)" />
      <g transform={`translate(0 ${offsetY})`}>
        <circle cx="1120" cy="70" r="180" fill={accent.soft} opacity="0.55" />
        <rect x="64" y="54" width="9" height="72" rx="5" fill={accent.bright} />
        {titleLines.map((line, index) => (
          <text key={line} x="96" y={89 + index * 49} className="visual-title">{line}</text>
        ))}
        {subtitleLines.map((line, index) => (
          <text key={line} x="96" y={198 + index * 31} className="visual-subtitle">{line}</text>
        ))}
        <Diagram spec={spec} />
        <line x1="64" y1="606" x2="1136" y2="606" stroke="#294267" />
        <text x="68" y="643" className="visual-footer">{spec.footer}</text>
        <text x="1132" y="643" textAnchor="end" fill={accent.bright} className="visual-footer">cloud engineering</text>
      </g>
    </svg>
  );
}

function wrapCanvasText(context: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1) ?? "";
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width > maxWidth && current) {
      if (lines.length === maxLines) break;
      lines.push(word);
    } else if (lines.length === 0) {
      lines.push(next);
    } else {
      lines[lines.length - 1] = next;
    }
  }
  if (lines.length === maxLines && context.measureText(value).width > maxWidth * maxLines) lines[maxLines - 1] += "…";
  return lines;
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
  context.stroke();
}

function drawArrow(context: CanvasRenderingContext2D, fromX: number, toX: number, y: number, color: string) {
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 4;
  context.beginPath(); context.moveTo(fromX, y); context.lineTo(toX, y); context.stroke();
  context.beginPath(); context.moveTo(toX, y); context.lineTo(toX - 13, y - 8); context.lineTo(toX - 13, y + 8); context.closePath(); context.fill();
  context.restore();
}

function drawCanvasVisual(context: CanvasRenderingContext2D, spec: VisualSpecification, width: number, height: number) {
  const scale = width / 1200;
  const offsetY = (height - 675 * scale) / 2;
  const fullGradient = context.createLinearGradient(0, 0, width, height);
  fullGradient.addColorStop(0, "#081225");
  fullGradient.addColorStop(1, "#0f1f3d");
  context.fillStyle = fullGradient;
  context.fillRect(0, 0, width, height);
  context.save();
  context.translate(0, offsetY);
  context.scale(scale, scale);
  const accent = ACCENTS[spec.accent];
  const gradient = context.createLinearGradient(0, 0, 1200, 675);
  gradient.addColorStop(0, "#081225");
  gradient.addColorStop(1, "#0f1f3d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1200, 675);
  context.fillStyle = accent.soft;
  context.globalAlpha = 0.55;
  context.beginPath(); context.arc(1120, 70, 180, 0, Math.PI * 2); context.fill();
  context.globalAlpha = 1;
  context.fillStyle = accent.bright;
  context.fillRect(64, 54, 9, 72);
  context.fillStyle = "#f8fafc";
  context.font = "800 42px system-ui, sans-serif";
  wrapCanvasText(context, spec.title || "Untitled visual", 860, 2).forEach((line, index) => context.fillText(line, 96, 89 + index * 49));
  context.fillStyle = "#b8c7df";
  context.font = "500 23px system-ui, sans-serif";
  wrapCanvasText(context, spec.subtitle, 850, 2).forEach((line, index) => context.fillText(line, 96, 198 + index * 31));

  context.strokeStyle = accent.bright;
  context.lineWidth = 3;
  context.fillStyle = "#111d35";
  if (spec.templateId === "technical-comparison") {
    roundedRect(context, 82, 288, 464, 220, 28);
    context.fillStyle = accent.soft; roundedRect(context, 654, 288, 464, 220, 28);
    context.fillStyle = "#f8fafc"; context.font = "700 30px system-ui, sans-serif"; context.textAlign = "center";
    context.fillText(spec.leftLabel || "Option A", 314, 375); context.fillText(spec.rightLabel || "Option B", 886, 375);
  } else if (spec.templateId === "network-troubleshooting") {
    context.strokeStyle = "#34d399"; context.lineWidth = 5; context.beginPath(); context.moveTo(272, 378); context.lineTo(518, 378); context.stroke();
    context.strokeStyle = "#fb7185"; context.setLineDash([18, 14]); context.beginPath(); context.moveTo(682, 378); context.lineTo(928, 378); context.stroke(); context.setLineDash([]);
    context.font = "700 28px system-ui, sans-serif"; context.textAlign = "center";
    [[190, "IP path", "#34d399"], [600, "Service", accent.bright], [1010, "DNS name", "#fb7185"]].forEach(([x, label, color]) => {
      context.fillStyle = "#111d35"; context.strokeStyle = String(color); context.beginPath(); context.arc(Number(x), 378, 82, 0, Math.PI * 2); context.fill(); context.stroke();
      context.fillStyle = "#f8fafc"; context.fillText(String(label), Number(x), 388);
    });
  } else if (spec.templateId === "question-answer") {
    context.fillStyle = accent.soft; context.beginPath(); context.arc(310, 390, 112, 0, Math.PI * 2); context.fill(); context.stroke();
    context.fillStyle = accent.bright; context.font = "800 112px system-ui, sans-serif"; context.textAlign = "center"; context.fillText("?", 310, 425);
    context.fillStyle = "#111d35"; roundedRect(context, 710, 300, 370, 180, 32);
    context.fillStyle = "#f8fafc"; context.font = "700 28px system-ui, sans-serif"; context.fillText(spec.rightLabel || "Your diagnosis", 895, 398);
  } else if (spec.templateId === "visual-analogy") {
    context.fillStyle = "#111d35"; roundedRect(context, 112, 300, 390, 205, 26);
    context.fillStyle = accent.soft; roundedRect(context, 700, 300, 390, 205, 26);
    context.fillStyle = "#f8fafc"; context.font = "700 28px system-ui, sans-serif"; context.textAlign = "center";
    context.fillText(spec.leftLabel || "Familiar system", 307, 410); context.fillText(spec.rightLabel || "Technical mechanism", 895, 410);
  } else if (spec.templateId === "cloud-architecture") {
    drawArrow(context, 286, 430, 378, accent.bright);
    drawArrow(context, 692, 836, 378, accent.bright);
    context.font = "700 25px system-ui, sans-serif"; context.textAlign = "center";
    [[76, 322, 210, 112, spec.leftLabel || "Client"], [442, 292, 250, 172, "Cloud service"], [848, 322, 210, 112, spec.rightLabel || "Data"]].forEach(([x, y, w, h, label]) => {
      context.fillStyle = "#111d35"; roundedRect(context, Number(x), Number(y), Number(w), Number(h), 22);
      context.fillStyle = "#f8fafc"; context.fillText(String(label), Number(x) + Number(w) / 2, Number(y) + Number(h) / 2 + 9);
    });
  } else {
    context.fillStyle = accent.soft; roundedRect(context, 120, 292, 960, 212, 32);
    context.fillStyle = accent.bright; context.font = "800 32px system-ui, sans-serif"; context.textAlign = "left"; context.fillText("TECHNICAL FACT", 184, 374);
    context.fillStyle = "#f8fafc"; context.font = "700 28px system-ui, sans-serif";
    wrapCanvasText(context, spec.caption || "One accurate mechanism, clearly explained.", 820, 2).forEach((line, index) => context.fillText(line, 184, 430 + index * 42));
  }
  context.textAlign = "left";
  context.strokeStyle = "#294267"; context.lineWidth = 1; context.beginPath(); context.moveTo(64, 606); context.lineTo(1136, 606); context.stroke();
  context.fillStyle = "#b8c7df"; context.font = "500 18px system-ui, sans-serif"; context.fillText(spec.footer, 68, 643);
  context.fillStyle = accent.bright; context.textAlign = "right"; context.fillText("cloud engineering", 1132, 643);
  context.restore();
}

export function VisualCreator({ spec, onChange }: { spec: VisualSpecification; onChange: (spec: VisualSpecification) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloadStatus, setDownloadStatus] = useState<string>("");

  function set<K extends keyof VisualSpecification>(key: K, value: VisualSpecification[K]) {
    onChange({ ...spec, [key]: value });
  }

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dimensions = spec.aspect === "square" ? { height: 1080, width: 1080 } : { height: 900, width: 1600 };
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) {
      setDownloadStatus("This browser could not create a canvas image.");
      return;
    }
    drawCanvasVisual(context, spec, dimensions.width, dimensions.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setDownloadStatus("The PNG export could not be created.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cloud-visual"}-${spec.aspect}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setDownloadStatus(`PNG exported at ${dimensions.width} × ${dimensions.height}.`);
    }, "image/png");
  }

  return (
    <section className="studio-panel visual-creator" aria-labelledby="visual-creator-heading">
      <div className="studio-panel-heading">
        <div>
          <p className="eyebrow">Deterministic visual</p>
          <h2 id="visual-creator-heading">Visual Content Creator</h2>
        </div>
        <span className="status-chip status-safe">No API cost</span>
      </div>
      <div className="visual-controls">
        <label>Template
          <select value={spec.templateId} onChange={(event) => set("templateId", event.target.value as VisualSpecification["templateId"])}>
            <option value="cloud-architecture">Cloud architecture diagram</option>
            <option value="network-troubleshooting">Network troubleshooting challenge</option>
            <option value="educational-fact">Educational fact card</option>
            <option value="technical-comparison">Technical comparison</option>
            <option value="question-answer">Question-and-answer challenge</option>
            <option value="visual-analogy">Visual analogy</option>
          </select>
        </label>
        <label>Format
          <select value={spec.aspect} onChange={(event) => set("aspect", event.target.value as VisualSpecification["aspect"])}>
            <option value="square">Square · 1080 × 1080</option>
            <option value="landscape">Landscape · 1600 × 900</option>
          </select>
        </label>
        <label>Accent
          <select value={spec.accent} onChange={(event) => set("accent", event.target.value as VisualSpecification["accent"])}>
            <option value="blue">Blue</option><option value="cyan">Cyan</option><option value="violet">Violet</option><option value="amber">Amber</option>
          </select>
        </label>
        <label className="visual-wide-field">Visual title
          <input maxLength={180} value={spec.title} onChange={(event) => set("title", event.target.value)} />
        </label>
        <label className="visual-wide-field">Subtitle
          <textarea rows={2} maxLength={280} value={spec.subtitle} onChange={(event) => set("subtitle", event.target.value)} />
        </label>
        <label>Left label
          <input maxLength={80} value={spec.leftLabel} onChange={(event) => set("leftLabel", event.target.value)} />
        </label>
        <label>Right label
          <input maxLength={80} value={spec.rightLabel} onChange={(event) => set("rightLabel", event.target.value)} />
        </label>
        <label className="visual-wide-field">Card copy
          <input maxLength={240} value={spec.caption} onChange={(event) => set("caption", event.target.value)} />
        </label>
      </div>
      <div className={`visual-preview visual-preview-${spec.aspect}`}><VisualSvg spec={spec} /></div>
      <canvas ref={canvasRef} hidden aria-hidden="true" />
      <div className="studio-actions">
        <button className="primary-action" type="button" onClick={downloadPng}>Download PNG</button>
        <p className="field-note" aria-live="polite">{downloadStatus || "Only the compact visual specification is saved; PNG bytes are generated in this browser and are not uploaded."}</p>
      </div>
    </section>
  );
}
