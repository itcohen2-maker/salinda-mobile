/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard */
const { useState } = React;

/* ============================================================
   Components — Secondary is the focus; Primary is shown only for
   hierarchy/context comparisons.
   ============================================================ */

function HRSecondary({ label = "Hint", state = "idle", block, narrow, lang, onClick }) {
  const cls = [
    "hr-secondary",
    block && "hr-secondary--block",
    narrow && "hr-secondary--narrow",
    state === "pressed"  && "is-pressed",
    state === "focused"  && "is-focused",
    state === "selected" && "is-selected",
    state === "disabled" && "is-disabled",
  ].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} disabled={state === "disabled"}
            onClick={onClick} lang={lang} dir="auto" aria-label={label}
            aria-pressed={state === "selected" || undefined}>
      <span className="hr-secondary__label hr-label" lang={lang} dir="auto">{label}</span>
    </button>
  );
}

function HRPrimary({ label = "Continue", state = "idle", block, lang }) {
  const cls = [
    "hr-primary",
    block && "hr-primary--block",
    state === "pressed"  && "is-pressed",
    state === "focused"  && "is-focused",
    state === "disabled" && "is-disabled",
  ].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} disabled={state === "disabled"}
            lang={lang} dir="auto" aria-label={label}>
      <span className="hr-primary__face">
        <span className="hr-primary__label hr-label" lang={lang} dir="auto">{label}</span>
      </span>
    </button>
  );
}

/* ============================================================
   Canvas chrome
   ============================================================ */

const TONES = {
  charcoal:  "radial-gradient(120% 100% at 50% 0%, #1F2330 0%, #0E1015 70%, #07080B 100%)",
  ink:       "radial-gradient(120% 100% at 50% 0%, #1A2438 0%, #0B1120 100%)",
  felt:      "radial-gradient(120% 100% at 50% 0%, #2A1B1D 0%, #160A0C 100%)",
  parchment: "linear-gradient(180deg, #E6DFCE 0%, #D8CFB8 100%)",
};

function Backdrop({ tone = "charcoal", children, style }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: TONES[tone],
      display: "flex", alignItems: "center", justifyContent: "center",
      ...style,
    }}>{children}</div>
  );
}

function Caption({ children, dark = true, top }) {
  return (
    <div style={{
      position: "absolute",
      [top ? "top" : "bottom"]: 14,
      left: 0, right: 0, textAlign: "center",
      fontFamily: '"Frank Ruhl Libre", Georgia, serif',
      fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
      color: dark ? "rgba(236,228,208,0.55)" : "rgba(40, 36, 28, 0.55)",
      fontWeight: 500,
    }}>{children}</div>
  );
}

/* ============================================================
   Artboards
   ============================================================ */

/* Hero: the button at presentation scale */
function HeroBoard() {
  return (
    <Backdrop tone="charcoal">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
        <div style={{
          fontFamily: '"Frank Ruhl Libre", Georgia, serif',
          fontStyle: "italic", fontSize: 13,
          letterSpacing: "0.04em",
          color: "rgba(214, 179, 108, 0.85)",
          fontWeight: 500,
        }}>Secondary · Hidden Rule v2</div>
        <HRSecondary label="Continue" />
        <div style={{
          fontFamily: '"Frank Ruhl Libre", Georgia, serif',
          fontSize: 12,
          color: "rgba(236, 228, 208, 0.45)",
          textAlign: "center",
          maxWidth: 280,
          lineHeight: 1.5,
        }}>An inscribed panel · ivory hairline · matte face · no brass frame.</div>
      </div>
    </Backdrop>
  );
}

/* Single-state board with the component name tagged */
function StateBoard({ state, label = "Hint" }) {
  return (
    <Backdrop tone="charcoal">
      <HRSecondary state={state} label={label} />
      <Caption>{state}</Caption>
    </Backdrop>
  );
}

