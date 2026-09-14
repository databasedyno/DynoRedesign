import { useCallback, useRef, useState, DragEvent } from "react";

export type DropRejectReason = "not-a-file" | "not-an-image" | "disabled";

interface Options {
  onFile: (file: File) => void;
  onReject?: (reason: DropRejectReason) => void;
  disabled?: boolean;
}

/**
 * Drag-and-drop for a single image file. Uses an enter/leave depth counter so
 * `active` does not flicker when the pointer crosses child elements, and
 * distinguishes real OS files from images dragged out of another web page
 * (those arrive as text/uri-list, not as a File — the #1 "drop does nothing").
 */
export const useImageDrop = ({ onFile, onReject, disabled = false }: Options) => {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  const reset = () => {
    depth.current = 0;
    setActive(false);
  };

  const onDragEnter = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      depth.current += 1;
      if (!active) setActive(true);
    },
    [active, disabled],
  );

  const onDragOver = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = disabled ? "none" : "copy";
    },
    [disabled],
  );

  const onDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setActive(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      reset();
      if (disabled) {
        onReject?.("disabled");
        return;
      }
      const dt = e.dataTransfer;
      const file = dt?.files?.[0] || Array.from(dt?.items || []).find((i) => i.kind === "file")?.getAsFile() || null;
      if (!file) {
        onReject?.("not-a-file");
        return;
      }
      if (!file.type.startsWith("image/")) {
        onReject?.("not-an-image");
        return;
      }
      onFile(file);
    },
    [disabled, onFile, onReject],
  );

  return { active, bind: { onDragEnter, onDragOver, onDragLeave, onDrop } };
};

export default useImageDrop;
