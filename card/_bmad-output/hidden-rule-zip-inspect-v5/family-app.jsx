/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard */
const { useState } = React;

/* ============================================================
   Components
   ============================================================ */

function HRPrimary({ label = "Continue", state = "idle", block, lang, onClick }) {
  const cls = [
    "hr-primary",
    block && "hr-primary--block",
    state === "pressed"  && "is-pressed",
    state === "focused"  && "is-focused",
    state === "disabled" && "is-disabled",
  ].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} disabled={state === "disabled"}
            onClick={onClick} lang={lang} dir="auto" aria-label={label}>
      <span className="hr-primary__face">
        <span className="hr-primary__label hr-label" lang={lang} dir="auto">{label}</span>
      </span>
    </button>
  );
}

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

function HRPremium({ label = "Begin Chapter", state = "idle", block, lang, onClick }) {
  const cls = [
    "hr-premium",
    block && "hr-premium--block",
    state === "pressed"  && "is-pressed",
    state === "focused"  && "is-focused",
    state === "disabled" && "is-disabled",
  ].filter(Boolean).join(" ");
  return (
    <button type="button" className={cls} disabled={state === "disabled"}
            onClick={onClick} lang={lang} dir="auto" aria-label={label}>
      <span className="hr-premium__face">
        <span className="hr-premium__label hr-label" lang={lang} dir="auto">{label}</span>
      </span>
    </button>
  );
}

/* ============================================================
   Canvas chrome / artboard utilities
   ============================================================ */