/* Label test: EN column + HE column */
function LabelsBoard() {
  return (
    <Backdrop tone="charcoal" style={{ padding: 36, gap: 28, alignItems: "flex-start" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <ColumnHeader>English</ColumnHeader>
        <HRSecondary label="Back" />
        <HRSecondary label="Hint" />
        <HRSecondary label="Cancel" />
        <HRSecondary label="Continue" />
        <HRSecondary label="View Rules" />
      </div>
      <div style={{
        width: 1, alignSelf: "stretch", marginTop: 26,
        background: "linear-gradient(180deg, transparent 0%, rgba(214,179,108,0.25) 20%, rgba(214,179,108,0.25) 80%, transparent 100%)",
      }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <ColumnHeader>עברית</ColumnHeader>
        <HRSecondary label="חזור" lang="he" />
        <HRSecondary label="רמז" lang="he" />
        <HRSecondary label="ביטול" lang="he" />
        <HRSecondary label="המשך" lang="he" />
        <HRSecondary label="חוקים" lang="he" />
      </div>
      <Caption>EN · עברית — short and medium labels</Caption>
    </Backdrop>
  );
}
function ColumnHeader({ children }) {
  return (
    <div style={{
      fontFamily: '"Frank Ruhl Libre", Georgia, serif',
      fontStyle: "italic", fontSize: 12,
      color: "rgba(214, 179, 108, 0.85)",
      fontWeight: 500, marginBottom: 6,
    }}>{children}</div>
  );
}

/* Tab-group composition — the tab-like utility selection use case */
function TabGroupBoard() {
  const [sel, setSel] = useState("basics");
  const tabs = [
    ["basics",  "Basics"],
    ["suits",   "Suits"],
    ["scoring", "Scoring"],
  ];
  return (
    <Backdrop tone="charcoal" style={{ flexDirection: "column", gap: 18, padding: 32 }}>
      <div style={{
        fontFamily: '"Frank Ruhl Libre", Georgia, serif',
        fontStyle: "italic", fontSize: 12,
        color: "rgba(214, 179, 108, 0.85)", fontWeight: 500,
      }}>Tab-like utility selection</div>
      <div style={{ display: "flex", gap: 8 }}>
        {tabs.map(([k, l]) =>
          <HRSecondary key={k} label={l} narrow
            state={sel === k ? "selected" : "idle"}
            onClick={() => setSel(k)} />)}
      </div>
      <div style={{ height: 8 }} />
      <div style={{
        fontFamily: '"Frank Ruhl Libre", Georgia, serif',
        fontStyle: "italic", fontSize: 12,
        color: "rgba(214, 179, 108, 0.85)", fontWeight: 500,
        direction: "rtl",
      }}>בחירת לשונית</div>
      <div style={{ display: "flex", gap: 8, direction: "rtl" }}>
        <HRSecondary label="יסודות"  lang="he" narrow state="selected" />
        <HRSecondary label="סמלים"   lang="he" narrow />
        <HRSecondary label="ניקוד"   lang="he" narrow />
      </div>
      <Caption>Selected · the inscribed brass underline</Caption>
    </Backdrop>
  );
}

/* Anatomy — single button with labeled callouts */
function AnatomyBoard() {
  return (
    <Backdrop tone="parchment" style={{ padding: 40 }}>
      <div style={{ position: "relative", width: 540, height: 260 }}>
        <svg viewBox="0 0 540 260" style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          pointerEvents: "none",
        }}>
          <line x1="70" y1="60" x2="180" y2="110" stroke="#5A4218" strokeWidth="0.75" />
          <circle cx="180" cy="110" r="2" fill="#8C6B2C" />
          <line x1="470" y1="60" x2="360" y2="110" stroke="#5A4218" strokeWidth="0.75" />
          <circle cx="360" cy="110" r="2" fill="#8C6B2C" />
          <line x1="60" y1="200" x2="200" y2="160" stroke="#5A4218" strokeWidth="0.75" />
          <circle cx="200" cy="160" r="2" fill="#8C6B2C" />
          <line x1="480" y1="200" x2="340" y2="160" stroke="#5A4218" strokeWidth="0.75" />
          <circle cx="340" cy="160" r="2" fill="#8C6B2C" />
        </svg>

        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
        }}>
          <div style={{ position: "relative" }}>
            <HRSecondary label="Continue" />
            <div style={{
              position: "absolute",
              top: 8, bottom: 8, left: 22, right: 22,
              border: "1px dashed rgba(140, 52, 56, 0.55)",
              borderRadius: 6,
              pointerEvents: "none",
            }} />
          </div>
        </div>

        <Tag x={10}  y={48} align="left">Ivory hairline · 1px @ 22%</Tag>
        <Tag x={530} y={48} align="right">Soft top highlight</Tag>
        <Tag x={10}  y={212} align="left">Matte face · 232631 → 15171F</Tag>
        <Tag x={530} y={212} align="right">Safe text area · 10px / 22px</Tag>
      </div>
      <Caption dark={false}>Anatomy · 48px hit target</Caption>
    </Backdrop>
  );
}
function Tag({ x, y, align, children }) {
  return (
    <div style={{
      position: "absolute",
      left: align === "left" ? x : "auto",
      right: align === "right" ? 540 - x : "auto",
      top: y, transform: "translateY(-50%)",
      fontFamily: '"Frank Ruhl Libre", Georgia, serif',
      fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
      color: "rgba(40, 36, 28, 0.78)",
      fontWeight: 500,
      whiteSpace: "nowrap",
      textAlign: align,
    }}>{children}</div>
  );
}

