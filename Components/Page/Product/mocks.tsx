import React from "react";
import { Box, Typography } from "@mui/material";
import { Icon } from "@iconify/react";
import { QRCodeSVG } from "qrcode.react";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, PANEL } from "@/Components/Page/Home/v8/kit";

/* Compact dark product mockups for the /products/* detail pages. */

const Tile: React.FC<{ children: React.ReactNode; sx?: object }> = ({ children, sx }) => (
  <Box sx={{ background: PANEL.surface, border: `1px solid ${PANEL.line}`, borderRadius: "12px", p: 1.5, ...sx }}>{children}</Box>
);
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: "0.12em", color: PANEL.ink3, textTransform: "uppercase" }}>{children}</Typography>
);
const GoldBtn: React.FC<{ children: React.ReactNode; icon?: string }> = ({ children, icon }) => (
  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, py: 1.3, borderRadius: "12px", background: PANEL.gold }}>
    {icon ? <Icon icon={icon} width={18} height={18} color="#0B0B0A" /> : null}
    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: 800, color: "#0B0B0A" }}>{children}</Typography>
  </Box>
);

export const PaymentLinkMock: React.FC = () => (
  <Box>
    <Label>Your payment link</Label>
    <Tile sx={{ mt: 1.2, display: "flex", alignItems: "center", gap: 1 }}>
      <Icon icon="mdi:link-variant" width={16} height={16} color={PANEL.gold} />
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, color: PANEL.ink2, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>dynopay.com/pay/aurora</Typography>
      <Icon icon="mdi:content-copy" width={14} height={14} color={PANEL.ink3} />
    </Tile>
    <Box sx={{ display: "flex", gap: 2, mt: 2, alignItems: "center" }}>
      <Box sx={{ p: 1, background: "#fff", borderRadius: "12px", lineHeight: 0 }}>
        <QRCodeSVG value="https://dynopay.com/pay/aurora" size={92} bgColor="#FFFFFF" fgColor="#0B0B0A" level="M" title="Example payment QR code" />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Label>Amount due</Label>
        <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, color: PANEL.ink, lineHeight: 1.1 }}>$149.00</Typography>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, color: PANEL.ink3, mt: 0.5 }}>Any coin · any chain</Typography>
      </Box>
    </Box>
    <Box sx={{ mt: 2 }}><GoldBtn icon="mdi:bitcoin">Pay with crypto</GoldBtn></Box>
  </Box>
);

export const CreatorPageMock: React.FC = () => (
  <Box sx={{ textAlign: "center" }}>
    <Box sx={{ width: 56, height: 56, borderRadius: "50%", mx: "auto", background: "linear-gradient(135deg,#FFD100,#F5A800)", display: "grid", placeItems: "center" }}>
      <Icon icon="mdi:palette-outline" width={26} height={26} color="#0B0B0A" />
    </Box>
    <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 18, color: PANEL.ink, mt: 1.2 }}>Nova Studio</Typography>
    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, color: PANEL.ink3 }}>Digital artist · 12.4k supporters</Typography>
    <Box sx={{ display: "flex", gap: 1, mt: 2.5 }}>
      {["$5", "$15", "$50"].map((v, i) => (
        <Tile key={v} sx={{ flex: 1, textAlign: "center", py: 1.2, borderColor: i === 1 ? "rgba(255,209,0,0.5)" : PANEL.line, background: i === 1 ? PANEL.goldSoft : PANEL.surface }}>
          <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: i === 1 ? PANEL.gold : PANEL.ink }}>{v}</Typography>
        </Tile>
      ))}
    </Box>
    <Box sx={{ mt: 2 }}><GoldBtn icon="mdi:heart">Support in crypto</GoldBtn></Box>
  </Box>
);

export const DonationMock: React.FC = () => (
  <Box>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Label>Clean Water Fund</Label>
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, color: PANEL.green }}>78% funded</Typography>
    </Box>
    <Box sx={{ mt: 1, height: 8, borderRadius: 999, background: PANEL.surfaceStrong, overflow: "hidden" }}>
      <Box sx={{ width: "78%", height: "100%", background: "linear-gradient(90deg,#FFD100,#F5A800)" }} />
    </Box>
    <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.8 }}>
      <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: PANEL.ink }}>$39,120</Typography>
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, color: PANEL.ink3, alignSelf: "flex-end" }}>of $50,000</Typography>
    </Box>
    <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
      {["$10", "$25", "$100", "Custom"].map((v, i) => (
        <Tile key={v} sx={{ flex: 1, textAlign: "center", py: 1, borderColor: i === 2 ? "rgba(255,209,0,0.5)" : PANEL.line, background: i === 2 ? PANEL.goldSoft : PANEL.surface }}>
          <Typography sx={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 12.5, color: i === 2 ? PANEL.gold : PANEL.ink2 }}>{v}</Typography>
        </Tile>
      ))}
    </Box>
    <Box sx={{ mt: 2 }}><GoldBtn icon="mdi:hand-heart">Donate</GoldBtn></Box>
  </Box>
);

