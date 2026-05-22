/* global React, DCSection, DCArtboard */
/* canvas-app-v2.jsx — v2 components + sections, exported to window */

const { useState: useStateV2 } = React;

/* ------------------------------------------------------------------ */
/*  HRPrimaryV2 — three variants in one component                     */
/* ------------------------------------------------------------------ */
function HRPrimaryV2({
  label = "Play",
  variant = "refined",        // "refined" | "minimal" | "premium"
  state = "idle",             // "idle" | "pressed" | "focused" | "disabled"
  block = false,
  lang,                       // e.g. "en", "he"
  onClick,
}) {
  const base =
    variant === "minimal" ? "hr-btn-minimal" :
    variant === "premium" ? "hr-btn-premium" :
                            "hr-btn-refined";

  const cls = [
    base,
    block && `${base}--block`,
    state === "pressed"  && "is-pressed",
    state === "focused"  && "is-focused",
    state === "disabled" && "is-disabled",
  ].filter(Boolean).join(" ");

  const labelEl = (
    <span
      className={`${base}__label hr-btn-v2-label`}
      lang={lang}
      dir="auto"
    >{label}</span>
  );

  // Minimal has no face wrapper — it's a single inscribed panel.
  if (variant === "minimal") {
    return (
      <button
        type="button"
        className={cls}
        disabled={state === "disabled"}
        onClick={onClick}
        lang={lang}
        dir="auto"
        aria-label={label}
      >{labelEl}</button>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      disabled={state === "disabled"}
      onClick={onClick}
      lang={lang}
      dir="auto"
      aria-label={label}
    >
      <span className={`${base}__face`}>{labelEl}</span>
    </button>
  );
}
window.HRPrimaryV2 = HRPrimaryV2;

/* ------------------------------------------------------------------ */
/*  Local helpers (use globals from canvas-app.jsx if available)      */
/* ------------------------------------------------------------------ */
const V2_BACKDROPS = {
  parchment: "linear-gradient(180deg, #E6DFCE 0%, #D8CFB8 100%)",
  charcoal:  "radial-gradient(120% 100% at 50% 0%, #1F2330 0%, #0E1015 70%, #07080B 100%)",
  ink:       "radial-gradient(120% 100% at 50% 0%, #1A2438 0%, #0B1120 100%)",
  felt:      "radial-gradient(120% 100% at 50% 0%, #2A1B1D 0%, #160A0C 100%)",
};

function V2Backdrop({ tone = "charcoal", children, style }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      background: V2_BACKDROPS[tone],
      display: "flex", alignItems: "center", justifyContent: "center",
      ...style,
    }}>{children}</div>
  );
}

function V2Caption({ children, dark = true }) {
  return (
    <div style={{
      position: "absolute", bottom: 14, left: 0, right: 0,
      textAlign: "center",
      fontFamily: '"Frank Ruhl Libre", "Cormorant Garamond", Georgia, serif',
      fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
      color: dark ? "rgba(236,228,208,0.55)" : "rgba(40, 36, 28, 0.55)",
      fontWeight: 500,
    }}>{children}</div>
  );
}

/* ------------------------------------------------------------------ */
/*  Artboards                                                          */
/* ------------------------------------------------------------------ */
function V2StateArtboard({ variant, state, label = "Continue", tone = "charcoal" }) {
  return (
    <V2Backdrop tone={tone}>
      <HRPrimaryV2 variant={variant} state={state} label={label} />
      <V2Caption>{state}</V2Caption>
    </V2Backdrop>
  );
}

/* Three-variant comparison */
function V2ComparisonArtboard({ label = "Name the Rule", lang, tone = "charcoal" }) {
  return (
    <V2Backdrop tone={tone} style={{ flexDirection: "column", gap: 22, padding: 36 }}>
      <V2Row label="A · Refined">
        <HRPrimaryV2 variant="refined" label={label} lang={lang} />
      </V2Row>
      <V2Row label="B · Minimal">
        <HRPrimaryV2 variant="minimal" label={label} lang={lang} />
      </V2Row>
      <V2Row label="C · Premium">
        <HRPrimaryV2 variant="premium" label={label} lang={lang} />
      </V2Row>
      <V2Caption>Side by side · {lang === "he" ? "Hebrew" : "English"}</V2Caption>
    </V2Backdrop>
  );
}
function V2Row({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, width: "100%" }}>
      <div style={{
        width: 92, textAlign: "right",
        fontFamily: '"Frank Ruhl Libre", Georgia, serif',
        fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "rgba(214, 179, 108, 0.85)",
        fontWeight: 500,
      }}>{label}</div>
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>{children}</div>
    </div>
  );
}

