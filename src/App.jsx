import { useState, useRef, useEffect, useCallback } from "react";

const DEEZER_PROXY = "/deezer-api";

const GENRE_CHIPS = [
  { label: "Pop", query: "pop" },
  { label: "Rock", query: "rock" },
  { label: "Hip-Hop", query: "hip hop" },
  { label: "R&B", query: "r&b soul" },
  { label: "Jazz", query: "jazz" },
  { label: "Electronic", query: "electronic" },
  { label: "Classical", query: "classical" },
  { label: "Reggae", query: "reggae" },
  { label: "Latin", query: "latin" },
  { label: "Afrobeats", query: "afrobeats" },
  { label: "K-Pop", query: "kpop" },
  { label: "Folk", query: "folk" },
  { label: "Metal", query: "metal" },
  { label: "Blues", query: "blues" },
];

const TRANSITION_STYLES = [
  { id: "fade", label: "Fade", emoji: "🌊", description: "Smooth volume crossfade" },
  { id: "echo", label: "Echo Out", emoji: "🔁", description: "Current era echoes away" },
  { id: "vinyl", label: "Vinyl Scratch", emoji: "💿", description: "Pitch drops then cuts" },
  { id: "drop", label: "Beat Drop", emoji: "⚡", description: "Silence then slam in" },
];

// ── URL encode/decode ─────────────────────────────────────────────────────────
function encodeCapsule(slots) {
  const data = slots.map((s) => ({
    t: s.selected.title, a: s.selected.artist,
    c: s.selected.cover, p: s.selected.preview, y: s.selected.year || "",
  }));
  return btoa(encodeURIComponent(JSON.stringify(data)));
}

function decodeCapsule(hash) {
  try {
    const data = JSON.parse(decodeURIComponent(atob(hash)));
    return data.map((d, i) => ({
      index: i,
      selected: { title: d.t, artist: d.a, cover: d.c, preview: d.p, year: d.y },
    }));
  } catch { return null; }
}

function getSharedCapsule() {
  const hash = window.location.hash.replace("#capsule=", "");
  if (hash && hash.length > 10) return decodeCapsule(hash);
  return null;
}

function buildDeezerUrl(year, query) {
  const q = year && query ? `${query} year:${year}` : year ? `year:${year}` : query;
  return `https://api.deezer.com/search?q=${encodeURIComponent(q)}&order=RANKING`;
}

async function fetchSongsForYear(year, query) {
  const q = year && query ? `${query} year:${year}` : year ? `year:${year}` : query;
  // This points to your vercel.json rewrite
  const proxyUrl = `${DEEZER_PROXY}/search?q=${encodeURIComponent(q)}&order=RANKING`;
  
  const res = await fetch(proxyUrl);
  const data = await res.json();
  if (!data.data || data.data.length === 0) return [];
  return data.data.slice(0, 6).map((song) => ({
    id: song.id, title: song.title, artist: song.artist.name,
    album: song.album.title, cover: song.album.cover_medium,
    preview: song.preview, year,
  }));
}

// ── Slider ────────────────────────────────────────────────────────────────────
function Slider({ label, value, min, max, onChange, color, unit }) {
  const pct = ((value - min) / (max - min)) * 100;
  const displayValue = unit === "x" ? `${value.toFixed(2)}x` : unit === "s" ? `${value}s` : `${Math.round(value * 100)}%`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ color: "#555", fontFamily: "'Bricolage Grotesque', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
        <div style={{ color, fontFamily: "'Bricolage Grotesque', monospace", fontSize: 12, fontWeight: 700 }}>{displayValue}</div>
      </div>
      <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", width: "100%", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)" }} />
        <div style={{ position: "absolute", width: `${pct}%`, height: 4, borderRadius: 2, background: color }} />
        <input type="range" min={min} max={max} step={(max - min) / 100} value={value}
          onChange={(e) => onChange(Math.round(parseFloat(e.target.value) * 100) / 100)}
          style={{ position: "absolute", width: "100%", opacity: 0, cursor: "pointer", margin: 0, padding: 0 }} />
        <div style={{ position: "absolute", left: `calc(${pct}% - 8px)`, width: 16, height: 16, borderRadius: "50%", background: color, border: "2px solid #0a0a0f", boxShadow: `0 0 8px ${color}88`, pointerEvents: "none" }} />
      </div>
    </div>
  );
}