export const InvoiceMock: React.FC = () => (
  <Box>
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
      <Box>
        <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: PANEL.ink }}>Invoice #INV-118</Typography>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, color: PANEL.ink3 }}>Due Jul 31, 2026</Typography>
      </Box>
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, px: 1, py: 0.4, borderRadius: 999, background: PANEL.goldSoft }}>
        <Box sx={{ width: 6, height: 6, borderRadius: "50%", background: PANEL.gold }} />
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, fontWeight: 700, color: PANEL.gold, textTransform: "uppercase", letterSpacing: "0.08em" }}>Unpaid</Typography>
      </Box>
    </Box>
    {[
      { d: "Design retainer — July", a: "$1,200.00" },
      { d: "Extra revisions (3)", a: "$300.00" },
    ].map((r) => (
      <Box key={r.d} sx={{ display: "flex", justifyContent: "space-between", py: 1, borderBottom: `1px solid ${PANEL.line}` }}>
        <Typography sx={{ fontFamily: FONT_BODY, fontSize: 13, color: PANEL.ink2 }}>{r.d}</Typography>
        <Typography sx={{ fontFamily: FONT_MONO, fontSize: 13, color: PANEL.ink }}>{r.a}</Typography>
      </Box>
    ))}
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 1.4 }}>
      <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, fontWeight: 700, color: PANEL.ink }}>Total due</Typography>
      <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 20, color: PANEL.gold }}>$1,500.00</Typography>
    </Box>
    <GoldBtn icon="mdi:bitcoin">Pay invoice in crypto</GoldBtn>
  </Box>
);

export const PayoutMock: React.FC = () => {
  const rows = [
    { name: "Amara O.", role: "Contractor", amt: "1,250 USDT", icon: "cryptocurrency-color:usdt" },
    { name: "Studio Nine", role: "Supplier", amt: "0.42 ETH", icon: "cryptocurrency-color:eth" },
    { name: "Lee W.", role: "Affiliate", amt: "320 USDC", icon: "cryptocurrency-color:usdc" },
  ];
  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Label>Batch payout · 3 recipients</Label>
        <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: PANEL.gold }}>$2,145</Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {rows.map((r) => (
          <Tile key={r.name} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
              <Box sx={{ width: 28, height: 28, borderRadius: "50%", background: PANEL.surfaceStrong, display: "grid", placeItems: "center" }}>
                <Icon icon="mdi:account" width={16} height={16} color={PANEL.ink2} />
              </Box>
              <Box>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, color: PANEL.ink }}>{r.name}</Typography>
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9.5, color: PANEL.ink3 }}>{r.role}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Icon icon={r.icon} width={18} height={18} />
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PANEL.ink }}>{r.amt}</Typography>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.4, px: 0.8, py: 0.3, borderRadius: 999, background: PANEL.greenSoft }}>
                <Icon icon="mdi:check" width={11} height={11} color={PANEL.green} />
                <Typography sx={{ fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, color: PANEL.green }}>Sent</Typography>
              </Box>
            </Box>
          </Tile>
        ))}
      </Box>
    </Box>
  );
};

export const ApiMock: React.FC = () => (
  <Box>
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.2 }}>
      <Box sx={{ display: "flex", gap: 0.6 }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <Box key={c} sx={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
        ))}
      </Box>
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, color: PANEL.ink3, ml: 0.5 }}>create-payment.sh</Typography>
    </Box>
    <Box component="pre" sx={{ m: 0, p: 1.5, borderRadius: "10px", background: "rgba(0,0,0,0.35)", border: `1px solid ${PANEL.line}`, overflowX: "auto", fontFamily: FONT_MONO, fontSize: 12, lineHeight: 1.7, color: PANEL.ink2 }}>
      <Box component="code" sx={{ whiteSpace: "pre" }}>
        <Box component="span" sx={{ color: PANEL.green }}>POST</Box>{` /v1/payments
`}<Box component="span" sx={{ color: PANEL.ink3 }}>Authorization:</Box>{` sk_live_•••
`}
        <Box component="span" sx={{ color: PANEL.ink3 }}>{`{`}</Box>{`
  `}<Box component="span" sx={{ color: PANEL.gold }}>{`"amount"`}</Box>{`: `}<Box component="span" sx={{ color: PANEL.ink }}>79.00</Box>{`,
  `}<Box component="span" sx={{ color: PANEL.gold }}>{`"currency"`}</Box>{`: `}<Box component="span" sx={{ color: PANEL.ink }}>{`"USD"`}</Box>{`,
  `}<Box component="span" sx={{ color: PANEL.gold }}>{`"settle"`}</Box>{`: `}<Box component="span" sx={{ color: PANEL.ink }}>{`"USDC"`}</Box>{`
`}<Box component="span" sx={{ color: PANEL.ink3 }}>{`}`}</Box>
      </Box>
    </Box>
    <Box sx={{ mt: 1.2, display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, borderRadius: "10px", background: PANEL.greenSoft, border: "1px solid rgba(52,211,153,0.3)" }}>
      <Icon icon="mdi:check-circle" width={16} height={16} color={PANEL.green} />
      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, color: PANEL.ink }}>201 · checkout_url returned</Typography>
    </Box>
  </Box>
);
