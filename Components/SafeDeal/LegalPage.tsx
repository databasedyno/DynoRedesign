import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Box, Container, Stack, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { SD_ACCENT } from "./sdTheme";
import safedealApi from "@/api/safedeal";
import { LEGAL_DOCS, fillLegal, type LegalDoc } from "./legalContent";
import { useSdHref } from "./sdRouting";

/** Terms / Privacy / Help — one layout, content from legalContent.ts. */
export default function LegalPage({ slug }: { slug: LegalDoc["slug"] }) {
  const href = useSdHref();
  const doc = LEGAL_DOCS[slug];
  const [legalName, setLegalName] = useState("SafeDeal");
  useEffect(() => {
    safedealApi.config().then((c) => c.legal_name && setLegalName(c.legal_name)).catch(() => undefined);
  }, []);
  const others = (Object.keys(LEGAL_DOCS) as LegalDoc["slug"][]).filter((s) => s !== slug);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 7 } }} data-testid={`sd-legal-${slug}`}>
      <Typography component="h1" sx={{ fontSize: { xs: 30, md: 40 }, fontWeight: 900, letterSpacing: -1, mb: 0.6 }}>{doc.title}</Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2.5 }}>Last updated {doc.updated}</Typography>
      {doc.draft && (
        <Alert severity="warning" icon={<Icon icon="mdi:file-document-edit-outline" />} sx={{ mb: 3 }} data-testid="sd-legal-draft-notice">
          <b>Draft.</b> This text is a first version prepared for legal review and may change before SafeDeal goes live.
        </Alert>
      )}
      <Typography sx={{ fontSize: 16, color: "#374151", lineHeight: 1.65, mb: 4, maxWidth: 720 }}>{fillLegal(doc.intro, legalName)}</Typography>

      <Stack spacing={3.5}>
        {doc.sections.map((s) => (
          <Box key={s.h} component="section">
            <Typography component="h2" sx={{ fontSize: 19, fontWeight: 900, letterSpacing: -0.3, mb: 1 }}>{s.h}</Typography>
            <Stack spacing={1.2}>
              {s.p.map((p, i) => (
                <Typography key={i} sx={{ fontSize: 15, color: "#374151", lineHeight: 1.7 }}>{fillLegal(p, legalName)}</Typography>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>

      <Box sx={{ mt: 6, pt: 3, borderTop: "1px solid #E5E7EB" }}>
        <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 1 }}>Also see</Typography>
        <Stack direction="row" spacing={2}>
          {others.map((s) => (
            <Link key={s} href={href(`/${s}`)} style={{ color: SD_ACCENT, fontWeight: 700, fontSize: 14 }} data-testid={`sd-legal-link-${s}`}>{LEGAL_DOCS[s].title}</Link>
          ))}
        </Stack>
      </Box>
    </Container>
  );
}