const TONES = {
  charcoal: "radial-gradient(120% 100% at 50% 0%, #1F2330 0%, #0E1015 70%, #07080B 100%)",
  ink:      "radial-gradient(120% 100% at 50% 0%, #1A2438 0%, #0B1120 100%)",
  felt:     "radial-gradient(120% 100% at 50% 0%, #2A1B1D 0%, #160A0C 100%)",
  parchment:"linear-gradient(180deg, #E6DFCE 0%, #D8CFB8 100%)",
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

function ComponentTag({ name, dark = true }) {
  return (
    <div style={{
      position: "absolute", top: 14, left: 0, right: 0, textAlign: "center",
      fontFamily: '"Frank Ruhl Libre", Georgia, serif',
      fontStyle: "italic",
      fontSize: 12,
      color: dark ? "rgba(214, 179, 108, 0.85)" : "rgba(140, 107, 44, 0.85)",
      fontWeight: 500,
      letterSpacing: "0.04em",
    }}>{name}</div>
  );
}

/* ============================================================
   Artboards
   ============================================================ */

/* System overview: the hero shot — all three buttons together */
function SystemOverviewArtboard() {
  return (
    <Backdrop tone="charcoal" style={{ flexDirection: "column", gap: 28, padding: 44 }}>
      <Row label="Premium ceremonial">
        <HRPremium label="Begin Chapter Three" />
      </Row>
      <Row label="Primary">
        <HRPrimary label="Name the Rule" />
      </Row>
      <Row label="Secondary">
        <div style={{ display: "flex", gap: 12 }}>
          <HRSecondary label="Hint" />
          <HRSecondary label="Rules" state="selected" />
          <HRSecondary label="Back" narrow />
        </div>
      </Row>
      <Caption>The family · primary · secondary · premium</Caption>
    </Backdrop>
  );
}
function Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, width: "100%" }}>
      <div style={{
        width: 152, textAlign: "right",
        fontFamily: '"Frank Ruhl Libre", Georgia, serif',
        fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "rgba(214, 179, 108, 0.85)",
        fontWeight: 500,
      }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

/* State artboard — single button at a given state */
function StateBoard({ Component, state, label, tone = "charcoal", componentName }) {
  return (
    <Backdrop tone={tone}>
      <ComponentTag name={componentName} />
      <Component state={state} label={label} />
      <Caption>{state}</Caption>
    </Backdrop>
  );
}

/* Label-length test for one component, EN + HE */
function LabelLengthsBoard({ Component, name }) {
  return (
    <Backdrop tone="charcoal" style={{ flexDirection: "column", gap: 14, padding: 30, paddingTop: 44 }}>
      <ComponentTag name={name} />
      <Component label="Play" />
      <Component label="Continue" />
      <Component label="Name the Rule" />
      <Component label="Reveal the Hidden Rule" />
      <div style={{ height: 8 }} />
      <Component label="שחק" lang="he" />
      <Component label="המשך" lang="he" />
      <Component label="נחש את הכלל" lang="he" />
      <Caption>short → long · EN + HE</Caption>
    </Backdrop>
  );
}

/* Bilingual side-by-side */
function BilingualBoard() {
  return (
    <Backdrop tone="charcoal" style={{ flexDirection: "column", gap: 26, padding: 36 }}>
      <BilingualRow label="Premium">
        <HRPremium label="Begin Chapter Three" />
        <HRPremium label="התחל פרק שלוש" lang="he" />
      </BilingualRow>
      <BilingualRow label="Primary">
        <HRPrimary label="Name the Rule" />
        <HRPrimary label="נחש את הכלל" lang="he" />
      </BilingualRow>
      <BilingualRow label="Secondary">
        <HRSecondary label="Hint" />
        <HRSecondary label="רמז" lang="he" />
      </BilingualRow>
      <Caption>English · עברית</Caption>
    </Backdrop>
  );
}
function BilingualRow({ label, children }) {
  return (
    <div style={{ width: "100%" }}>
      <div style={{
        textAlign: "center", marginBottom: 8,
        fontFamily: '"Frank Ruhl Libre", Georgia, serif',
        fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "rgba(214, 179, 108, 0.65)", fontWeight: 500,
      }}>{label}</div>
      <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" }}>
        {children}
      </div>
    </div>
  );
}

/* Phone in-context — EN */
function PhoneEN() {
  return (
    <Backdrop tone="charcoal" style={{ padding: 40 }}>
      <PhoneShell>
        <div style={{
          fontFamily: '"Frank Ruhl Libre", Georgia, serif',
          fontSize: 11, letterSpacing: "0.30em", textTransform: "uppercase",
          color: "rgba(214, 179, 108, 0.85)",
          textAlign: "center", marginBottom: 4, fontWeight: 500,
        }}>Chapter II</div>
        <div style={{
          fontFamily: '"Frank Ruhl Libre", Georgia, serif',
          fontSize: 26, fontWeight: 500, fontStyle: "italic",
          color: "#ECE4D0", textAlign: "center",
        }}>The Quiet Order</div>

        <CardCluster />

        <div style={{
          fontFamily: '"Frank Ruhl Libre", Georgia, serif',
          fontStyle: "italic", fontSize: 14,
          color: "rgba(236, 228, 208, 0.65)",
          textAlign: "center", marginBottom: 18,
        }}>Three cards form a sequence only one rule explains.</div>

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <HRSecondary label="Hint" block />
          <HRSecondary label="Pass" block />
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <HRPrimary label="Name the Rule" block />
        </div>
      </PhoneShell>
      <Caption>English · in context</Caption>
    </Backdrop>
  );
}

/* Phone in-context — HE / RTL */
function PhoneHE() {
  return (
    <Backdrop tone="charcoal" style={{ padding: 40 }}>
      <PhoneShell dir="rtl" lang="he">
        <div style={{
          fontFamily: '"Frank Ruhl Libre", Georgia, serif',
          fontSize: 12, color: "rgba(214, 179, 108, 0.85)",
          textAlign: "center", marginBottom: 4, fontWeight: 500,
          letterSpacing: "0.05em",
        }}>פרק שני</div>
        <div style={{
          fontFamily: '"Frank Ruhl Libre", Georgia, serif',
          fontSize: 26, fontWeight: 500, fontStyle: "italic",
          color: "#ECE4D0", textAlign: "center",
        }}>הסדר השקט</div>

        <CardCluster />

        <div style={{
          fontFamily: '"Frank Ruhl Libre", Georgia, serif',
          fontStyle: "italic", fontSize: 14,
          color: "rgba(236, 228, 208, 0.65)",
          textAlign: "center", marginBottom: 18,
        }}>שלושה קלפים יוצרים רצף שכלל אחד מסביר.</div>

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <HRSecondary label="רמז" lang="he" block />
          <HRSecondary label="דלג" lang="he" block />
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <HRPrimary label="נחש את הכלל" lang="he" block />
        </div>
      </PhoneShell>
      <Caption>עברית · in context (RTL)</Caption>
    </Backdrop>
  );
}

/* Premium-tier moment: chapter-intro screen using HRPremium */
function PhonePremium() {
  return (
    <Backdrop tone="charcoal" style={{ padding: 40 }}>
      <PhoneShell>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <div style={{
            width: 56, height: 1,
            background: "linear-gradient(90deg, transparent, #8C6B2C, transparent)",
          }} />
          <div style={{
            fontFamily: '"Frank Ruhl Libre", Georgia, serif',
            fontSize: 12, letterSpacing: "0.32em", textTransform: "uppercase",
            color: "rgba(214, 179, 108, 0.85)", fontWeight: 500,
          }}>Chapter Three</div>
          <div style={{
            fontFamily: '"Frank Ruhl Libre", Georgia, serif',
            fontSize: 34, fontWeight: 500, fontStyle: "italic",
            color: "#ECE4D0", textAlign: "center", lineHeight: 1.15,
            padding: "0 8px",
          }}>Of Shadows<br/>and Reciprocity</div>
          <div style={{
            width: 56, height: 1,
            background: "linear-gradient(90deg, transparent, #8C6B2C, transparent)",
          }} />
          <div style={{
            fontFamily: '"Frank Ruhl Libre", Georgia, serif',
            fontStyle: "italic", fontSize: 14,
            color: "rgba(236, 228, 208, 0.55)",
            textAlign: "center", padding: "0 18px",
          }}>The deck remembers what you offered.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <HRPremium label="Begin Chapter" block />
          <HRSecondary label="Read Rules" block />
        </div>
      </PhoneShell>
      <Caption>Premium · ceremonial moment</Caption>
    </Backdrop>
  );
}

function PhoneShell({ children, dir, lang }) {
  return (
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
      <div dir={dir} lang={lang} style={{
        width: "100%", height: "100%",
        borderRadius: 30,
        background:
          "radial-gradient(80% 50% at 50% 18%, rgba(40, 56, 96, 0.30) 0%, transparent 70%), " +
          "linear-gradient(180deg, #161019 0%, #0B0810 100%)",
        padding: "32px 22px 24px",
        display: "flex", flexDirection: "column",
      }}>{children}</div>
    </div>
  );
}

function CardCluster() {
  return (
    <div style={{
      flex: 1, marginTop: 20,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative",
    }}>
      <CardPlaceholder rotate={-8} dx={-44} suit="◆" />
      <CardPlaceholder rotate={0} dx={0} suit="✦" highlight />
      <CardPlaceholder rotate={8} dx={44} suit="◇" />
    </div>
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
      fontFamily: '"Frank Ruhl Libre", Georgia, serif',
      fontSize: 32,
      color: highlight ? "#6E2A2E" : "#D6B36C",
    }}>{suit}</div>
  );
}