/* Label lengths + bilingual */
function V2LabelLengthsArtboard({ variant }) {
  return (
    <V2Backdrop tone="charcoal" style={{ flexDirection: "column", gap: 16, padding: 28 }}>
      <HRPrimaryV2 variant={variant} label="Play" />
      <HRPrimaryV2 variant={variant} label="Submit" />
      <HRPrimaryV2 variant={variant} label="Name the Rule" />
      <HRPrimaryV2 variant={variant} label="Begin Chapter Three" />
      <div style={{ height: 6 }} />
      <HRPrimaryV2 variant={variant} label="שחק" lang="he" />
      <HRPrimaryV2 variant={variant} label="המשך" lang="he" />
      <HRPrimaryV2 variant={variant} label="נחש את הכלל" lang="he" />
      <V2Caption>{variant} · EN + HE · short → long</V2Caption>
    </V2Backdrop>
  );
}

/* Hebrew phone in context */
function V2HebrewPhoneArtboard({ variant = "refined" }) {
  return (
    <V2Backdrop tone="charcoal" style={{ padding: 40 }}>
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
        <div dir="rtl" lang="he" style={{
          width: "100%", height: "100%",
          borderRadius: 30,
          background:
            "radial-gradient(80% 50% at 50% 18%, rgba(40, 56, 96, 0.32) 0%, transparent 70%), " +
            "linear-gradient(180deg, #161019 0%, #0B0810 100%)",
          padding: "32px 24px 28px",
          display: "flex", flexDirection: "column",
          position: "relative",
          fontFamily: '"Frank Ruhl Libre", Georgia, serif',
        }}>
          <div style={{
            fontSize: 12,
            color: "rgba(214, 179, 108, 0.85)",
            textAlign: "center", marginBottom: 4, fontWeight: 500,
            letterSpacing: "0.05em",
          }}>פרק שני</div>
          <div style={{
            fontSize: 26, fontWeight: 500, fontStyle: "italic",
            color: "#ECE4D0", textAlign: "center",
          }}>הסדר השקט</div>

          <div style={{
            flex: 1, marginTop: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            <V2Card rotate={-8} dx={-44} suit="◆" />
            <V2Card rotate={0} dx={0} suit="✦" highlight />
            <V2Card rotate={8} dx={44} suit="◇" />
          </div>

          <div style={{
            fontStyle: "italic", fontSize: 14,
            color: "rgba(236, 228, 208, 0.65)",
            textAlign: "center", marginBottom: 18,
          }}>שלושה קלפים יוצרים רצף שכלל אחד מסביר.</div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <HRPrimaryV2 variant={variant} label="נחש את הכלל" lang="he" />
          </div>
        </div>
      </div>
      <V2Caption>RTL · נחש את הכלל</V2Caption>
    </V2Backdrop>
  );
}
function V2Card({ rotate, dx, suit, highlight }) {
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
function V2PlaygroundArtboard() {
  const [label, setLabel] = useStateV2("Name the Rule");
  const [variant, setVariant] = useStateV2("refined");
  const [state, setState] = useStateV2("idle");
  const [tone, setTone] = useStateV2("charcoal");
  const [lang, setLang] = useStateV2("en");

  const stateOptions   = ["idle", "pressed", "focused", "disabled"];
  const variantOptions = [["refined","Refined"],["minimal","Minimal"],["premium","Premium"]];
  const toneOptions    = [["parchment","Parchment"],["charcoal","Charcoal"],["ink","Ink"],["felt","Oxblood"]];
  const langOptions    = [["en","English"],["he","עברית"]];

  // Quick presets to seed Hebrew on lang switch
  function pickLang(v) {
    setLang(v);
    if (v === "he" && /^[A-Za-z ]+$/.test(label)) setLabel("נחש את הכלל");
    if (v === "en" && /[\u0590-\u05FF]/.test(label)) setLabel("Name the Rule");
  }

  return (
    <V2Backdrop tone={tone} style={{ flexDirection: "column", padding: 28 }}>
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        width: "100%",
      }}>
        <HRPrimaryV2 variant={variant} state={state} label={label} lang={lang} />
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
        <V2PlaygroundRow title="Label">
          <input value={label} onChange={e => setLabel(e.target.value)} maxLength={36}
            style={V2_INPUT} />
        </V2PlaygroundRow>
        <V2PlaygroundRow title="Variant">
          <V2Segment options={variantOptions} value={variant} onChange={setVariant} />
        </V2PlaygroundRow>
        <V2PlaygroundRow title="State">
          <V2Segment options={stateOptions.map(o => [o, o])} value={state} onChange={setState} />
        </V2PlaygroundRow>
        <V2PlaygroundRow title="Lang">
          <V2Segment options={langOptions} value={lang} onChange={pickLang} />
        </V2PlaygroundRow>
        <V2PlaygroundRow title="Backdrop">
          <V2Segment options={toneOptions} value={tone} onChange={setTone} />
        </V2PlaygroundRow>
      </div>
    </V2Backdrop>
  );
}

const V2_INPUT = {
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

function V2PlaygroundRow({ title, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 78,
        fontFamily: '"Frank Ruhl Libre", Georgia, serif',
        fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
        color: "rgba(214, 179, 108, 0.85)",
        fontWeight: 500,
      }}>{title}</div>
      <div style={{ flex: 1, display: "flex" }}>{children}</div>
    </div>
  );
}
function V2Segment({ options, value, onChange }) {
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
            fontFamily: '"Frank Ruhl Libre", Georgia, serif',
            fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
            padding: "7px 4px",
            cursor: "pointer", fontWeight: 500,
          }}
        >{label}</button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported sections — App() spreads these at the top of the canvas. */