// ── Share Card (Figma-matched design, 1080×1920) ──────────────────────────────
function ShareCard({ slots, userName, theme }) {
  const canvasRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [cardTheme, setCardTheme] = useState(theme || "purple");

  const themes = {
    purple: { bg: "#A237FF", wave: "#000000", card: "#ffffff", cardText: "#000000", accent: "#A237FF", titleBox: "#000000", titleText: "#ffffff", labelBg: "#000000", labelText: "#ffffff" },
    lime:   { bg: "#C3FF00", wave: "#000000", card: "#C3FF00", cardText: "#000000", accent: "#C3FF00", titleBox: "#000000", titleText: "#C3FF00", labelBg: "#000000", labelText: "#C3FF00" },
  };

  // The exact wave path from Figma SVG (already in 1080x1920 space)
  const WAVE_PATH = "M1622.09 1372.2C1559.93 1336.65 1505.66 1231.69 1472.17 1170.25C1491.75 1274.59 1510.28 1373.25 1517.34 1476.52C1520.2 1518.35 1531.92 1675.67 1481.31 1688.83C1428.56 1702.55 1353.79 1549.8 1330.06 1508.53C1347.91 1622.82 1384.39 1893.24 1314.17 1989.27C1296.82 2012.99 1268.74 2019.85 1242.08 2008.46C1133.86 1962.24 1024.74 1716.01 979.666 1606.92C981.54 1667.21 991.948 1768.3 964.522 1822.22C955.111 1840.7 935.4 1845.69 917.965 1835.3C872.302 1808.05 830.459 1729.04 805.286 1681.09C756.856 1588.84 721.608 1494.29 682.87 1394.47C685.038 1470.31 694.544 1574.73 659.886 1641.81C647.555 1665.72 622.833 1674.01 598.949 1662.11C511.882 1618.69 423.732 1413.73 383.585 1321.04C380.62 1349.7 384.947 1415.36 357.453 1431.65C312.843 1458.1 239.219 1298.11 225.065 1266.72C146.764 1093.04 80.1611 856.12 54.996 667.461C47.9488 614.591 35.1707 502.918 61.7822 458.151C69.5341 445.102 84.3873 443.138 96.4241 450.859C134.63 475.355 168.242 540.585 188.838 582.046C189.65 583.712 192.483 583.891 192.346 582.381C188.73 536.724 184.223 492.492 184.608 446.371C184.993 400.25 187.914 314.546 219.371 280.495C233.758 264.922 254.493 263.573 272.573 272.895C360.208 318.132 447.632 523.47 488.397 616.926C481.648 540.709 463.284 404.041 495.272 334.298C504.042 315.168 524.253 309.405 541.976 319.803C632.573 372.928 745.611 673.339 782.41 777.289C783.082 781.518 784.813 783.901 786.121 779.776C784.275 703.959 783.682 595.633 821.956 531.211C840.387 500.216 874.266 491.331 906.56 508.566C972.435 543.735 1027.01 637.845 1067.62 704.408C1046.92 597.312 1026.78 492.613 1018.64 384.169C1015.33 340.232 1002.53 180.888 1053.38 164.712C1113.97 145.427 1211.36 360.388 1233.55 405.476C1226.71 342.335 1216.67 285.458 1213.67 224.625C1210.67 163.792 1206.07 53.9535 1240.11 0.186978C1253.45 -20.9179 1275.7 -26.8806 1297.45 -16.5519C1366.76 16.3341 1435.01 156.173 1470.88 226.189C1470.45 182.249 1458.55 84.9313 1489.32 52.6221C1520.09 20.3129 1572.44 110.889 1583.8 131.133C1675.67 294.488 1748.34 545.651 1782.64 730.053C1791.86 779.643 1831.65 1013.22 1775.86 1033.88C1744.76 1045.4 1703.93 972.759 1689.32 951.878C1704.77 1048.34 1735.14 1278.94 1684.2 1357.51C1670.12 1379.25 1645.91 1385.82 1622.09 1372.2Z";
  const WAVE_PATH2 = "M102.278 1060.38C104.808 1083.48 108.808 1152.67 85.1851 1161.91C60.3503 1171.64 25.7768 1107.69 16.201 1087.48C-23.3233 1004.06 -48.2633 915.169 -58.4975 823.379C-61.0544 800.488 -64.9534 729.924 -40.7788 721.929C-15.3238 713.488 18.116 776.472 27.8495 797.031C67.231 880.148 92.2964 968.977 102.278 1060.38Z";

  async function loadImageAsBlob(url) {
    const proxies = [
      "https://images.weserv.nl/?url=" + encodeURIComponent(url),
      "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
      "https://corsproxy.io/?url=" + encodeURIComponent(url),
    ];
    for (const proxy of proxies) {
      try {
        const res = await fetch(proxy, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) continue;
        const blob = await res.blob();
        if (blob.size < 100) continue;
        const blobUrl = URL.createObjectURL(blob);
        return await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(blobUrl); resolve(img); };
          img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(); };
          img.src = blobUrl;
        });
      } catch { continue; }
    }
    return null;
  }

  function drawRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
    const words = text.split(" ");
    let line = "", lines = [];
    for (const word of words) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line.trim());
        line = word + " ";
        if (lines.length >= maxLines) break;
      } else line = test;
    }
    if (lines.length < maxLines) lines.push(line.trim());
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH));
    return lines.length;
  }

  async function drawCard(t) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 1080, H = 1920;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const T = themes[t];

    // Background
    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, W, H);

    // Wave shapes from Figma — save/restore to apply clipping transform
    ctx.save();
    // Apply the same rotation transform from the SVG clip: rotate(-15.6891deg) around (-192, 389.443)
    ctx.translate(0, 280);
    ctx.translate(-192, 489.443);
    ctx.rotate(-15.6891 * Math.PI / 180);
    ctx.translate(192, -489.443);
    ctx.fillStyle = T.wave;
    const p1 = new Path2D(WAVE_PATH);
    ctx.fill(p1);
    const p2 = new Path2D(WAVE_PATH2);
    ctx.fill(p2);
    ctx.restore();

    // Load covers
    const covers = await Promise.all(slots.map(s => loadImageAsBlob(s.selected.cover)));

    // ── Header ──
    // "[Name]'s" small text
    ctx.fillStyle = T.bg === "#000000" ? "#fff" : (T.bg === "#C3FF00" ? "#000" : "#fff");
    ctx.font = "500 52px 'Bricolage Grotesque', sans-serif";
    ctx.textAlign = "center";
    const nameText = userName ? `${userName}'s` : "My";
    ctx.fillText(nameText, W / 2, 185);

    // "Music Capsule" in black box
    const titleBoxW = 860, titleBoxH = 130;
    const titleBoxX = (W - titleBoxW) / 2;
    const titleBoxY = 205;
    ctx.fillStyle = T.titleBox;
    ctx.fillRect(titleBoxX, titleBoxY, titleBoxW, titleBoxH);
    ctx.strokeStyle = T.bg === "#C3FF00" ? "#C3FF00" : "#A237FF";
    ctx.lineWidth = 3;
    ctx.strokeRect(titleBoxX, titleBoxY, titleBoxW, titleBoxH);
    ctx.fillStyle = T.titleText;
    ctx.font = "800 96px 'Bricolage Grotesque', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Music Capsule", W / 2, titleBoxY + 96);

    // ── Track cards ──
    const cardX = 60, cardW = W - 120;
    const cardYs = [420, 830, 1240];
    const cardH = 360;
    const coverSize = 260;
    const labelMap = ["the past", "the present", "the future"];

    slots.forEach((slot, i) => {
      const y = cardYs[i];

      // Card background
      ctx.fillStyle = T.card;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      drawRoundRect(ctx, cardX, y, cardW, cardH, 0);
      ctx.fill();
      ctx.stroke();

      // Era label pill
      const labelPadX = 20, labelPadY = 10;
      const labelText = labelMap[i];
      ctx.font = "700 28px 'Bricolage Grotesque', sans-serif";
      const labelW = ctx.measureText(labelText).width + labelPadX * 2;
      ctx.fillStyle = T.labelBg;
      ctx.fillRect(cardX + 24, y + 20, labelW, 46);
      ctx.fillStyle = T.labelText;
      ctx.textAlign = "left";
      ctx.fillText(labelText, cardX + 24 + labelPadX, y + 20 + 33);

      // Album cover
      const coverX = cardX + 24;
      const coverY = y + 80;
      if (covers[i]) {
        ctx.drawImage(covers[i], coverX, coverY, coverSize, coverSize);
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.strokeRect(coverX, coverY, coverSize, coverSize);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(coverX, coverY, coverSize, coverSize);
      }

      // Track info
      const textX = coverX + coverSize + 30;
      const textMaxW = cardW - coverSize - 80;

      // Song title — large bold
      ctx.fillStyle = T.cardText;
      ctx.font = "800 62px 'Bricolage Grotesque', sans-serif";
      ctx.textAlign = "left";
      wrapText(ctx, slot.selected.title, textX, coverY + 68, textMaxW, 70, 2);

      // Artist
      ctx.fillStyle = T.cardText;
      ctx.font = "400 36px 'Bricolage Grotesque', sans-serif";
      ctx.fillText(slot.selected.artist, textX, coverY + 210);
    });

    // ── Bottom branding box ──
    const brandBoxW = 580, brandBoxH = 115;
    const brandBoxX = (W - brandBoxW) / 2;
    const brandBoxY = H - 220;
    ctx.fillStyle = "#000";
    ctx.fillRect(brandBoxX, brandBoxY, brandBoxW, brandBoxH);
    ctx.fillStyle = T.bg;
    ctx.font = "800 84px 'Bricolage Grotesque', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Legacy.wav", W / 2, brandBoxY + brandBoxH / 2);

    // URL
    ctx.fillStyle = T.bg === "#C3FF00" ? "#000" : "#fff";
    ctx.font = "400 32px 'Bricolage Grotesque', sans-serif";
    ctx.fillText("music-time-capsule.vercel.app", W / 2, H - 60);

    return canvas;
  }

  async function handleExport() {
    setExporting(true);
    try {
      // Load Bricolage Grotesque font first
      await document.fonts.load("800 96px 'Bricolage Grotesque'");
      await document.fonts.load("400 38px 'Bricolage Grotesque'");
      const canvas = await drawCard(cardTheme);
      const link = document.createElement("a");
      link.download = `${userName ? userName.replace(/\s+/g, "-").toLowerCase() : "my"}-music-capsule.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Export error:", e);
    }
    setExporting(false);
  }

  return (
    <div style={{ marginTop: 0 }}>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Theme toggle pill */}
      <div style={{ display: "flex", gap: 0, marginBottom: 14, border: "1.5px solid rgba(255,255,255,0.15)", width: "fit-content" }}>
        {[["purple", "#A237FF", "Purple"], ["lime", "#C3FF00", "Lime"]].map(([id, color, label]) => (
          <div key={id} onClick={() => setCardTheme(id)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", background: cardTheme === id ? color : "transparent", cursor: "pointer", transition: "all 0.15s" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: cardTheme === id ? "#000" : color, flexShrink: 0 }} />
            <span style={{ color: cardTheme === id ? "#000" : "rgba(255,255,255,0.5)", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 13, fontWeight: cardTheme === id ? 700 : 400 }}>{label}</span>
          </div>
        ))}
      </div>

      <button onClick={handleExport} disabled={exporting}
        style={{ width: "100%", background: exporting ? "rgba(195,255,0,0.3)" : "#C3FF00", color: "#000", border: "none", borderRadius: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 800, padding: "16px 0", cursor: exporting ? "not-allowed" : "pointer", letterSpacing: "0.02em", transition: "all 0.2s" }}>
        {exporting ? "Generating card..." : "Download Card"}
      </button>
      {exporting && (
        <div style={{ height: 3, background: "rgba(255,255,255,0.08)", marginTop: 2 }}>
          <div style={{ height: "100%", width: "60%", background: "#A237FF" }} />
        </div>
      )}
    </div>
  );
}

// ── Vinyl Card ────────────────────────────────────────────────────────────────
function VinylCapsuleCard({ slots, onShare, shared = false }) {
  const [copied, setCopied] = useState(false);
  const accentMap = { 0: "#c084fc", 1: "#67e8f9", 2: "#86efac" };

  function handleShare() { onShare(); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  return (
    <div style={{ textAlign: "center", margin: "0 auto 48px", maxWidth: 480 }}>
      {!shared && <div style={{ fontSize: 11, fontFamily: "'Bricolage Grotesque', monospace", letterSpacing: "0.25em", color: "#555", marginBottom: 20, textTransform: "uppercase" }}>◈ Your Capsule</div>}
      <div style={{ position: "relative", width: 280, height: 280, margin: "0 auto 28px" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle, #1a1a2e 30%, #0d0d1a 60%, #111 100%)", border: "2px solid rgba(255,255,255,0.06)", animation: "spinSlow 12s linear infinite" }} />
        {[100, 115, 130, 145].map((r) => (
          <div key={r} style={{ position: "absolute", top: `calc(50% - ${r}px)`, left: `calc(50% - ${r}px)`, width: r * 2, height: r * 2, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        ))}
        {slots.map((slot, i) => {
          const positions = [{ top: "8%", left: "50%", transform: "translateX(-50%)" }, { top: "55%", left: "12%" }, { top: "55%", left: "60%" }];
          const accent = accentMap[i];
          return (
            <div key={i} style={{ position: "absolute", ...positions[i], width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: `2px solid ${accent}`, boxShadow: `0 0 16px ${accent}66`, animation: `spinSlow 12s linear infinite`, animationDirection: i === 1 ? "reverse" : "normal" }}>
              {slot.selected?.cover && <img src={slot.selected.cover} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", animation: `spinSlow 12s linear infinite`, animationDirection: i === 1 ? "normal" : "reverse" }} />}
            </div>
          );
        })}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 56, height: 56, borderRadius: "50%", background: "#0a0a0f", border: "2px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.3)" }} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {slots.map((slot, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: `1px solid ${accentMap[i]}22` }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: accentMap[i], flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: "left" }}>
              <span style={{ color: "#fff", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 13, fontWeight: 600 }}>{slot.selected?.title}</span>
              <span style={{ color: "#555", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 12 }}> — {slot.selected?.artist}</span>
            </div>
            {slot.selected?.year && <div style={{ color: accentMap[i], fontFamily: "'Bricolage Grotesque', monospace", fontSize: 11, flexShrink: 0 }}>{slot.selected.year}</div>}
          </div>
        ))}
      </div>
      {!shared && (
        <button onClick={handleShare} style={{ background: copied ? "rgba(195,255,0,0.15)" : "rgba(255,255,255,0.06)", border: `1.5px solid ${copied ? "#C3FF00" : "rgba(255,255,255,0.15)"}`, color: copied ? "#C3FF00" : "rgba(255,255,255,0.6)", borderRadius: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 13, fontWeight: 600, padding: "12px 28px", cursor: "pointer", transition: "all 0.2s" }}>
          {copied ? "✓ Link copied!" : "Share Capsule"}
        </button>
      )}
      <style>{`@keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Receiver View ─────────────────────────────────────────────────────────────
function ReceiverView({ slots }) {
  const accentMap = { 0: "#c084fc", 1: "#67e8f9", 2: "#86efac" };
  const [playing, setPlaying] = useState(false);
  const [currentEra, setCurrentEra] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioRefs = useRef([null, null, null]);
  const fadeRef = useRef(null);
  const startTimeRef = useRef(null);
  const eraRef = useRef(0);

  useEffect(() => {
    slots.forEach((slot, i) => {
      if (slot.selected?.preview) {
        const audio = new Audio(slot.selected.preview);
        audio.volume = 0; audio.loop = true;
        audioRefs.current[i] = audio;
      }
    });
    return () => audioRefs.current.forEach((a) => { if (a) { a.pause(); a.src = ""; } });
  }, []);

  const tick = useCallback(() => {
    const now = performance.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    const era = eraRef.current;
    const dur = 10;
    const FADE = 2;

    if (elapsed >= dur) {
      if (era === 2) {
        audioRefs.current.forEach((a) => { if (a) { a.pause(); a.currentTime = 0; a.volume = 0; } });
        setPlaying(false); setCurrentEra(0); setProgress(0); eraRef.current = 0;
        return;
      }
      const nextEra = era + 1;
      eraRef.current = nextEra; setCurrentEra(nextEra);
      startTimeRef.current = now; setProgress(0);
      fadeRef.current = requestAnimationFrame(tick);
      return;
    }

    const p = elapsed / dur;
    setProgress(p);
    const fadeStart = 1 - FADE / dur;
    const inFade = p > fadeStart;
    const fadePct = inFade ? (p - fadeStart) / (FADE / dur) : 0;

    audioRefs.current.forEach((audio, i) => {
      if (!audio) return;
      let vol = 0;
      if (i === era) {
        vol = 1;
        if (era === 2) { const s = Math.max(0, 1 - 3 / dur); if (p > s) vol = 1 - (p - s) / (3 / dur); }
        else if (inFade) vol = 1 - fadePct;
      } else if (i === era + 1) {
        vol = inFade ? fadePct : 0;
      }
      
      audio.volume = Math.max(0, vol);
      // MOBILE FIX: Force mute if volume is 0
      audio.muted = audio.volume <= 0;
    });

    fadeRef.current = requestAnimationFrame(tick);
  }, []);

  function togglePlay() {
    if (!playing) {
      // MOBILE FIX: Unlock all tracks and force mute all but the first
      audioRefs.current.forEach((a, i) => {
        if (a) {
          a.muted = i !== 0;
          a.volume = i === 0 ? 1 : 0;
          a.play().catch(e => console.log("Unlock failed", e));
        }
      });
      eraRef.current = 0; 
      setCurrentEra(0);
      startTimeRef.current = performance.now();
      setPlaying(true);
      fadeRef.current = requestAnimationFrame(tick);
    } else {
      // KEEP THIS: It stops the music and resets everything
      cancelAnimationFrame(fadeRef.current);
      audioRefs.current.forEach((a) => { 
        if (a) { 
          a.pause(); 
          a.currentTime = 0; 
          a.volume = 0; 
        } 
      });
      setPlaying(false); 
      setCurrentEra(0); 
      setProgress(0);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff", padding: "48px 24px", boxSizing: "border-box" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;700;800&family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontFamily: "'Bricolage Grotesque', monospace", letterSpacing: "0.25em", color: "#555", marginBottom: 12, textTransform: "uppercase" }}>◈ Music Time Capsule</div>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', monospace", fontSize: "clamp(24px, 4vw, 42px)", fontWeight: 700, margin: 0, background: "linear-gradient(135deg, #c084fc, #67e8f9, #86efac)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.15 }}>
          Someone shared a capsule with you
        </h1>
        <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: "#555", fontSize: 15, marginTop: 12, lineHeight: 1.6 }}>Three songs across three eras, mixed into one journey.</p>
      </div>
      <VinylCapsuleCard slots={slots} shared={true} onShare={() => {}} />
      <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <button onClick={togglePlay} style={{ background: playing ? "linear-gradient(135deg, #c084fc, #67e8f9)" : "rgba(255,255,255,0.08)", color: playing ? "#000" : "#fff", border: "none", borderRadius: 50, width: 72, height: 72, fontSize: 28, cursor: "pointer", transition: "all 0.2s", boxShadow: playing ? "0 0 40px rgba(192,132,252,0.4)" : "none", marginBottom: 12 }}>
          {playing ? "⏸" : "▶"}
        </button>
        <div style={{ color: "#444", fontSize: 12, fontFamily: "'Bricolage Grotesque', monospace", marginBottom: 32 }}>
          {playing ? `era ${currentEra + 1} of 3 — crossfading` : "press play to experience the capsule"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {slots.map((slot, i) => {
            const accent = accentMap[i];
            const isActive = currentEra === i && playing;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: isActive ? `${accent}12` : "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${isActive ? accent + "66" : "rgba(255,255,255,0.06)"}`, transition: "all 0.4s" }}>
                <img src={slot.selected?.cover} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover", boxShadow: isActive ? `0 0 12px ${accent}66` : "none", transform: isActive ? "scale(1.05)" : "scale(1)", transition: "all 0.4s" }} />
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ color: "#fff", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 13, fontWeight: 600 }}>{slot.selected?.title}</div>
                  <div style={{ color: "#555", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 12 }}>{slot.selected?.artist}{slot.selected?.year ? ` · ${slot.selected.year}` : ""}</div>
                  {isActive && (
                    <div style={{ marginTop: 6, height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 1, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress * 100}%`, background: accent, transition: "width 0.1s linear" }} />
                    </div>
                  )}
                </div>
                {isActive && <div style={{ color: accent, fontSize: 10, fontFamily: "'Bricolage Grotesque', monospace", letterSpacing: "0.1em" }}>● NOW</div>}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 40, padding: "20px 24px", background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ color: "#555", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, marginBottom: 14, lineHeight: 1.6 }}>Want to make your own time capsule?</div>
          <button onClick={() => { window.location.hash = ""; window.location.reload(); }}
            style={{ background: "linear-gradient(135deg, #c084fc, #67e8f9)", color: "#000", border: "none", borderRadius: 10, fontFamily: "'Bricolage Grotesque', monospace", fontSize: 12, fontWeight: 700, padding: "12px 28px", cursor: "pointer", letterSpacing: "0.08em" }}>
            Create Your Capsule →
          </button>
        </div>
      </div>
    </div>
  );
}



// ── Vinyl scratch ────────────────────────────────────────────────────────────
function playVinylScratch() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < data.length; j++) {
      const t = j / ctx.sampleRate;
      data[j] = (Math.random() * 2 - 1) * Math.sin(2 * Math.PI * 200 * t) * Math.exp(-t * 15);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = 0.3;
    src.connect(g); g.connect(ctx.destination); src.start();
    setTimeout(() => ctx.close(), 500);
  } catch(e) {}
}

// ── Crossfade Mixer ───────────────────────────────────────────────────────────
function CrossfadeMixer({ slots, volumes, speeds, onVolumeChange, onSpeedChange }) {
  const accentMap = { 0: "#c084fc", 1: "#67e8f9", 2: "#86efac" };
  const labelMap = { 0: "The Past", 1: "The Present", 2: "The Future" };

  const [playing, setPlaying] = useState(false);
  const [currentEra, setCurrentEra] = useState(0);
  const [progress, setProgress] = useState(0);
  const [durations, setDurations] = useState({ 0: 10, 1: 10, 2: 10 });
  const [transitions, setTransitions] = useState({ 0: "fade", 1: "fade" });
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);

  const audioRefs = useRef([null, null, null]);
  const gainRefs = useRef([null, null, null]);
  const ctxRef = useRef(null);
  const fadeRef = useRef(null);
  const startTimeRef = useRef(null);
  const eraRef = useRef(0);
  const durationsRef = useRef({ 0: 10, 1: 10, 2: 10 });
  const transitionsRef = useRef({ 0: "fade", 1: "fade" });
  const volumesRef = useRef(volumes);
  const scratchFiredRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordTimerRef = useRef(null);

  useEffect(() => { durationsRef.current = durations; }, [durations]);
  useEffect(() => { transitionsRef.current = transitions; }, [transitions]);
  useEffect(() => { volumesRef.current = volumes; }, [volumes]);

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      for (let i = 0; i < slots.length; i++) {
        if (cancelled) break;
        const slot = slots[i];
        if (!slot.selected?.preview) continue;
        // Try direct URL first, fall back to proxy if CORS blocks it
        const urls = [
          slot.selected.preview,
          "https://corsproxy.io/?url=" + encodeURIComponent(slot.selected.preview),
        ];
        for (const url of urls) {
          try {
            const audio = new Audio(url);
            audio.loop = true;
            audio.volume = 0;
            audio.playbackRate = speeds[i];
            audio.preload = "auto";
            await new Promise((resolve, reject) => {
              audio.oncanplaythrough = resolve;
              audio.onerror = reject;
              audio.load();
              // Don't wait forever — resolve after 3s regardless
              setTimeout(resolve, 3000);
            });
            audioRefs.current[i] = audio;
            break; // success, stop trying URLs
          } catch { continue; }
        }
      }
    };
    setup();
    return () => {
      cancelled = true;
      audioRefs.current.forEach((a) => { if (a) { a.pause(); a.src = ""; } });
      audioRefs.current = [null, null, null];
    };
  }, []);

  // ── Core tick ──────────────────────────────────────────────────────────────
  const tick = useCallback(() => {
    const now = performance.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    const era = eraRef.current;
    const dur = durationsRef.current[era];
    const style = transitionsRef.current[era] || "fade";
    const FADE = 2;

    // End of an era
    if (elapsed >= dur) {
      if (era === 2) {
        cancelAnimationFrame(fadeRef.current);
        audioRefs.current.forEach((a) => { if (a) { a.pause(); a.currentTime = 0; a.volume = 0; } });
        setPlaying(false); setCurrentEra(0); setProgress(0); eraRef.current = 0;
        return;
      }
      // Advance to next era (never wraps — era goes 0 → 1 → 2 → stop)
      const nextEra = era + 1;
      eraRef.current = nextEra;
      scratchFiredRef.current = false;
      setCurrentEra(nextEra);
      startTimeRef.current = now;
      setProgress(0);
      fadeRef.current = requestAnimationFrame(tick);
      return;
    }

    const p = elapsed / dur;
    setProgress(p);
    const fadeStart = Math.max(0, 1 - FADE / dur);
    const inFade = p > fadeStart;
    const fadePct = inFade ? (p - fadeStart) / (FADE / dur) : 0;

    audioRefs.current.forEach((audio, i) => {
      if (!audio) return;
      const baseVol = volumesRef.current[i] ?? 0.8;
      let vol = 0;

      if (i === era) {
        vol = 1;
        if (era === 2) {
          const fadeOutStart = Math.max(0, 1 - 3 / dur);
          if (p > fadeOutStart) vol = 1 - (p - fadeOutStart) / (3 / dur);
        } else if (inFade) {
          if (style === "fade") vol = 1 - fadePct;
          else if (style === "echo") vol = Math.pow(1 - fadePct, 3);
          else if (style === "vinyl") vol = fadePct < 0.6 ? 1 - (fadePct / 0.6) : 0;
          else if (style === "drop") vol = fadePct > 0.5 ? 0 : 1;
        }
        if (style === "vinyl" && inFade && fadePct >= 0.58 && fadePct < 0.65 && !scratchFiredRef.current) {
          scratchFiredRef.current = true;
          playVinylScratch();
        }
      } else if (i === era + 1) {
        if (inFade) {
          if (style === "fade") vol = fadePct;
          else if (style === "echo") vol = fadePct;
          else if (style === "vinyl") vol = fadePct > 0.7 ? (fadePct - 0.7) / 0.3 : 0;
          else if (style === "drop") vol = fadePct > 0.5 ? (fadePct - 0.5) * 2 : 0;
        }
      }

      audio.volume = Math.max(0, Math.min(1, vol)) * baseVol;
      // MOBILE FIX: Force mute if final volume is 0
      audio.muted = audio.volume <= 0;
    });

    fadeRef.current = requestAnimationFrame(tick);
  }, [speeds]);

  async function startPlayback() {
    eraRef.current = 0;
    scratchFiredRef.current = false;
    setCurrentEra(0);
    
    await new Promise((resolve) => setTimeout(resolve, 800));

    // MOBILE FIX: Explicitly mute and play all tracks to "unlock" them
    for (let i = 0; i < audioRefs.current.length; i++) {
      const audio = audioRefs.current[i];
      if (audio) {
        audio.muted = i !== 0; // Only the first track is unmuted
        audio.volume = i === 0 ? (volumesRef.current[0] || 0.8) : 0;
        try { 
          await audio.play(); 
        } catch(e) { 
          console.warn("Play failed:", e); 
        }
      }
    }

    startTimeRef.current = performance.now();
    setPlaying(true);
    cancelAnimationFrame(fadeRef.current);
    fadeRef.current = requestAnimationFrame(tick);
  }

  function stopPlayback() {
    cancelAnimationFrame(fadeRef.current);
    audioRefs.current.forEach((a) => {
      if (a) { a.pause(); a.currentTime = 0; a.volume = 0; a.playbackRate = 1; }
    });
    setPlaying(false); setCurrentEra(0); setProgress(0);
  }

  function handleSpeedChange(index, val) {
    onSpeedChange(index, val);
    if (audioRefs.current[index]) audioRefs.current[index].playbackRate = val;
  }

  // ── Export Mix ─────────────────────────────────────────────────────────────
  // Records the crossfade mix in real time and exports as MP4/WebM (mobile)
  // or falls back gracefully. Uses Web Audio API to mix all three tracks.
  async function exportMP3() {
    if (recording) return;

    const totalDuration = durationsRef.current[0] + durationsRef.current[1] + durationsRef.current[2];
    const sampleRate = 44100;
    const numChannels = 2;

    // Use OfflineAudioContext to render the full mix non-real-time
    // This is the most reliable approach across iOS/Android/Desktop
    const offlineCtx = new OfflineAudioContext(
      numChannels,
      Math.ceil((totalDuration + 1) * sampleRate),
      sampleRate
    );

    setRecording(true);
    setRecordProgress(0);

    try {
      // For each slot, fetch audio as ArrayBuffer and decode it
      const buffers = await Promise.all(
        slots.map(async (slot) => {
          if (!slot.selected?.preview) return null;
          const urls = [
            slot.selected.preview,
            "https://corsproxy.io/?url=" + encodeURIComponent(slot.selected.preview),
            "https://api.allorigins.win/raw?url=" + encodeURIComponent(slot.selected.preview),
          ];
          for (const url of urls) {
            try {
              const res = await fetch(url);
              if (!res.ok) continue;
              const arrayBuffer = await res.arrayBuffer();
              const decoded = await offlineCtx.decodeAudioData(arrayBuffer.slice(0));
              return decoded;
            } catch { continue; }
          }
          return null;
        })
      );

      setRecordProgress(0.15);

      // Schedule each buffer according to the crossfade timeline
      // Era 0: plays from t=0 to t=dur[0]
      // Era 1: plays from t=dur[0] to t=dur[0]+dur[1]
      // Era 2: plays from t=dur[0]+dur[1] to end
      const dur = durationsRef.current;
      const startTimes = [0, dur[0], dur[0] + dur[1]];
      const FADE = 2;

      buffers.forEach((buffer, i) => {
        if (!buffer) return;
        const baseVol = volumesRef.current[i] ?? 0.8;
        const speed = speeds[i] ?? 1;
        const eraStart = startTimes[i];
        const eraDur = dur[i];

        // Loop the buffer if it's shorter than the era duration
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.playbackRate.value = speed;

        const gainNode = offlineCtx.createGain();
        gainNode.gain.setValueAtTime(0, 0);

        // Fade in at era start (except era 0 which starts immediately)
        if (i === 0) {
          gainNode.gain.setValueAtTime(baseVol, eraStart);
        } else {
          // Fade in over FADE seconds from previous era's end
          gainNode.gain.setValueAtTime(0, eraStart - FADE);
          gainNode.gain.linearRampToValueAtTime(baseVol, eraStart);
        }

        // Fade out at era end (except last era which fades over 3s)
        if (i === 2) {
          gainNode.gain.setValueAtTime(baseVol, eraStart + eraDur - 3);
          gainNode.gain.linearRampToValueAtTime(0, eraStart + eraDur);
        } else {
          gainNode.gain.setValueAtTime(baseVol, eraStart + eraDur - FADE);
          gainNode.gain.linearRampToValueAtTime(0, eraStart + eraDur);
        }

        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);
        source.start(eraStart > FADE ? eraStart - FADE : 0);
        source.stop(eraStart + eraDur + 0.1);
      });

      setRecordProgress(0.25);

      // Render the full mix
      const renderedBuffer = await offlineCtx.startRendering();
      setRecordProgress(0.7);

      // Encode to WAV — universally supported on iOS, Android, Desktop
      function encodeWAV(buffer) {
        const numCh = buffer.numberOfChannels;
        const sr = buffer.sampleRate;
        const samples = buffer.length * numCh;
        const byteRate = sr * numCh * 2;
        const blockAlign = numCh * 2;
        const dataSize = samples * 2;
        const ab = new ArrayBuffer(44 + dataSize);
        const view = new DataView(ab);
        const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
        writeStr(0, "RIFF");
        view.setUint32(4, 36 + dataSize, true);
        writeStr(8, "WAVE");
        writeStr(12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numCh, true);
        view.setUint32(24, sr, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true); // 16-bit
        writeStr(36, "data");
        view.setUint32(40, dataSize, true);
        let offset = 44;
        for (let s = 0; s < buffer.length; s++) {
          for (let ch = 0; ch < numCh; ch++) {
            const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[s]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
          }
        }
        return new Blob([ab], { type: "audio/wav" });
      }

      const wavBlob = encodeWAV(renderedBuffer);
      setRecordProgress(1);

      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-capsule.wav";
      a.click();
      URL.revokeObjectURL(url);

    } catch (e) {
      console.error("Export failed:", e);
    }

    setRecording(false);
    setRecordProgress(0);
  }


  const LIME = "#C3FF00";
  const PURPLE = "#A237FF";

  return (
    <div>
      {/* ── Play + Export ── */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 16, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, color: "rgb(255, 255, 255)", letterSpacing: "normal", textTransform: "capitalize", marginBottom: 8 }}>Crossfade Mixer</div>
        <div style={{ fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif", color: "rgb(255, 255, 255)", marginBottom: 36 }}>
          Press play to listen or customize your mix using the settings below.
        </div>
        <button onClick={playing ? stopPlayback : startPlayback}
          style={{ background: "#fff", color: "#000", border: "none", borderRadius: "50%", width: 64, height: 64, fontSize: 22, cursor: "pointer", transition: "all 0.2s", marginBottom: 36, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          {playing ? "⏸" : "▶"}
        </button>

        {/* Export button */}
        <div>
          <button onClick={exportMP3} disabled={recording}
            style={{ width: "100%", background: recording ? "rgba(162,55,255,0.3)" : PURPLE, color: "#fff", border: "none", borderRadius: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 800, padding: "16px 0", cursor: recording ? "not-allowed" : "pointer", letterSpacing: "0.02em", transition: "all 0.2s" }}>
            {recording ? `Rendering... ${Math.round(recordProgress * 100)}%` : "Export Mix"}
          </button>
          {recording && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 3, background: "rgba(255,255,255,0.08)" }}>
                <div style={{ height: "100%", width: `${recordProgress * 100}%`, background: LIME, transition: "width 0.3s" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mixing Settings / Transition pickers ── */}
      <div style={{ marginBottom: 28, background: "#111117", padding: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Mixing Settings</div>
        {[0, 1].map((handoff) => (
          <div key={handoff} style={{ marginBottom: handoff === 0 ? 20 : 0 }}>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: "'Bricolage Grotesque', sans-serif", marginBottom: 8 }}>
              Track {handoff + 1} → Track {handoff + 2}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TRANSITION_STYLES.map((t) => {
                const active = transitions[handoff] === t.id;
                return (
                  <button key={t.id} onClick={() => setTransitions((prev) => ({ ...prev, [handoff]: t.id }))}
                    style={{ background: active ? PURPLE : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.4)", border: `1.5px solid ${active ? PURPLE : "rgba(255,255,255,0.15)"}`, borderRadius: 4, padding: "6px 14px", fontSize: 12, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: active ? 700 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Era panels ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {slots.map((slot) => {
          const accent = accentMap[slot.index];
          const isActive = currentEra === slot.index && playing;
          return (
            <div key={slot.index} style={{ background: "#111117", border: `1px solid ${isActive ? accent : "rgba(255,255,255,0.06)"}`, padding: 20, transition: "border-color 0.4s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <img src={slot.selected.cover} alt="" style={{ width: 52, height: 52, objectFit: "cover", flexShrink: 0, border: `2px solid ${isActive ? accent : "transparent"}`, transition: "border-color 0.4s" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{slot.selected.title}</div>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{slot.selected.artist}</div>
                  {isActive && (
                    <div style={{ marginTop: 6, height: 2, background: "rgba(255,255,255,0.08)" }}>
                      <div style={{ height: "100%", width: `${progress * 100}%`, background: LIME, transition: "width 0.1s linear" }} />
                    </div>
                  )}
                </div>
                {isActive && <div style={{ color: LIME, fontSize: 10, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, letterSpacing: "0.1em" }}>NOW</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Slider label="Duration" value={durations[slot.index]} min={5} max={30}
                  onChange={(v) => setDurations((prev) => ({ ...prev, [slot.index]: v }))} color={accent} unit="s" />
                <Slider label="Volume" value={volumes[slot.index]} min={0} max={1}
                  onChange={(v) => onVolumeChange(slot.index, v)} color={LIME} unit="%" />
                <Slider label="Speed" value={speeds[slot.index]} min={0.5} max={2}
                  onChange={(v) => handleSpeedChange(slot.index, v)} color={LIME} unit="x" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────
function Column({ slot, onSelect, onYearChange, onSearch }) {
  const labelMap = { 0: "The Past", 1: "The Present", 2: "The Future" };
  const LIME = "#C3FF00";
  const PURPLE = "#A237FF";

  return (
    <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: 12, background: "#111117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 0, padding: 20 }}>
      {/* Era label */}
      <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "normal", marginBottom: 4 }}>{labelMap[slot.index]}</div>

      {/* Search input */}
      <input type="text" value={slot.query}
        onChange={(e) => onYearChange(slot.index, slot.year, e.target.value)}
        placeholder="Artist, song, or genre"
        style={{ background: "#fff", border: "2px solid #000", borderRadius: 0, color: "#000", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 500, padding: "12px 14px", width: "100%", boxSizing: "border-box", outline: "none" }} />

      {/* Genre chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {GENRE_CHIPS.map((chip) => {
          const selected = slot.query === chip.query;
          return (
            <div key={chip.query} onClick={() => onYearChange(slot.index, slot.year, chip.query)}
              style={{ background: selected ? PURPLE : "transparent", border: `1px solid ${selected ? PURPLE : "rgba(255,255,255,0.8)"}`, padding: "4px 10px", fontSize: 12, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: selected ? 700 : 400, color: selected ? "#fff" : "rgba(255, 255, 255, 0.8)", cursor: "pointer", transition: "all 0.15s" }}>
              {chip.label}
            </div>
          );
        })}
      </div>

      {/* Year input */}
      <input type="number" min="1900" max="2099" value={slot.year}
        onChange={(e) => onYearChange(slot.index, e.target.value)}
        placeholder="Year (optional)"
        style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.8)", borderRadius: 0, color: "#fff", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 14, padding: "10px 14px", width: "100%", boxSizing: "border-box", outline: "none" }} />

      {/* Search button */}
      <button onClick={() => onSearch(slot.index)} disabled={(!slot.year && !slot.query) || slot.loading}
        style={{ background: (slot.year || slot.query) ? LIME : "rgba(255,255,255,0.05)", color: "#000", border: "none", borderRadius: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 800, padding: "14px 0", cursor: (slot.year || slot.query) ? "pointer" : "not-allowed", letterSpacing: "0.02em", transition: "opacity 0.2s" }}>
        {slot.loading ? "Searching..." : "Search"}
      </button>

      {slot.error && <div style={{ color: "#f87171", fontSize: 13, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{slot.error}</div>}

      {/* Results */}
      {slot.results.length > 0 && !slot.selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#FFFFFF", fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: "0.05em", textTransform: "Capitalize", marginBottom: 4 }}>Pick a track</div>
          {slot.results.map((song) => (
            <div key={song.id} onClick={() => onSelect(slot.index, song)}
              style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", borderRadius: 0, padding: "7px 10px", cursor: "pointer", border: "1px solid rgba(255,255,255,0.06)" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.09)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}>
              <img src={song.cover} alt={song.album} style={{ width: 32, height: 32, objectFit: "cover", flexShrink: 0 }} />
              <div style={{ overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, textAlign: "left" }}>
                <div style={{ color: "#fff", fontSize: 13, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2 }}>{song.title}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.2 }}>{song.artist}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected state — matches Group 7 design */}
      {slot.selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <img src={slot.selected.cover} alt={slot.selected.album}
              style={{ width: 80, height: 80, objectFit: "cover", border: "2px solid rgba(255,255,255,0.1)", flexShrink: 0 }} />
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ color: "#fff", fontSize: 20, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, lineHeight: 1.2, marginBottom: 2 }}>{slot.selected.title}</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 400 }}>{slot.selected.artist}</div>
            </div>
          </div>
          {slot.selected.preview && <audio controls src={slot.selected.preview} style={{ width: "100%" }} />}
          <button onClick={() => onSelect(slot.index, null)}
            style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.8)", color: "rgba(255,255,255,0.8)", borderRadius: 0, fontSize: 12, fontFamily: "'Bricolage Grotesque', sans-serif", padding: "7px 0", cursor: "pointer", width: "100%" }}>
            Change
          </button>
        </div>
      )}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const sharedCapsule = getSharedCapsule();
  const [slots, setSlots] = useState([
    { index: 0, year: "", query: "", results: [], selected: null, loading: false, error: null },
    { index: 1, year: "", query: "", results: [], selected: null, loading: false, error: null },
    { index: 2, year: "", query: "", results: [], selected: null, loading: false, error: null },
  ]);
  const [sealed, setSealed] = useState(false);
  const [volumes, setVolumes] = useState({ 0: 0.8, 1: 0.8, 2: 0.8 });
  const [speeds, setSpeeds] = useState({ 0: 1, 1: 1, 2: 1 });
  const [userName, setUserName] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const allSelected = slots.every((s) => s.selected !== null);

  if (sharedCapsule) return <ReceiverView slots={sharedCapsule} />;

  function updateSlot(index, changes) {
    setSlots((prev) => prev.map((s) => (s.index === index ? { ...s, ...changes } : s)));
  }

  function handleYearChange(index, year, query) {
    updateSlot(index, {
      year: year !== undefined ? year : slots[index].year,
      query: query !== undefined ? query : slots[index].query,
      results: [], selected: null, error: null,
    });
  }

  async function handleSearch(index) {
    const slot = slots[index];
    if (!slot.year && !slot.query) return;
    updateSlot(index, { loading: true, error: null, results: [], selected: null });
    try {
      const results = await fetchSongsForYear(slot.year, slot.query);
      if (results.length === 0) {
        updateSlot(index, { loading: false, error: "No songs found. Try a different search." });
      } else {
        updateSlot(index, { loading: false, results });
      }
    } catch (e) {
      updateSlot(index, { loading: false, error: "Couldn't reach the music API. Check your internet and try again." });
    }
  }

  function handleSelect(index, song) {
    updateSlot(index, { selected: song, results: [] });
  }

  function handleShare() {
    const encoded = encodeCapsule(slots);
    const url = `${window.location.origin}${window.location.pathname}#capsule=${encoded}`;
    navigator.clipboard.writeText(url);
  }

  const accentMap = { 0: "#A237FF", 1: "#67e8f9", 2: "#86efac" };

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..60,400;12..60,500;12..60,700;12..60,800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#fff", boxSizing: "border-box" }}>

        {/* ── Header ── */}
        <div style={{ padding: "32px 24px 0", maxWidth: 960, margin: "0 auto" }}>
          <div style={{ fontSize: 16, fontFamily: "'Bricolage Grotesque', sans-serif", color: "rgb(255, 255, 255)", letterSpacing: "0.08em", marginBottom: 8, textTransform: "capitalize" }}>Remix Three Eras</div>
          <div style={{ display: "inline-block", background: "#A237FF", padding: "8px 24px", marginBottom: 16, maxWidth: "fit-content" }}>
            <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "clamp(32px, 6vw, 56px)", fontWeight: 800, margin: 0, color: "#fff", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
              Music Capsule
            </h1>
          </div>
          <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif", color: "#fff", fontSize: 14, lineHeight: 1.6, maxWidth: 500, marginBottom: 24, margin: "0 auto 24px" }}>
          Select 3 tracks and then Seal The Capsule to recieve a visualizer and download your mix. Search by artist, song, or genre - add a year to narrow it down.
          </p>

          {/* Hero image */}
          <div style={{ position: "relative", marginBottom: 32, borderRadius: 0, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
            <img src="/her-updated.png" alt="Music Capsule example" style={{ width: "100%", display: "block", maxHeight: 320, objectFit: "cover", objectPosition: "center top" }}
              onError={(e) => { e.currentTarget.style.display = "none"; }} />
            <div style={{ position: "absolute", top: 12, right: 12, background: "#C3FF00", padding: "4px 12px" }}>
              <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 13, fontWeight: 800, color: "#000" }}>example</span>
            </div>
          </div>
        </div>

        {/* ── Search columns ── */}
        <div style={{ padding: "0 24px", maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {slots.map((slot) => (
              <Column key={slot.index} slot={slot} onSelect={handleSelect} onYearChange={handleYearChange} onSearch={handleSearch} />
            ))}
          </div>

          {/* ── Seal button ── */}
          <div style={{ marginTop: 24, marginBottom: 0 }}>
            <button disabled={!allSelected} onClick={() => setSealed(true)}
              style={{ width: "100%", background: allSelected ? "#A237FF" : "rgba(255, 255, 255, 0)", color: allSelected ? "#fff" : "#444", border: "none", borderRadius: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 20, fontWeight: 800, padding: "18px 0", cursor: allSelected ? "pointer" : "not-allowed", letterSpacing: "0.02em", transition: "all 0.2s" }}>
              {allSelected ? "Seal The Capsule" : "Select a song in each era to continue"}
            </button>
          </div>
        </div>

        {/* ── Sealed section ── */}
        {sealed && (
          <div style={{ padding: "32px 64px", maxWidth: 960, margin: "0 auto" }}>

            {/* Your Capsule — three cover grid */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 800, color: "rgb(255, 255, 255)", letterSpacing: "normal", textTransform: "capitalize", marginBottom: 16 }}>Your Capsule</div>
              <div style={{ display: "flex", gap: 12 }}>
                {slots.map((slot, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
                    <img src={slot.selected?.cover} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", border: "1px solid rgba(255,255,255,0.8)", display: "block" }} />
                    <div>
                      <div style={{ color: "#fff", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 800, lineHeight: 1.2, marginBottom: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{slot.selected?.title}</div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 12, fontWeight: 400 }}>{slot.selected?.artist}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card name input + theme + download */}
            <div style={{ marginBottom: 32, background: "#111117", padding: 20, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 800, color: "rgb(255, 255, 255)", letterSpacing: "normal", textTransform: "capitalize", marginBottom: 12 }}>Card Name</div>
              <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)}
                placeholder="Card Name" maxLength={20}
                style={{ background: "transparent", border: "1.5px solid rgba(255,255,255,0.8)", borderRadius: 0, color: "#fff", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15, padding: "11px 14px", width: "100%", boxSizing: "border-box", outline: "none", marginBottom: 14 }} />
              <ShareCard slots={slots} userName={userName} />
            </div>

            {/* Share link */}
            <div style={{ marginBottom: 32, textAlign: "center" }}>
              <button onClick={() => { handleShare(); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }}
                style={{ background: shareCopied ? "rgba(195,255,0,0.1)" : "transparent", border: `1.5px solid ${shareCopied ? "#C3FF00" : "rgba(255,255,255,0.8)"}`, color: shareCopied ? "#C3FF00" : "#fff", borderRadius: 0, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 15, fontWeight: 600, padding: "14px 40px", cursor: "pointer", letterSpacing: "0.02em", transition: "all 0.2s" }}>
                {shareCopied ? "✓ Link copied!" : "Share Capsule"}
              </button>
            </div>

            {/* Crossfade Mixer */}
            <CrossfadeMixer
              slots={slots} volumes={volumes} speeds={speeds}
              onVolumeChange={(i, v) => setVolumes((p) => ({ ...p, [i]: v }))}
              onSpeedChange={(i, v) => setSpeeds((p) => ({ ...p, [i]: v }))}
            />
          </div>
        )}

        {/* Legacy.wav footer */}
        <div style={{ background: "#C3FF00", padding: "20px 24px", marginTop: 48, textAlign: "center" }}>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 28, fontWeight: 800, color: "#000000", letterSpacing: "-0.01em" }}>Legacy.wav</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 12, marginTop: 4 }}>music-time-capsule.vercel.app</div>
        </div>
      </div>
    </>
  );
}