/* Playground */
function PlaygroundBoard() {
  const [label, setLabel] = useState("Name the Rule");
  const [comp, setComp] = useState("primary");
  const [state, setState] = useState("idle");
  const [lang, setLang] = useState("en");
  const [tone, setTone] = useState("charcoal");

  const comps = [["primary","Primary"],["secondary","Secondary"],["premium","Premium"]];
  const states = comp === "secondary"
    ? ["idle","pressed","focused","selected","disabled"]
    : ["idle","pressed","focused","disabled"];
  const langs = [["en","English"],["he","עברית"]];
  const tones = [["charcoal","Charcoal"],["ink","Ink"],["felt","Oxblood"],["parchment","Parchment"]];

  function setLangSmart(v) {
    setLang(v);
    if (v === "he" && /^[A-Za-z ]+$/.test(label)) {
      setLabel(comp === "premium" ? "התחל פרק שלוש" : comp === "secondary" ? "רמז" : "נחש את הכלל");
    }
    if (v === "en" && /[\u0590-\u05FF]/.test(label)) {
      setLabel(comp === "premium" ? "Begin Chapter" : comp === "secondary" ? "Hint" : "Name the Rule");
    }
  }
  function setCompSmart(v) {
    setComp(v);
    if (state === "selected" && v !== "secondary") setState("idle");
  }

  const Component = comp === "primary" ? HRPrimary : comp === "secondary" ? HRSecondary : HRPremium;

  return (
    <Backdrop tone={tone} style={{ flexDirection: "column", padding: 28 }}>
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        width: "100%",
      }}>
        <Component label={label} state={state} lang={lang} />
      </div>
      <div style={{
        background: "rgba(20, 18, 14, 0.78)",
        backdropFilter: "blur(6px)",
        border: "1px solid rgba(214, 179, 108, 0.35)",
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex", flexDirection: "column", gap: 10,
        width: "100%", maxWidth: 540,
      }}>
        <PRow title="Label">
          <input value={label} onChange={e => setLabel(e.target.value)} maxLength={48}
                 style={INPUT_STYLE} />
        </PRow>
        <PRow title="Component">
          <Seg options={comps} value={comp} onChange={setCompSmart} />
        </PRow>
        <PRow title="State">
          <Seg options={states.map(s => [s, s])} value={state} onChange={setState} />
        </PRow>
        <PRow title="Lang">
          <Seg options={langs} value={lang} onChange={setLangSmart} />
        </PRow>
        <PRow title="Backdrop">
          <Seg options={tones} value={tone} onChange={setTone} />
        </PRow>
      </div>
    </Backdrop>
  );
}

