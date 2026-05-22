/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard */
const { useState, useEffect, useRef } = React;

/* ------------------------------------------------------------------ */
/*  The button component itself                                        */
/* ------------------------------------------------------------------ */
function HRButton({ label = "Play", state = "idle", size, block, onClick }) {
  const cls = [
    "hr-btn",
    size === "sm" && "hr-btn--sm",
    block && "hr-btn--block",
    state === "pressed"  && "is-pressed",
    state === "focused"  && "is-focused",
    state === "disabled" && "is-disabled",
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={cls}
      disabled={state === "disabled"}
      onClick={onClick}
      aria-label={label}
    >
      <span className="hr-btn__face">
        <span className="hr-btn__pin-b1" />
        <span className="hr-btn__pin-b2" />
        <span className="hr-btn__label">{label}</span>
      </span>
    </button>
  );
}
window.HRButton = HRButton;

/* ------------------------------------------------------------------ */
/*  Re-usable bits                                                     */
/* ------------------------------------------------------------------ */

const TONE_BACKDROPS = {
  parchment: "linear-gradient(180deg, #E6DFCE 0%, #D8CFB8 100%)",
  charcoal:  "radial-gradient(120% 100% at 50% 0%, #1F2330 0%, #0E1015 70%, #07080B 100%)",
  ink:       "radial-gradient(120% 100% at 50% 0%, #1A2438 0%, #0B1120 100%)",
  felt:      "radial-gradient(120% 100% at 50% 0%, #2A1B1D 0%, #160A0C 100%)",
};

function Backdrop({ tone = "parchment", children, style }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: TONE_BACKDROPS[tone],
      display: "flex", alignItems: "center", justifyContent: "center",
      ...style
    }}>
      {children}
    </div>
  );
}

function Caption({ children, dark }) {
  return (
    <div style={{
      position: "absolute", bottom: 14, left: 0, right: 0,
      textAlign: "center",
      fontFamily: '"Cormorant SC", "Cormorant Garamond", Georgia, serif',
      fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase",
      color: dark ? "rgba(236,228,208,0.55)" : "rgba(40, 36, 28, 0.55)",
      fontWeight: 600,
    }}>{children}</div>
  );
}

/* ------------------------------------------------------------------ */
/*  ARTBOARD CONTENTS                                                  */
/* ------------------------------------------------------------------ */

function StateArtboard({ state, label = "Play", tone = "parchment" }) {
  const dark = tone !== "parchment";
  return (
    <Backdrop tone={tone}>
      <HRButton label={label} state={state} />
      <Caption dark={dark}>{state}</Caption>
    </Backdrop>
  );
}

/* — Anatomy: a button with callouts pointing at each layer — */
function AnatomyArtboard() {
  return (
    <Backdrop tone="parchment" style={{ padding: 40 }}>
      <div style={{ position: "relative", width: 520, height: 320 }}>
        {/* SVG overlay for callout lines */}
        <svg viewBox="0 0 520 320" style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          pointerEvents: "none",
        }}>
          {/* Lines from labels to features */}
          {/* Top-left: brass frame */}
          <line x1="80" y1="60" x2="135" y2="118" stroke="#5A4218" strokeWidth="0.75" />
          <circle cx="135" cy="118" r="2" fill="#8C6B2C" />
          {/* Top-right: top highlight */}
          <line x1="440" y1="60" x2="385" y2="120" stroke="#5A4218" strokeWidth="0.75" />
          <circle cx="385" cy="120" r="2" fill="#8C6B2C" />
          {/* Mid-left: matte face */}
          <line x1="60" y1="160" x2="200" y2="160" stroke="#5A4218" strokeWidth="0.75" />
          <circle cx="200" cy="160" r="2" fill="#8C6B2C" />
          {/* Mid-right: safe area for text */}
          <line x1="460" y1="160" x2="320" y2="160" stroke="#5A4218" strokeWidth="0.75" />
          <circle cx="320" cy="160" r="2" fill="#8C6B2C" />
          {/* Bottom-left: corner pin */}
          <line x1="80" y1="260" x2="138" y2="196" stroke="#5A4218" strokeWidth="0.75" />
          <circle cx="138" cy="196" r="2" fill="#8C6B2C" />
          {/* Bottom-right: drop shadow */}
          <line x1="440" y1="260" x2="380" y2="210" stroke="#5A4218" strokeWidth="0.75" />
          <circle cx="380" cy="210" r="2" fill="#8C6B2C" />
        </svg>

        {/* The button, centered */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
        }}>
          <div style={{ position: "relative" }}>
            <HRButton label="Name the Rule" />
            {/* Safe area indicator */}
            <div style={{
              position: "absolute",
              top: 10, bottom: 10, left: 28, right: 28,
              border: "1px dashed rgba(140, 52, 56, 0.55)",
              borderRadius: 7,
              pointerEvents: "none",
            }} />
          </div>
        </div>

        {/* Callout labels */}
        <Tag x={12} y={48} align="left">Brass frame · 1.5px</Tag>
        <Tag x={508} y={48} align="right">Soft top highlight</Tag>
        <Tag x={12} y={150} align="left">Matte face · ink-blue inner glow</Tag>
        <Tag x={508} y={150} align="right">Safe area for dynamic text</Tag>
        <Tag x={12} y={252} align="left">Corner pins · 3px brass</Tag>
        <Tag x={508} y={252} align="right">Quiet drop shadow</Tag>
      </div>
      <Caption>Anatomy</Caption>
    </Backdrop>
  );
}

