/**
 * ImageCropperDialog — shared crop & zoom step shown after a merchant picks a
 * profile photo or company brand logo, BEFORE the auto-save upload fires.
 * Drag to reposition, slider (or pinch/scroll) to zoom; Apply exports the
 * selected square via canvas and hands the caller a ready-to-upload File.
 */
import React, { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { getCroppedImageBlob, extensionForMime } from "./cropImage";

interface ImageCropperDialogProps {
  open: boolean;
  /** Object URL of the picked file. */
  imageSrc: string;
  /** Original picked file — used for its name + mimetype. */
  sourceFile?: File | null;
  /** "round" for avatars, "rect" for logos. Output is always the full square. */
  cropShape?: "round" | "rect";
  aspect?: number;
  title?: string;
  onCancel: () => void;
  /** Receives the cropped image as a File plus a fresh object URL for previews. */
  onApply: (file: File, previewUrl: string) => void;
}

const ImageCropperDialog: React.FC<ImageCropperDialogProps> = ({
  open,
  imageSrc,
  sourceFile,
  cropShape = "round",
  aspect = 1,
  title,
  onCancel,
  onApply,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { t } = useTranslation("common");

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const resetState = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setApplying(false);
  };

  const handleCancel = () => {
    resetState();
    onCancel();
  };

  const handleApply = async () => {
    if (!croppedAreaPixels || applying) return;
    setApplying(true);
    try {
      const sourceMime = sourceFile?.type || "image/png";
      const { blob, mime } = await getCroppedImageBlob(imageSrc, croppedAreaPixels, sourceMime);
      const baseName = (sourceFile?.name || "image").replace(/\.[^.]+$/, "") || "image";
      const file = new File([blob], `${baseName}.${extensionForMime(mime)}`, { type: mime });
      const previewUrl = URL.createObjectURL(blob);
      resetState();
      onApply(file, previewUrl);
    } catch {
      // Fall back to the untouched original — never block the merchant's upload.
      if (sourceFile) {
        resetState();
        onApply(sourceFile, imageSrc);
      } else {
        handleCancel();
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      fullWidth
      maxWidth="xs"
      data-testid="image-cropper-dialog"
    >
      <DialogTitle sx={{ pb: 1 }}>
        {title || t("imageCropTitle", { defaultValue: "Adjust image" })}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t("imageCropHint", { defaultValue: "Drag to reposition. Use the slider to zoom." })}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        <Box
          sx={{
            position: "relative",
            width: "100%",
            height: isMobile ? 260 : 320,
            borderRadius: "12px",
            overflow: "hidden",
            backgroundColor: theme.palette.mode === "dark" ? "#0B1220" : "#F1F3F9",
          }}
          data-testid="image-cropper-canvas"
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            minZoom={1}
            maxZoom={4}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 2, px: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36 }}>
            {t("imageCropZoom", { defaultValue: "Zoom" })}
          </Typography>
          <Slider
            size="small"
            value={zoom}
            min={1}
            max={4}
            step={0.05}
            onChange={(_e, v) => setZoom(v as number)}
            aria-label={t("imageCropZoom", { defaultValue: "Zoom" })}
            data-testid="image-cropper-zoom"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCancel} color="inherit" data-testid="image-cropper-cancel">
          {t("imageCropCancel", { defaultValue: "Cancel" })}
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={applying || !croppedAreaPixels}
          startIcon={applying ? <CircularProgress size={14} color="inherit" /> : undefined}
          data-testid="image-cropper-apply"
        >
          {t("imageCropApply", { defaultValue: "Apply" })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImageCropperDialog;