const INPUT_STYLE = {
  flex: 1,
  background: "rgba(0,0,0,0.4)",
  border: "1px solid rgba(214, 179, 108, 0.35)",
  borderRadius: 6,
  color: "#ECE4D0",
  fontFamily: '"Frank Ruhl Libre", Georgia, serif',
  fontSize: 14,
  padding: "6px 10px",
  outline: "none",
};
function PRow({ title, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 84,
        fontFamily: '"Frank Ruhl Libre", Georgia, serif',
        fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
        color: "rgba(214, 179, 108, 0.85)",
        fontWeight: 500,
      }}>{title}</div>
      <div style={{ flex: 1, display: "flex" }}>{children}</div>
    </div>
  );
}
function Seg({ options, value, onChange }) {
  return (
    <div style={{
      display: "flex", flex: 1, gap: 0,
      border: "1px solid rgba(214, 179, 108, 0.35)",
      borderRadius: 6, overflow: "hidden",
      background: "rgba(0,0,0,0.4)",
    }}>
      {options.map(([k, label], i) => (
        <button key={k} onClick={() => onChange(k)} style={{
          flex: 1,
          background: value === k ? "rgba(214, 179, 108, 0.22)" : "transparent",
          border: 0,
          borderLeft: i === 0 ? "0" : "1px solid rgba(214, 179, 108, 0.25)",
          color: value === k ? "#ECE4D0" : "rgba(236, 228, 208, 0.55)",
          fontFamily: '"Frank Ruhl Libre", Georgia, serif',
          fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
          padding: "7px 4px",
          cursor: "pointer", fontWeight: 500,
        }}>{label}</button>
      ))}
    </div>
  );
}

/* ============================================================
   Implementation-safety examples (v2.1 robustness pass)
   ============================================================ */

/* A simulated narrow mobile container — 240px wide, the kind of
   constraint that breaks naive button layouts. */
function NarrowFrame({ children, width = 240, padding = 16 }) {
  return (
    <div style={{
      width, padding,
      borderRadius: 14,
      background: "linear-gradient(180deg, #161019 0%, #0B0810 100%)",
      boxShadow: "inset 0 0 0 1px rgba(214, 179, 108, 0.25)",
      display: "flex", flexDirection: "column", gap: 10,
    }}>{children}</div>
  );
}

function NarrowBlocksBoard() {
  return (
    <Backdrop tone="charcoal" style={{ flexDirection: "column", gap: 14, padding: 28 }}>
      <Caption top>Narrow mobile · 240px container · all 3 as block</Caption>
      <NarrowFrame>
        <HRPremium   label="Begin Chapter Three" block />
        <HRPrimary   label="Name the Rule" block />
        <HRSecondary label="Hint" block />
      </NarrowFrame>
      <div style={{
        fontFamily: '"Frank Ruhl Libre", Georgia, serif',
        fontSize: 12, fontStyle: "italic",
        color: "rgba(236, 228, 208, 0.55)",
        textAlign: "center", maxWidth: 280, lineHeight: 1.5,
      }}>Block buttons clear their min-width inside narrow containers — no overflow.</div>
    </Backdrop>
  );
}

function SideBySideBoard() {
  return (
    <Backdrop tone="charcoal" style={{ flexDirection: "column", gap: 18, padding: 28 }}>
      <Caption top>Two secondary blocks side by side</Caption>
      <NarrowFrame width={280}>
        <div style={{ display: "flex", gap: 10 }}>
          <HRSecondary label="Hint" block />
          <HRSecondary label="Pass" block />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <HRSecondary label="חזור" lang="he" block />
          <HRSecondary label="ביטול" lang="he" block />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <HRSecondary label="Hint" block />
          <HRPrimary   label="Continue" block />
        </div>
      </NarrowFrame>
      <div style={{
        fontFamily: '"Frank Ruhl Libre", Georgia, serif',
        fontSize: 12, fontStyle: "italic",
        color: "rgba(236, 228, 208, 0.55)",
        textAlign: "center", maxWidth: 280, lineHeight: 1.5,
      }}>Each block flex-item gets min-width:0, so they share the row evenly.</div>
    </Backdrop>
  );
}