/* Beside the primary — hierarchy comparison */
function BesidePrimaryBoard() {
  return (
    <Backdrop tone="charcoal" style={{ flexDirection: "column", gap: 22, padding: 36 }}>
      <Row label="Primary"><HRPrimary label="Name the Rule" /></Row>
      <Row label="Secondary"><HRSecondary label="Hint" /></Row>
      <div style={{ height: 6 }} />
      <Row label="Primary"><HRPrimary label="נחש את הכלל" lang="he" /></Row>
      <Row label="Secondary"><HRSecondary label="רמז" lang="he" /></Row>
      <Caption>Hierarchy · same family, lighter weight</Caption>
    </Backdrop>
  );
}
function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, width: "100%" }}>
      <div style={{
        width: 100, textAlign: "right",
        fontFamily: '"Frank Ruhl Libre", Georgia, serif',
        fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "rgba(214, 179, 108, 0.85)",
        fontWeight: 500,
      }}>{label}</div>
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>{children}</div>
    </div>
  );
}

/* Mobile in-context — Rules screen with header back + tabs + footer */
function PhoneBoard({ rtl }) {
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
        <div dir={rtl ? "rtl" : undefined} lang={rtl ? "he" : undefined} style={{
          width: "100%", height: "100%",
          borderRadius: 30,
          background:
            "radial-gradient(80% 50% at 50% 18%, rgba(40, 56, 96, 0.25) 0%, transparent 70%), " +
            "linear-gradient(180deg, #161019 0%, #0B0810 100%)",
          padding: "26px 22px 24px",
          display: "flex", flexDirection: "column",
          fontFamily: '"Frank Ruhl Libre", Georgia, serif',
        }}>
          {/* Header: Back + title */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <HRSecondary label={rtl ? "חזור" : "Back"} lang={rtl ? "he" : undefined} narrow />
            <div style={{
              fontSize: 11, letterSpacing: rtl ? "0.05em" : "0.30em",
              textTransform: rtl ? "none" : "uppercase",
              color: "rgba(214, 179, 108, 0.85)", fontWeight: 500,
            }}>{rtl ? "חוקים" : "Rules"}</div>
            <div style={{ width: 80 }} />
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
            <HRSecondary label={rtl ? "יסודות" : "Basics"} lang={rtl ? "he" : undefined} narrow state="selected" />
            <HRSecondary label={rtl ? "סמלים"  : "Suits"}  lang={rtl ? "he" : undefined} narrow />
            <HRSecondary label={rtl ? "ניקוד"  : "Scoring"} lang={rtl ? "he" : undefined} narrow />
          </div>

          {/* Body */}
          <div style={{
            flex: 1,
            fontSize: 15, lineHeight: 1.55,
            color: "rgba(236, 228, 208, 0.78)",
          }}>
            {rtl ? (
              <React.Fragment>
                <p style={{ marginTop: 0 }}>בכל פרק חבוי כלל אחד שקובע את סדר הקלפים.</p>
                <p>תוכל לבקש רמז, אך כל רמז מסמן את הדף.</p>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <p style={{ marginTop: 0 }}>Each chapter conceals a single rule that governs the order of the cards.</p>
                <p>You may request a hint, but every hint marks the page.</p>
              </React.Fragment>
            )}
          </div>

          {/* Footer: secondary + primary */}
          <div style={{ display: "flex", gap: 10 }}>
            <HRSecondary label={rtl ? "רמז" : "Hint"} lang={rtl ? "he" : undefined} block />
            <div style={{ flex: 1 }}>
              <HRPrimary label={rtl ? "המשך" : "Continue"} lang={rtl ? "he" : undefined} block />
            </div>
          </div>
        </div>
      </div>
      <Caption>{rtl ? "עברית · RTL" : "English"} · with the primary</Caption>
    </Backdrop>
  );
}