function Tag({ x, y, align = "left", children }) {
  return (
    <div style={{
      position: "absolute",
      left: align === "left" ? x : "auto",
      right: align === "right" ? 520 - x : "auto",
      top: y, transform: "translateY(-50%)",
      fontFamily: '"Cormorant SC", "Cormorant Garamond", Georgia, serif',
      fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
      color: "rgba(40, 36, 28, 0.78)",
      fontWeight: 600,
      whiteSpace: "nowrap",
      textAlign: align,
    }}>{children}</div>
  );
}

/* — Label variants: shows the same button with different dynamic text — */
function LabelVariantsArtboard() {
  const labels = ["Play", "Submit", "Next Chapter", "Name the Rule"];
  return (
    <Backdrop tone="parchment" style={{ flexDirection: "column", gap: 22, padding: 32 }}>
      {labels.map(l => <HRButton key={l} label={l} />)}
      <Caption>Dynamic text · variable widths</Caption>
    </Backdrop>
  );
}

/* — Phone in-context — */
function PhoneArtboard() {
  return (
    <Backdrop tone="charcoal" style={{ padding: 40 }}>
      <div style={{
        width: 320, height: 640,
        borderRadius: 42,
        background: "linear-gradient(180deg, #1B1820 0%, #110F15 100%)",
        boxShadow:
          "inset 0 0 0 1.5px #3A2D14, " +
          "inset 0 0 0 3px #0A0709, " +
          "0 30px 60px -20px rgba(0,0,0,0.7)",
        padding: 14,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          width: "100%", height: "100%",
          borderRadius: 30,
          background:
            "radial-gradient(80% 50% at 50% 18%, rgba(40, 56, 96, 0.32) 0%, transparent 70%), " +
            "linear-gradient(180deg, #161019 0%, #0B0810 100%)",
          padding: "32px 24px 28px",
          display: "flex", flexDirection: "column",
          position: "relative",
        }}>
          {/* Chapter label */}
          <div style={{
            fontFamily: '"Cormorant SC", "Cormorant Garamond", Georgia, serif',
            fontSize: 11, letterSpacing: "0.32em",
            color: "rgba(214, 179, 108, 0.85)",
            textAlign: "center", marginBottom: 4, fontWeight: 600,
          }}>Chapter II</div>
          <div style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: 26, fontWeight: 500, fontStyle: "italic",
            color: "#ECE4D0", textAlign: "center",
            letterSpacing: "0.02em",
          }}>The Quiet Order</div>

          {/* Card cluster (placeholders) */}
          <div style={{
            flex: 1, marginTop: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <CardPlaceholder rotate={-8} dx={-44} suit="◆" />
            <CardPlaceholder rotate={0} dx={0} suit="✦" highlight />
            <CardPlaceholder rotate={8} dx={44} suit="◇" />
          </div>

          {/* Hint line */}
          <div style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontStyle: "italic", fontSize: 14,
            color: "rgba(236, 228, 208, 0.55)",
            textAlign: "center", marginBottom: 18,
            letterSpacing: "0.04em",
          }}>Three cards form a sequence only one rule explains.</div>

          {/* The CTA */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <HRButton label="Name the Rule" />
          </div>
        </div>
      </div>
      <Caption dark>In context</Caption>
    </Backdrop>
  );
}

function CardPlaceholder({ rotate, dx, suit, highlight }) {
  return (
    <div style={{
      position: "absolute",
      width: 76, height: 108,
      transform: `translateX(${dx}px) rotate(${rotate}deg)`,
      borderRadius: 8,
      background: highlight
        ? "linear-gradient(180deg, #ECE4D0 0%, #D8CDB0 100%)"
        : "linear-gradient(180deg, #1A2438 0%, #0E1525 100%)",
      boxShadow: highlight
        ? "0 0 0 1px #8C6B2C, 0 6px 18px rgba(0,0,0,0.6)"
        : "0 0 0 1px #3A2D14, 0 4px 14px rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: '"Cormorant Garamond", Georgia, serif',
      fontSize: 32,
      color: highlight ? "#6E2A2E" : "#D6B36C",
    }}>{suit}</div>
  );
}

