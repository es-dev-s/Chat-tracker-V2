"use client";

import { useEffect, useState } from "react";
import { dicebearPortraitUrl } from "@/lib/utils/dicebear";

type AvatarMarkProps = {
  tint: string;
  initials?: string;
  avatarSeed?: string;
  size?: number;
  eager?: boolean;
};

function AvatarGlyphInner({
  initials,
  imageSrc,
  size,
  eager,
}: {
  initials?: string;
  imageSrc: string;
  size: number;
  eager: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <span
        style={{
          position: "relative",
          zIndex: 0,
          opacity: imageSrc ? (loaded ? 0 : 1) : 1,
          transition: "opacity 0.28s cubic-bezier(0.25, 0.1, 0.25, 1)",
          pointerEvents: "none",
        }}
      >
        {initials || "?"}
      </span>
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(false)}
          width={Math.round(size * 2)}
          height={Math.round(size * 2)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.32s cubic-bezier(0.25, 0.1, 0.25, 1)",
          }}
        />
      ) : null}
    </>
  );
}

export default function AvatarMark({
  tint,
  initials,
  avatarSeed,
  size = 26,
  eager = false,
}: AvatarMarkProps) {
  const imageSrc =
    avatarSeed != null && String(avatarSeed).trim()
      ? dicebearPortraitUrl(avatarSeed)
      : "";
  const px = `${size}px`;
  const fs = `${Math.round(size * 0.42)}px`;

  return (
    <div
      aria-hidden={imageSrc ? undefined : true}
      style={{
        width: px,
        height: px,
        borderRadius: 999,
        background: tint,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fs,
        fontWeight: 700,
        letterSpacing: "0.02em",
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.18)",
      }}
    >
      <AvatarGlyphInner
        key={imageSrc || `glyph-${initials || "?"}`}
        initials={initials}
        imageSrc={imageSrc}
        size={size}
        eager={eager}
      />
    </div>
  );
}