function SelectedFocusedBoard() {
  return (
    <Backdrop tone="charcoal" style={{ flexDirection: "column", gap: 22, padding: 32 }}>
      <Caption top>Selected + focused = additive, not overwritten</Caption>
      <Row label="Idle">
        <HRSecondary label="Rules" />
      </Row>
      <Row label="Selected">
        <HRSecondary label="Rules" state="selected" />
      </Row>
      <Row label="Focused">
        <HRSecondary label="Rules" state="focused" />
      </Row>
      <Row label="Both">
        <SelectedAndFocused label="Rules" />
      </Row>
      <Row label="Both · עברית">
        <SelectedAndFocused label="יסודות" lang="he" />
      </Row>
      <div style={{
        fontFamily: '"Frank Ruhl Libre", Georgia, serif',
        fontSize: 12, fontStyle: "italic",
        color: "rgba(236, 228, 208, 0.55)",
        textAlign: "center", maxWidth: 380, lineHeight: 1.5,
      }}>The inscribed brass underline stays visible while the outer oxblood focus ring layers on top.</div>
    </Backdrop>
  );
}
/* Helper: combines is-selected + is-focused so we can demo accessibility */
function SelectedAndFocused({ label, lang }) {
  return (
    <button type="button"
      className="hr-secondary is-selected is-focused"
      aria-pressed={true} aria-label={label}
      lang={lang} dir="auto">
      <span className="hr-secondary__label hr-label" lang={lang} dir="auto">{label}</span>
    </button>
  );
}

function LongLabelBoard() {
  return (
    <Backdrop tone="charcoal" style={{ flexDirection: "column", gap: 12, padding: 24 }}>
      <Caption top>Long-label rule · single line → wrap to 2 → ellipsis</Caption>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", marginTop: 8 }}>
        <SmallLabel>Short (one line)</SmallLabel>
        <HRPrimary label="Continue" />
        <SmallLabel>Medium (one line)</SmallLabel>
        <HRPrimary label="Name the Rule" />
        <SmallLabel>Long (wraps to 2 lines)</SmallLabel>
        <HRPrimary label="Reveal the Hidden Rule" />
        <SmallLabel>Very long (2 lines, then ellipsis)</SmallLabel>
        <HRPrimary label="Reveal the Hidden Rule of Chapter Three" />
        <div style={{ height: 6 }} />
        <SmallLabel>עברית · קצר</SmallLabel>
        <HRPrimary label="המשך" lang="he" />
        <SmallLabel>עברית · בינוני</SmallLabel>
        <HRPrimary label="נחש את הכלל" lang="he" />
        <SmallLabel>עברית · ארוך</SmallLabel>
        <HRPrimary label="נחש את הכלל החבוי בפרק שלוש" lang="he" />
      </div>
    </Backdrop>
  );
}
function SmallLabel({ children }) {
  return (
    <div style={{
      fontFamily: '"Frank Ruhl Libre", Georgia, serif',
      fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase",
      color: "rgba(214, 179, 108, 0.65)",
      fontWeight: 500,
    }}>{children}</div>
  );
}

/* ============================================================
   App / canvas layout
   ============================================================ */

