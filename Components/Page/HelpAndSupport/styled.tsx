import { Box, IconButton, styled, Typography } from "@mui/material";

export const SearchIconButton = styled(IconButton)(({ theme }) => ({
    width: "40px",
    height: "40px",
    borderRadius: "6px",
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.primary.main}`,
    "&:hover": {
        borderColor: theme.palette.primary.main,
    },
    "& img": {
        width: "17px",
        height: "17px",
        objectFit: "contain",
        objectPosition: "center",
        flexShrink: 0,
        [theme.breakpoints.down("sm")]: {
            width: "12px",
            height: "12px",
        },
    },
    [theme.breakpoints.down("md")]: {
        width: "32px",
        height: "32px",
    },
}));

export const FooterIconButton = styled(IconButton)(({ theme }) => ({
    width: "40px",
    height: "40px",
    borderRadius: "6px",
    backgroundColor: theme.palette.background.paper,
    border: `1px solid #D7D7D7`,
    "& img": {
        objectFit: "contain",
        objectPosition: "center",
        flexShrink: 0,
    },
}));

export const TextDecoration = styled(Typography)(({ theme }) => ({
    fontFamily: "var(--font-sans)",
    fontWeight: 500,
    lineHeight: "100%",
    letterSpacing: 0
}));

export const FooterCard = styled(Box)(({ theme }) => ({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "9px"
}));