/* — Interactive playground — */
function PlaygroundArtboard() {
  const [label, setLabel] = useState("Name the Rule");
  const [state, setState] = useState("idle");
  const [tone, setTone] = useState("parchment");

  const stateOptions = ["idle", "pressed", "focused", "disabled"];
  const toneOptions = [
    ["parchment", "Parchment"],
    ["charcoal", "Charcoal"],
    ["ink", "Ink"],
    ["felt", "Oxblood felt"],
  ];

  return (
    <Backdrop tone={tone} style={{ flexDirection: "column", padding: 28 }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
        <HRButton label={label} state={state} />
      </div>

      {/* Controls */}
      <div style={{
        background: "rgba(20, 18, 14, 0.78)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(214, 179, 108, 0.35)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex", flexDirection: "column", gap: 10,
        width: "100%", maxWidth: 520,
      }}>
        <Row title="Label">
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            style={inputStyle}
            maxLength={28}
          />
        </Row>
        <Row title="State">
          <Segment options={stateOptions.map(o => [o, o])} value={state} onChange={setState} />
        </Row>
        <Row title="Backdrop">
          <Segment options={toneOptions} value={tone} onChange={setTone} />
        </Row>
      </div>
    </Backdrop>
  );
}

const inputStyle = {
  flex: 1,
  background: "rgba(0,0,0,0.4)",
  border: "1px solid rgba(214, 179, 108, 0.35)",
  borderRadius: 6,
  color: "#ECE4D0",
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontSize: 14,
  padding: "6px 10px",
  outline: "none",
  letterSpacing: "0.04em",
};

function Row({ title, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 78,
        fontFamily: '"Cormorant SC", "Cormorant Garamond", Georgia, serif',
        fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase",
        color: "rgba(214, 179, 108, 0.85)",
        fontWeight: 600,
      }}>{title}</div>
      <div style={{ flex: 1, display: "flex" }}>{children}</div>
    </div>
  );
}

function Segment({ options, value, onChange }) {
  return (
    <div style={{
      display: "flex", flex: 1, gap: 0,
      border: "1px solid rgba(214, 179, 108, 0.35)",
      borderRadius: 6, overflow: "hidden",
      background: "rgba(0,0,0,0.4)",
    }}>
      {options.map(([k, label], i) => (
        <button key={k}
          onClick={() => onChange(k)}
          style={{
            flex: 1,
            background: value === k ? "rgba(214, 179, 108, 0.22)" : "transparent",
            border: 0,
            borderLeft: i === 0 ? "0" : "1px solid rgba(214, 179, 108, 0.25)",
            color: value === k ? "#ECE4D0" : "rgba(236, 228, 208, 0.55)",
            fontFamily: '"Cormorant SC", "Cormorant Garamond", Georgia, serif',
            fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase",
            padding: "8px 6px",
            cursor: "pointer", fontWeight: 600,
          }}
        >{label}</button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Canvas layout                                                      */
/* ------------------------------------------------------------------ */
function App() {
  return (
    <DesignCanvas storageKey="hidden-rule-cta">
      <DCSection id="states-light" title="States · on parchment">
        <DCArtboard id="idle-light"     label="Idle"     width={360} height={260}>
          <StateArtboard state="idle" label="Play" />
        </DCArtboard>
        <DCArtboard id="pressed-light"  label="Pressed"  width={360} height={260}>
          <StateArtboard state="pressed" label="Play" />
        </DCArtboard>
        <DCArtboard id="focused-light"  label="Focused"  width={360} height={260}>
          <StateArtboard state="focused" label="Play" />
        </DCArtboard>
        <DCArtboard id="disabled-light" label="Disabled" width={360} height={260}>
          <StateArtboard state="disabled" label="Play" />
        </DCArtboard>
      </DCSection>

      <DCSection id="states-dark" title="States · on charcoal">
        <DCArtboard id="idle-dark"     label="Idle"     width={360} height={260}>
          <StateArtboard state="idle" label="Submit" tone="charcoal" />
        </DCArtboard>
        <DCArtboard id="pressed-dark"  label="Pressed"  width={360} height={260}>
          <StateArtboard state="pressed" label="Submit" tone="charcoal" />
        </DCArtboard>
        <DCArtboard id="focused-dark"  label="Focused"  width={360} height={260}>
          <StateArtboard state="focused" label="Submit" tone="charcoal" />
        </DCArtboard>
        <DCArtboard id="disabled-dark" label="Disabled" width={360} height={260}>
          <StateArtboard state="disabled" label="Submit" tone="charcoal" />
        </DCArtboard>
      </DCSection>

      <DCSection id="anatomy" title="Anatomy & safe area">
        <DCArtboard id="anatomy-board" label="Construction" width={620} height={420}>
          <AnatomyArtboard />
        </DCArtboard>
        <DCArtboard id="label-variants" label="Dynamic text" width={360} height={420}>
          <LabelVariantsArtboard />
        </DCArtboard>
      </DCSection>

      <DCSection id="context" title="In context">
        <DCArtboard id="phone" label="Chapter II · Name the Rule" width={420} height={760}>
          <PhoneArtboard />
        </DCArtboard>
        <DCArtboard id="playground" label="Playground · live" width={520} height={560}>
          <PlaygroundArtboard />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