/* ------------------------------------------------------------------ */
function V2Sections() {
  return (
    <React.Fragment>
      <DCSection id="v2-refined" title="v2 · Refined">
        <DCArtboard id="v2r-idle"     label="Idle"     width={360} height={240}>
          <V2StateArtboard variant="refined" state="idle"     label="Continue" />
        </DCArtboard>
        <DCArtboard id="v2r-pressed"  label="Pressed"  width={360} height={240}>
          <V2StateArtboard variant="refined" state="pressed"  label="Continue" />
        </DCArtboard>
        <DCArtboard id="v2r-focused"  label="Focused"  width={360} height={240}>
          <V2StateArtboard variant="refined" state="focused"  label="Continue" />
        </DCArtboard>
        <DCArtboard id="v2r-disabled" label="Disabled" width={360} height={240}>
          <V2StateArtboard variant="refined" state="disabled" label="Continue" />
        </DCArtboard>
      </DCSection>

      <DCSection id="v2-minimal" title="v2 · Minimal">
        <DCArtboard id="v2m-idle"     label="Idle"     width={360} height={240}>
          <V2StateArtboard variant="minimal" state="idle"     label="Continue" />
        </DCArtboard>
        <DCArtboard id="v2m-pressed"  label="Pressed"  width={360} height={240}>
          <V2StateArtboard variant="minimal" state="pressed"  label="Continue" />
        </DCArtboard>
        <DCArtboard id="v2m-focused"  label="Focused"  width={360} height={240}>
          <V2StateArtboard variant="minimal" state="focused"  label="Continue" />
        </DCArtboard>
        <DCArtboard id="v2m-disabled" label="Disabled" width={360} height={240}>
          <V2StateArtboard variant="minimal" state="disabled" label="Continue" />
        </DCArtboard>
      </DCSection>

      <DCSection id="v2-premium" title="v2 · Premium">
        <DCArtboard id="v2p-idle"     label="Idle"     width={380} height={260}>
          <V2StateArtboard variant="premium" state="idle"     label="Continue" />
        </DCArtboard>
        <DCArtboard id="v2p-pressed"  label="Pressed"  width={380} height={260}>
          <V2StateArtboard variant="premium" state="pressed"  label="Continue" />
        </DCArtboard>
        <DCArtboard id="v2p-focused"  label="Focused"  width={380} height={260}>
          <V2StateArtboard variant="premium" state="focused"  label="Continue" />
        </DCArtboard>
        <DCArtboard id="v2p-disabled" label="Disabled" width={380} height={260}>
          <V2StateArtboard variant="premium" state="disabled" label="Continue" />
        </DCArtboard>
      </DCSection>

      <DCSection id="v2-compare" title="v2 · Side by side">
        <DCArtboard id="v2-compare-en" label="English · Name the Rule" width={460} height={360}>
          <V2ComparisonArtboard label="Name the Rule" lang="en" />
        </DCArtboard>
        <DCArtboard id="v2-compare-he" label="Hebrew · נחש את הכלל" width={460} height={360}>
          <V2ComparisonArtboard label="נחש את הכלל" lang="he" />
        </DCArtboard>
      </DCSection>

      <DCSection id="v2-lengths" title="v2 · Label lengths & Hebrew">
        <DCArtboard id="v2-len-r" label="Refined · variable widths" width={360} height={620}>
          <V2LabelLengthsArtboard variant="refined" />
        </DCArtboard>
        <DCArtboard id="v2-len-m" label="Minimal · variable widths" width={360} height={620}>
          <V2LabelLengthsArtboard variant="minimal" />
        </DCArtboard>
        <DCArtboard id="v2-len-p" label="Premium · variable widths" width={380} height={620}>
          <V2LabelLengthsArtboard variant="premium" />
        </DCArtboard>
      </DCSection>

      <DCSection id="v2-context" title="v2 · In context (Hebrew, RTL)">
        <DCArtboard id="v2-phone-r" label="Refined · פרק שני" width={420} height={760}>
          <V2HebrewPhoneArtboard variant="refined" />
        </DCArtboard>
        <DCArtboard id="v2-phone-m" label="Minimal · פרק שני" width={420} height={760}>
          <V2HebrewPhoneArtboard variant="minimal" />
        </DCArtboard>
        <DCArtboard id="v2-phone-p" label="Premium · פרק שני" width={420} height={760}>
          <V2HebrewPhoneArtboard variant="premium" />
        </DCArtboard>
      </DCSection>

      <DCSection id="v2-playground" title="v2 · Playground">
        <DCArtboard id="v2-play" label="Live · variant + state + lang" width={580} height={600}>
          <V2PlaygroundArtboard />
        </DCArtboard>
      </DCSection>
    </React.Fragment>
  );
}
window.V2Sections = V2Sections;
