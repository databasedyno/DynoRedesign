import { Box, Typography, useTheme } from "@mui/material";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getInitials } from "@/helpers";
import { avatarGradient } from "@/helpers/avatarGradient";

type Props = {
  name?: string;
  photo?: string;
  size?: number;
  fontSize?: number;
  "data-testid"?: string;
};

/** Normalise a stored photo path to something <Image> can load. */
export const resolveUserPhoto = (raw?: string) => {
  if (!raw) return "";
  return !raw.startsWith("/") && !raw.startsWith("http") && !raw.startsWith("blob:") ? `/${raw}` : raw;
};

/** Round avatar: uploaded photo when available, deterministic gradient + initials otherwise. */
export default function UserAvatar({ name = "", photo, size = 32, fontSize, ...rest }: Props) {
  const theme = useTheme();
  const [imageError, setImageError] = useState(false);
  const src = resolveUserPhoto(photo);
  const showPhoto = Boolean(src) && !imageError;
  const [firstName = "", lastName = ""] = name.split(" ");

  useEffect(() => {
    setImageError(false);
  }, [src]);

  return (
    <Box
      data-testid={rest["data-testid"]}
      data-avatar-kind={showPhoto ? "photo" : "initials"}
      sx={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: showPhoto ? "transparent" : avatarGradient(name || firstName),
        boxShadow: showPhoto
          ? "none"
          : theme.palette.mode === "dark"
            ? "0 2px 8px rgba(0,0,0,0.35)"
            : "0 2px 8px rgba(10,10,15,0.18)",
        flexShrink: 0,
      }}
    >
      {showPhoto ? (
        <Image
          src={src}
          alt="user"
          width={size}
          height={size}
          style={{ borderRadius: "50%", objectFit: "cover" }}
          draggable={false}
          onError={() => setImageError(true)}
        />
      ) : (
        <Typography
          sx={{
            fontSize: fontSize ?? Math.round(size * 0.375),
            fontWeight: 700,
            color: "#FFFFFF",
            fontFamily: "var(--font-sans)",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          {getInitials(firstName, lastName)}
        </Typography>
      )}
    </Box>
  );
}
