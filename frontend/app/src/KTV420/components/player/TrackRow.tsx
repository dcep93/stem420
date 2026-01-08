import { type CSSProperties, type PointerEvent } from "react";

import { type Track } from "./types";

type TrackRowProps = {
  track: Track;
  volume: number;
  isMuted: boolean;
  isDeafened: boolean;
  wahValue: number;
  onVolumeChange: (trackId: string, value: number) => void;
  onWahChange: (trackId: string, value: number) => void;
  onToggleMute: (trackId: string) => void;
  onToggleDeafen: (trackId: string) => void;
  registerCanvas: (canvas: HTMLCanvasElement | null) => void;
  onCanvasSeek: (event: PointerEvent<HTMLCanvasElement>) => void;
};

export function TrackRow({
  track,
  volume,
  isMuted,
  isDeafened,
  wahValue,
  onVolumeChange,
  onWahChange,
  onToggleMute,
  onToggleDeafen,
  registerCanvas,
  onCanvasSeek,
}: TrackRowProps) {
  const label = track.isInput
    ? `Input: ${track.name}`
    : `Output: ${track.name}`;

  const controlButtonStyle = (isActive: boolean): CSSProperties => ({
    borderRadius: "999px",
    border: "1px solid #2f384a",
    background: isActive
      ? "linear-gradient(135deg, #1f2a3d, #0f172a)"
      : "rgba(17,23,37,0.75)",
    color: "#f4f4f5",
    padding: "0.45rem 0.9rem",
    letterSpacing: "0.02em",
    fontWeight: 600,
    minWidth: "92px",
    boxShadow: isActive
      ? "0 6px 18px rgba(0,0,0,0.3)"
      : "0 4px 12px rgba(0,0,0,0.22)",
    transition: "all 160ms ease",
    cursor: "pointer",
  });

  return (
    <div key={track.id} style={{ marginBottom: "0.75rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexWrap: "wrap",
          marginBottom: "0.4rem",
        }}
      >
        <div style={{ minWidth: "220px", fontWeight: 600, color: "#e5e7eb" }}>
          {label}
        </div>
        <input
          type="range"
          min={0}
          max={2}
          step={0.01}
          value={volume}
          onChange={(event) =>
            onVolumeChange(track.id, Number(event.target.value))
          }
          style={{ flex: 1, minWidth: "160px", maxWidth: "360px" }}
        />
        <div style={{ display: "flex", gap: "0.4rem" }}>
          <button
            type="button"
            onClick={() => onToggleMute(track.id)}
            style={controlButtonStyle(isMuted)}
            aria-pressed={isMuted}
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={() => onToggleDeafen(track.id)}
            style={controlButtonStyle(isDeafened)}
            aria-pressed={isDeafened}
          >
            {isDeafened ? "Undeafen" : "Deafen"}
          </button>
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <button
              type="button"
              onClick={() => onWahChange(track.id, 0.5)}
              style={{
                color: "#cbd5e1",
                fontWeight: 600,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
            >
              Wah
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={wahValue}
              onChange={(event) =>
                onWahChange(track.id, Number(event.target.value))
              }
              style={{ width: "120px" }}
            />
          </label>
        </div>
      </div>
      <div style={{ marginTop: "0.4rem" }}>
        <canvas
          ref={registerCanvas}
          width={520}
          height={120}
          onPointerDown={onCanvasSeek}
          style={{
            border: "1px solid #333",
            background: "linear-gradient(90deg, #0b0f19, #0f0b19)",
            width: "100%",
            display: "block",
            cursor: "pointer",
          }}
        />
      </div>
    </div>
  );
}
