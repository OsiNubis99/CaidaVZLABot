import { useState } from "react";
import type { GameConfig, OnOff } from "../types";
import { CLASICO, CANTO_FIELDS } from "../configDefaults";

interface Props {
  /** Seed values (the current table config when editing); defaults to Clásico. */
  initial?: GameConfig;
  title?: string;
  submitLabel?: string;
  onSubmit: (config: GameConfig) => void;
  onCancel: () => void;
}

/** The full set of managed fields with the form's current values — sent as-is
 *  so editing can also revert a field back to its Clásico default (a diff would
 *  silently drop reverted fields). The backend sanitizes + clamps. */
function managedConfig(cfg: GameConfig): GameConfig {
  const out: GameConfig = {};
  for (const k of Object.keys(CLASICO) as (keyof typeof CLASICO)[]) {
    out[k] = cfg[k] as never;
  }
  return out;
}

/** A compact +/- numeric stepper. */
function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  prefix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="cfg-row">
      <span className="cfg-label">{label}</span>
      <div className="cfg-stepper">
        <button
          type="button"
          className="btn cfg-step"
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          aria-label="menos"
        >
          −
        </button>
        <span className="cfg-value">
          {prefix}
          {value}
        </span>
        <button
          type="button"
          className="btn cfg-step"
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          aria-label="más"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** An on/off switch rendered as two segmented buttons. */
function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: OnOff;
  onChange: (v: OnOff) => void;
}) {
  return (
    <div className="cfg-row">
      <span className="cfg-label">{label}</span>
      <div className="cfg-seg">
        <button
          type="button"
          className={`cfg-seg-btn ${value === "off" ? "is-on" : ""}`}
          onClick={() => onChange("off")}
        >
          Off
        </button>
        <button
          type="button"
          className={`cfg-seg-btn ${value === "on" ? "is-on" : ""}`}
          onClick={() => onChange("on")}
        >
          On
        </button>
      </div>
    </div>
  );
}

/** Create-table config form: pick the same rules the chat `/configurar` exposes.
 *  Seeds from the Clásico preset; only changed fields are sent (the rest keep
 *  the backend defaults). */
export function CreateConfig({
  initial,
  title = "Configurar mesa",
  submitLabel = "Crear mesa",
  onSubmit,
  onCancel,
}: Props) {
  const [cfg, setCfg] = useState<GameConfig>({ ...CLASICO, ...(initial || {}) });
  const [advanced, setAdvanced] = useState(false);

  const set = <K extends keyof GameConfig>(key: K, value: GameConfig[K]) =>
    setCfg((c) => ({ ...c, [key]: value }));

  const num = (k: keyof typeof CLASICO): number =>
    (cfg[k] as number | undefined) ?? (CLASICO[k] as number);

  return (
    <div className="prelobby-card cfg-card">
      <h3>{title}</h3>

      <Stepper
        label="Puntos para ganar"
        value={num("points")}
        min={1}
        max={100}
        onChange={(v) => set("points", v)}
      />

      <div className="cfg-row">
        <span className="cfg-label">Tipo</span>
        <div className="cfg-seg">
          <button
            type="button"
            className={`cfg-seg-btn ${cfg.type !== "parejas" ? "is-on" : ""}`}
            onClick={() => set("type", "individual")}
          >
            Individual
          </button>
          <button
            type="button"
            className={`cfg-seg-btn ${cfg.type === "parejas" ? "is-on" : ""}`}
            onClick={() => set("type", "parejas")}
          >
            Parejas
          </button>
        </div>
      </div>
      {cfg.type === "parejas" && (
        <p className="muted cfg-hint">Parejas requiere 4 jugadores.</p>
      )}

      <Stepper
        label="Valor de mesa limpia"
        value={num("mesa")}
        min={0}
        max={100}
        onChange={(v) => set("mesa", v)}
      />

      <Toggle
        label="Caída mata canto"
        value={(cfg.mata_canto as OnOff) ?? "off"}
        onChange={(v) => set("mata_canto", v)}
      />
      <Toggle
        label="Caída mata mesa"
        value={(cfg.mata_mesa as OnOff) ?? "off"}
        onChange={(v) => set("mata_mesa", v)}
      />
      <Toggle
        label="Caída continua"
        value={(cfg.caida_continua as OnOff) ?? "off"}
        onChange={(v) => set("caida_continua", v)}
      />

      <button
        type="button"
        className="btn cfg-advanced-toggle"
        onClick={() => setAdvanced((a) => !a)}
      >
        {advanced ? "▾ Ocultar avanzado" : "▸ Avanzado (multiplicadores y cantos)"}
      </button>

      {advanced && (
        <div className="cfg-advanced">
          <Stepper
            label="Multiplicador caída"
            value={num("caida")}
            min={0}
            max={10}
            prefix="x"
            onChange={(v) => set("caida", v)}
          />
          <Stepper
            label="Multiplicador ronda"
            value={num("ronda")}
            min={0}
            max={10}
            prefix="x"
            onChange={(v) => set("ronda", v)}
          />
          <div className="cfg-canto-grid">
            {CANTO_FIELDS.map((f) => (
              <Stepper
                key={f.key}
                label={f.label}
                value={num(f.key)}
                min={0}
                max={100}
                onChange={(v) => set(f.key, v)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="cfg-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onSubmit(managedConfig(cfg))}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
