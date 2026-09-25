import UserAvatar from "@/Components/UI/UserAvatar";
import CustomButton from "@/Components/UI/Buttons";
import { UserAction } from "@/Redux/Actions";
import { USER_PROFILE_FETCH } from "@/Redux/Actions/UserAction";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import axiosBaseApi from "@/axiosConfig";
import { Box, Typography, useTheme } from "@mui/material";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";

const MAX_BYTES = 5 * 1024 * 1024;

type Props = { name: string; photo?: string };

/** Account photo: real upload (PUT /user/updateUser multipart "image") with remove; initials fallback. */
export const ProfilePhoto = ({ name, photo }: Props) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { t } = useTranslation(["profile"]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const hasPhoto = Boolean(photo);

  const submit = async (fd: FormData) => {
    setBusy(true);
    try {
      await axiosBaseApi.put("user/updateUser", fd, { headers: { "Content-Type": "multipart/form-data" } });
      dispatch(UserAction(USER_PROFILE_FETCH));
      return true;
    } catch (e: any) {
      dispatch({ type: TOAST_SHOW, payload: { message: e?.response?.data?.message || t("photoUploadFailed", { ns: "profile", defaultValue: "Could not update your photo" }), severity: "error" } });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      dispatch({ type: TOAST_SHOW, payload: { message: t("photoTypeInvalid", { ns: "profile", defaultValue: "Please choose an image file (JPG, PNG, WEBP)" }), severity: "error" } });
      return;
    }
    if (file.size > MAX_BYTES) {
      dispatch({ type: TOAST_SHOW, payload: { message: t("photoTooLarge", { ns: "profile", defaultValue: "Image must be smaller than 5 MB" }), severity: "error" } });
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    const fd = new FormData();
    fd.append("data", JSON.stringify({}));
    fd.append("image", file);
    const ok = await submit(fd);
    if (ok) dispatch({ type: TOAST_SHOW, payload: { message: t("photoUpdated", { ns: "profile", defaultValue: "Profile photo updated" }) } });
    else setPreview(null);
  };

  const onRemove = async () => {
    const fd = new FormData();
    fd.append("data", JSON.stringify({ remove_photo: true }));
    const ok = await submit(fd);
    if (ok) {
      setPreview(null);
      dispatch({ type: TOAST_SHOW, payload: { message: t("photoRemoved", { ns: "profile", defaultValue: "Profile photo removed" }) } });
    }
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
      <Box
        component="button"
        type="button"
        onClick={() => !busy && inputRef.current?.click()}
        aria-label={t("changePhoto", { ns: "profile", defaultValue: "Change photo" })}
        data-testid="profile-avatar"
        sx={{ p: 0, border: "none", background: "transparent", cursor: busy ? "progress" : "pointer", borderRadius: "50%", opacity: busy ? 0.6 : 1, transition: "opacity 160ms ease, transform 160ms ease", "&:hover": { transform: "scale(1.03)" } }}
      >
        <UserAvatar name={name} photo={preview || photo} size={72} fontSize={28} data-testid="profile-avatar-image" />
      </Box>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFile} data-testid="profile-photo-input" />
      <Box sx={{ display: "flex", gap: 1 }}>
        <CustomButton
          data-testid="profile-photo-upload-btn"
          label={busy ? t("uploading", { ns: "profile", defaultValue: "Uploading…" }) : hasPhoto ? t("changePhoto", { ns: "profile", defaultValue: "Change photo" }) : t("uploadPhoto", { ns: "profile", defaultValue: "Upload photo" })}
          variant="outlined"
          size="small"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        />
        {hasPhoto && (
          <CustomButton data-testid="profile-photo-remove-btn" label={t("removePhoto", { ns: "profile", defaultValue: "Remove" })} variant="secondary" size="small" disabled={busy} onClick={onRemove} />
        )}
      </Box>
      <Typography data-testid="profile-avatar-hint" sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", textAlign: "center" }}>
        {t("photoHint", { ns: "profile", defaultValue: "JPG, PNG or WEBP, up to 5 MB. Shown in your account menu." })}
      </Typography>
    </Box>
  );
};
