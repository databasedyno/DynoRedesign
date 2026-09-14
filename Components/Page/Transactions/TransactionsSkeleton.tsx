import { Box, Skeleton, useTheme } from "@mui/material";

/**
 * Loading placeholder for the Transactions page. Mirrors the real layout
 * (filter pills + a list of transaction rows) so the page fades in tidily
 * instead of flashing a blank spinner. Used on mobile and desktop.
 */

const SkeletonRow = () => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: { xs: 1.5, md: 2 },
        py: 1.5,
        borderRadius: "12px",
        border: `1px solid ${theme.palette.border?.main || theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <Skeleton variant="circular" width={40} height={40} sx={{ flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Skeleton variant="text" width="55%" height={16} />
        <Skeleton variant="text" width="35%" height={13} />
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 0.5,
          flexShrink: 0,
        }}
      >
        <Skeleton variant="text" width={70} height={16} />
        <Skeleton variant="rounded" width={54} height={20} sx={{ borderRadius: "999px" }} />
      </Box>
    </Box>
  );
};

const TransactionsSkeleton = ({ rows = 8 }: { rows?: number }) => {
  return (
    <Box
      data-testid="transactions-skeleton"
      sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
    >
      {/* Filter / search bar placeholder */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: { xs: "16px", md: "20px" },
          flexWrap: "nowrap",
          overflow: "hidden",
        }}
      >
        <Skeleton variant="rounded" width={70} height={44} sx={{ borderRadius: "999px", flexShrink: 0 }} />
        <Skeleton variant="rounded" width={110} height={44} sx={{ borderRadius: "999px", flexShrink: 0 }} />
        <Skeleton variant="rounded" width={100} height={44} sx={{ borderRadius: "999px", flexShrink: 0 }} />
        <Box sx={{ flex: 1 }} />
        <Skeleton
          variant="rounded"
          width={140}
          height={40}
          sx={{ borderRadius: "10px", display: { xs: "none", md: "block" }, flexShrink: 0 }}
        />
      </Box>

      {/* Transaction rows */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </Box>
    </Box>
  );
};

export default TransactionsSkeleton;
