import { FC, memo, useCallback, useState } from "react";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { useTranslation } from "react-i18next";
import copyToClipboard from "@/helpers/copyToClipboard";

interface CodeCopyButtonProps {
  text: string;
  /** Parent must be position:relative — the button pins to its top-right corner. */
  testId?: string;
}

/** One-tap "Copy" pill for dark code blocks (blog, guides). */
const CodeCopyButton: FC<CodeCopyButtonProps> = ({ text, testId = "code-copy-btn" }) => {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };
    copyToClipboard(text).then(done).catch(done);
  }, [text]);

  return (
    <button
      type="button"
      onClick={onCopy}
      data-testid={testId}
      data-copied={copied ? "true" : "false"}
      aria-label={copied ? t("copied", { defaultValue: "Copied" }) : t("copy", { defaultValue: "Copy" })}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 12px",
        borderRadius: 8,
        border: `1px solid ${copied ? "#22C55E" : "rgba(255,255,255,0.12)"}`,
        background: copied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
        color: "#fff",
        fontSize: 12,
        fontFamily: "var(--font-sans)",
        cursor: "pointer",
        transition: "background-color 150ms ease, border-color 150ms ease",
      }}
    >
      {copied ? <CheckIcon sx={{ fontSize: 12 }} /> : <ContentCopyIcon sx={{ fontSize: 12 }} />}
      {copied ? t("copied", { defaultValue: "Copied" }) : t("copy", { defaultValue: "Copy" })}
    </button>
  );
};

export default memo(CodeCopyButton);