/* ============================================================
   App / canvas
   ============================================================ */

function App() {
  return (
    <DesignCanvas storageKey="hidden-rule-secondary-final">

      <DCSection id="hero" title="The secondary button">
        <DCArtboard id="hero" label="Idle · presentation" width={520} height={360}>
          <HeroBoard />
        </DCArtboard>
        <DCArtboard id="anatomy" label="Anatomy & safe area" width={620} height={360}>
          <AnatomyBoard />
        </DCArtboard>
      </DCSection>

      <DCSection id="states" title="States">
        <DCArtboard id="st-idle"     label="Idle"     width={320} height={200}>
          <StateBoard state="idle"     label="Hint" />
        </DCArtboard>
        <DCArtboard id="st-pressed"  label="Pressed"  width={320} height={200}>
          <StateBoard state="pressed"  label="Hint" />
        </DCArtboard>
        <DCArtboard id="st-focused"  label="Focused"  width={320} height={200}>
          <StateBoard state="focused"  label="Hint" />
        </DCArtboard>
        <DCArtboard id="st-selected" label="Selected" width={320} height={200}>
          <StateBoard state="selected" label="Rules" />
        </DCArtboard>
        <DCArtboard id="st-disabled" label="Disabled" width={320} height={200}>
          <StateBoard state="disabled" label="Hint" />
        </DCArtboard>
      </DCSection>

      <DCSection id="labels" title="Labels · EN + עברית">
        <DCArtboard id="labels"   label="Short & medium" width={520} height={460}>
          <LabelsBoard />
        </DCArtboard>
        <DCArtboard id="tabs"     label="Tab-like utility selection" width={460} height={460}>
          <TabGroupBoard />
        </DCArtboard>
      </DCSection>

      <DCSection id="hierarchy" title="With the primary">
        <DCArtboard id="beside"   label="Beside the primary" width={520} height={420}>
          <BesidePrimaryBoard />
        </DCArtboard>
      </DCSection>

      <DCSection id="context" title="In context · mobile">
        <DCArtboard id="phone-en" label="English · Rules screen" width={420} height={760}>
          <PhoneBoard />
        </DCArtboard>
        <DCArtboard id="phone-he" label="Hebrew · Rules screen (RTL)" width={420} height={760}>
          <PhoneBoard rtl />
        </DCArtboard>
      </DCSection>

    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