function App() {
  return (
    <DesignCanvas storageKey="hidden-rule-family-v2-1">

      <DCSection id="safety" title="Implementation safety (v2.1)">
        <DCArtboard id="narrow" label="Narrow mobile · block buttons" width={360} height={460}>
          <NarrowBlocksBoard />
        </DCArtboard>
        <DCArtboard id="sidebyside" label="Side-by-side blocks" width={400} height={460}>
          <SideBySideBoard />
        </DCArtboard>
        <DCArtboard id="selfoc" label="Selected + focused" width={480} height={500}>
          <SelectedFocusedBoard />
        </DCArtboard>
        <DCArtboard id="long" label="Long labels · EN + HE" width={400} height={760}>
          <LongLabelBoard />
        </DCArtboard>
      </DCSection>

      <DCSection id="system" title="The system">
        <DCArtboard id="overview" label="All three together" width={620} height={460}>
          <SystemOverviewArtboard />
        </DCArtboard>
        <DCArtboard id="bilingual" label="English + עברית" width={620} height={460}>
          <BilingualBoard />
        </DCArtboard>
      </DCSection>

      <DCSection id="primary-states" title="Primary · states">
        <DCArtboard id="p-idle"     label="Idle"     width={340} height={220}>
          <StateBoard Component={HRPrimary} state="idle"     label="Continue" componentName="Primary" />
        </DCArtboard>
        <DCArtboard id="p-pressed"  label="Pressed"  width={340} height={220}>
          <StateBoard Component={HRPrimary} state="pressed"  label="Continue" componentName="Primary" />
        </DCArtboard>
        <DCArtboard id="p-focused"  label="Focused"  width={340} height={220}>
          <StateBoard Component={HRPrimary} state="focused"  label="Continue" componentName="Primary" />
        </DCArtboard>
        <DCArtboard id="p-disabled" label="Disabled" width={340} height={220}>
          <StateBoard Component={HRPrimary} state="disabled" label="Continue" componentName="Primary" />
        </DCArtboard>
      </DCSection>

      <DCSection id="secondary-states" title="Secondary · states (incl. selected)">
        <DCArtboard id="s-idle"     label="Idle"     width={300} height={200}>
          <StateBoard Component={HRSecondary} state="idle"     label="Hint" componentName="Secondary" />
        </DCArtboard>
        <DCArtboard id="s-pressed"  label="Pressed"  width={300} height={200}>
          <StateBoard Component={HRSecondary} state="pressed"  label="Hint" componentName="Secondary" />
        </DCArtboard>
        <DCArtboard id="s-focused"  label="Focused"  width={300} height={200}>
          <StateBoard Component={HRSecondary} state="focused"  label="Hint" componentName="Secondary" />
        </DCArtboard>
        <DCArtboard id="s-selected" label="Selected" width={300} height={200}>
          <StateBoard Component={HRSecondary} state="selected" label="Rules" componentName="Secondary" />
        </DCArtboard>
        <DCArtboard id="s-disabled" label="Disabled" width={300} height={200}>
          <StateBoard Component={HRSecondary} state="disabled" label="Hint" componentName="Secondary" />
        </DCArtboard>
      </DCSection>

      <DCSection id="premium-states" title="Premium ceremonial · states">
        <DCArtboard id="pr-idle"     label="Idle"     width={380} height={240}>
          <StateBoard Component={HRPremium} state="idle"     label="Begin Chapter" componentName="Premium" />
        </DCArtboard>
        <DCArtboard id="pr-pressed"  label="Pressed"  width={380} height={240}>
          <StateBoard Component={HRPremium} state="pressed"  label="Begin Chapter" componentName="Premium" />
        </DCArtboard>
        <DCArtboard id="pr-focused"  label="Focused"  width={380} height={240}>
          <StateBoard Component={HRPremium} state="focused"  label="Begin Chapter" componentName="Premium" />
        </DCArtboard>
        <DCArtboard id="pr-disabled" label="Disabled" width={380} height={240}>
          <StateBoard Component={HRPremium} state="disabled" label="Begin Chapter" componentName="Premium" />
        </DCArtboard>
      </DCSection>

      <DCSection id="lengths" title="Label lengths · EN + HE">
        <DCArtboard id="len-primary"   label="Primary"   width={360} height={620}>
          <LabelLengthsBoard Component={HRPrimary}   name="Primary" />
        </DCArtboard>
        <DCArtboard id="len-secondary" label="Secondary" width={340} height={560}>
          <LabelLengthsBoard Component={HRSecondary} name="Secondary" />
        </DCArtboard>
        <DCArtboard id="len-premium"   label="Premium"   width={380} height={660}>
          <LabelLengthsBoard Component={HRPremium}   name="Premium" />
        </DCArtboard>
      </DCSection>

      <DCSection id="context" title="In context · mobile">
        <DCArtboard id="phone-en"      label="English · puzzle screen" width={420} height={760}>
          <PhoneEN />
        </DCArtboard>
        <DCArtboard id="phone-he"      label="Hebrew · puzzle screen"  width={420} height={760}>
          <PhoneHE />
        </DCArtboard>
        <DCArtboard id="phone-premium" label="Premium · chapter intro" width={420} height={760}>
          <PhonePremium />
        </DCArtboard>
      </DCSection>

      <DCSection id="playground" title="Playground">
        <DCArtboard id="play" label="Live · component + state + lang" width={580} height={600}>
          <PlaygroundBoard />
        </DCArtboard>
      </DCSection>

    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
