import UserAvatar from "@/Components/UI/UserAvatar";
import useDisplayIdentity from "@/hooks/useDisplayIdentity";
import useIsMobile from "@/hooks/useIsMobile";
import { UserAction } from "@/Redux/Actions";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { USER_PROFILE_FETCH } from "@/Redux/Actions/UserAction";
import axiosBaseApi from "@/axiosConfig";
import { brandFg } from "@/constants/theme";
import { Icon } from "@/styles/uiKit";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

/** Account photo: upload / replace / remove. Falls back to gradient initials. */
export default function ProfilePhotoUpload({ fallbackName }: { fallbackName: string }) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation(["profile"]);
  const { name, photo } = useDisplayIdentity();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [preview, setPreview] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const toast = (message: string, severity?: "error") => dispatch({ type: TOAST_SHOW, payload: { message, ...(severity ? { severity } : {}) } });

  const submit = async (fd: FormData, kind: "upload" | "remove") => {
    setBusy(kind);
    try {
      await axiosBaseApi.put("user/updateUser", fd, { headers: { "Content-Type": "multipart/form-data" } });
      dispatch(UserAction(USER_PROFILE_FETCH));
      toast(kind === "upload"
        ? t("photoUpdated", { ns: "profile", defaultValue: "Profile photo updated" })
        : t("photoRemoved", { ns: "profile", defaultValue: "Profile photo removed" }));
    } catch (e: any) {
      setPreview("");
      toast(e?.response?.data?.message || t("photoUploadFailed", { ns: "profile", defaultValue: "Could not update photo. Please try again." }), "error");
    } finally {
      setBusy(null);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast(t("photoNotImage", { ns: "profile", defaultValue: "Please choose an image file (JPG, PNG, WEBP or GIF)." }), "error");
    if (file.size > MAX_BYTES) return toast(t("photoTooLarge", { ns: "profile", defaultValue: "Image is too large — max 5 MB." }), "error");
    setPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append("data", JSON.stringify({}));
    fd.append("image", file);
    void submit(fd, "upload");
  };

  const onRemove = () => {
    setPreview("");
    const fd = new FormData();
    fd.append("data", JSON.stringify({ remove_photo: true }));
    void submit(fd, "remove");
  };

  const shown = preview || photo;
  const linkSx = { fontSize: 12.5, fontWeight: 600, fontFamily: "var(--font-sans)", cursor: "pointer", border: "none", background: "none", padding: 0 } as const;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Box
        component="button"
        type="button"
        data-testid="profile-avatar-upload-btn"
        aria-label={t("changePhoto", { ns: "profile", defaultValue: "Change photo" })}
        disabled={!!busy}
        onClick={() => inputRef.current?.click()}
        sx={{
          position: "relative", p: 0, border: "none", background: "none", borderRadius: "50%", cursor: busy ? "default" : "pointer",
          "&:hover .photo-overlay": { opacity: 1 }, "&:focus-visible .photo-overlay": { opacity: 1 },
        }}
      >
        <UserAvatar name={name || fallbackName} photo={shown} size={isMobile ? 72 : 84} fontSize={isMobile ? 24 : 28} data-testid="profile-avatar" />
        <Box
          className="photo-overlay"
          sx={{
            position: "absolute", inset: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(10,10,15,0.55)", color: "#fff", opacity: busy ? 1 : 0, transition: "opacity 160ms ease",
          }}
        >
          {busy ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : <Icon name="camera" size={20} color="#fff" />}
        </Box>
      </Box>
      <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={onFile} data-testid="profile-photo-input" />

      <Box sx={{ mt: 1, display: "flex", gap: 1.5, alignItems: "center" }}>
        <Box component="button" type="button" data-testid="profile-photo-change" disabled={!!busy} onClick={() => inputRef.current?.click()} sx={{ ...linkSx, color: brandFg(theme.palette.mode === "dark") }}>
          {shown ? t("changePhoto", { ns: "profile", defaultValue: "Change photo" }) : t("uploadPhoto", { ns: "profile", defaultValue: "Upload photo" })}
        </Box>
        {shown && (
          <Box component="button" type="button" data-testid="profile-photo-remove" disabled={!!busy} onClick={onRemove} sx={{ ...linkSx, color: theme.palette.text.secondary }}>
            {t("removePhoto", { ns: "profile", defaultValue: "Remove" })}
          </Box>
        )}
      </Box>
      <Typography data-testid="profile-avatar-hint" sx={{ mt: 0.5, textAlign: "center", fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
        {t("photoHint", { ns: "profile", defaultValue: "JPG, PNG, WEBP or GIF · max 5 MB." })}{" "}
        <Link href="/settings?section=company" data-testid="profile-brand-logo-link" style={{ color: brandFg(theme.palette.mode === "dark"), fontWeight: 600, textDecoration: "none" }}>
          {t("brandLogoLink", { ns: "profile", defaultValue: "Manage brand logos" })}
        </Link>
      </Typography>
    </Box>
  );
}
