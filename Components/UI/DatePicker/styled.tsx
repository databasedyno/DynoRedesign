import { Box, Typography, Button, IconButton } from "@mui/material";
import { styled } from "@mui/material/styles";

export const StyledDatePickerContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  backgroundColor: theme.palette.background.paper,
  borderRadius: "6px",
  border: `1px solid ${theme.palette.border.main}`,
  overflow: "hidden",
  fontFamily: "var(--font-sans)",
  boxShadow: "#2F2F6526 0px 4px 16px 0px",
  padding: "14px 12px",
}));

export const ContentContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  alignItems: "stretch",
  backgroundColor: theme.palette.background.paper,
  flex: 1,
  [theme.breakpoints.down("md")]: {
    flexDirection: "column-reverse",
    gap: "12px",
  },
}));

export const PresetsSidebar = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  alignSelf: "stretch",
  [theme.breakpoints.down("md")]: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "8px",
  },
}));

export const PresetTitle = styled(Typography)(({ theme }) => ({
  fontSize: "13px",
  fontWeight: 500,
  color: theme.palette.text.secondary,
  fontFamily: "var(--font-sans)",
  paddingBottom: "4px",
  lineHeight: "16px",
  [theme.breakpoints.down("md")]: {
    gridColumn: "1 / -1",
  },
}));

export const PresetItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== "active",
})<{ active?: boolean }>(
  ({ theme, active }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: active ? "5px 10px" : "0px",
    borderRadius: active ? "50px" : "0px",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    color: theme.palette.text.primary,
    backgroundColor: active ? theme.palette.primary.light : "transparent",
    transition: "background-color 0.2s ease",
    "&:hover": {
      backgroundColor: active ? theme.palette.primary.light : "transparent",
    },
    [theme.breakpoints.down("md")]: {
      padding: active ? "6px 12px" : "6px 0px",
      justifyContent: "space-between",
    },
    "& p": {
      fontSize: "13px",
      fontFamily: "var(--font-sans)",
      color: theme.palette.text.primary,
      fontWeight: 500,
      lineHeight: "16px",
    },
    "& .arrow": {
      display: active ? "flex" : "none",
      alignItems: "center",
      color: theme.palette.text.primary,
      fontSize: "12px",
      marginLeft: "8px",
    },
  })
);

export const CalendarContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  backgroundColor: theme.palette.background.paper,
}));

export const CalendarHeader = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "auto 1fr auto",
  alignItems: "center",
  gap: "8px",
  margin: "0",
}));

export const CalendarHeaderText = styled(Typography)(({ theme }) => ({
  textAlign: "center",
  fontSize: "13px",
  fontWeight: 500,
  color: theme.palette.text.primary,
  fontFamily: "var(--font-sans)",
  lineHeight: "100%",
  letterSpacing: 0,
  margin: "0",
}));

export const WeekdayHeader = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 0,
  marginBottom: "0",
}));

export const WeekdayCell = styled(Box)(({ theme }) => ({
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "13px",
  fontWeight: 500,
  lineHeight: "100%",
  color: theme.palette.text.secondary,
  fontFamily: "var(--font-sans)",
  textTransform: "uppercase",
  letterSpacing: "0",
}));

export const CalendarGrid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 0,
  rowGap: "4px",
}));

export const DateCellWrapper = styled(Box, {
  shouldForwardProp: (prop) =>
    prop !== "inRange" &&
    prop !== "isStart" &&
    prop !== "isEnd" &&
    prop !== "isWeekStart" &&
    prop !== "isWeekEnd",
})<{
  inRange?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  isWeekStart?: boolean;
  isWeekEnd?: boolean;
}>(({ theme, inRange, isStart, isEnd, isWeekStart, isWeekEnd }) => ({
  position: "relative",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  ...(inRange &&
    !isStart &&
    !isEnd && {
    backgroundColor: theme.palette.primary.light,
    ...(isWeekStart && {
      borderTopLeftRadius: "20px",
      borderBottomLeftRadius: "20px",
    }),
    ...(isWeekEnd && {
      borderTopRightRadius: "20px",
      borderBottomRightRadius: "20px",
    }),
  }),
  ...(isStart &&
    !isEnd && {
    background:
      `linear-gradient(to right, transparent 0%, transparent 50%, ${theme.palette.primary.light} 50%)`,
    borderRadius: "20px 0 0 20px",
  }),
  ...(isEnd &&
    !isStart && {
    background:
      `linear-gradient(to left, transparent 0%, transparent 50%, ${theme.palette.primary.light} 50%)`,
    borderRadius: "0 20px 20px 0",
  }),
  ...(isStart &&
    isEnd && {
    borderRadius: "20px",
  }),
}));

export const DateButton = styled(Button, {
  shouldForwardProp: (prop) =>
    prop !== "selected" &&
    prop !== "iscurrentmonth" &&
    prop !== "isStart" &&
    prop !== "isEnd",
})<{
  selected?: boolean;
  iscurrentmonth?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
}>(({ theme, selected, iscurrentmonth, isStart, isEnd }) => ({
  width: "32px",
  height: "32px",
  minWidth: "32px",
  borderRadius: selected
    ? "50%"
    : isStart && !isEnd
      ? "20px 0 0 20px"
      : isEnd && !isStart
        ? "0 20px 20px 0"
        : "50%",
  fontSize: "13px",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  lineHeight: "100%",
  letterSpacing: 0,
  color: iscurrentmonth
    ? theme.palette.text.primary
    : theme.palette.text.secondary,
  opacity: iscurrentmonth ? 1 : 0.3,
  cursor: iscurrentmonth ? "pointer" : "default",
  transition: "all 0.15s ease",
  padding: 0,
  ...(!selected &&
    iscurrentmonth && {
    "&:hover": {
      backgroundColor: theme.palette.primary.light,
      color: theme.palette.primary.main,
    },
  }),
  ...(selected && {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontWeight: 500,
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
    "&:hover": {
      backgroundColor: theme.palette.primary.main,
    },
  }),
}));

export const NavigationButton = styled(IconButton)(({ theme }) => ({
  padding: "4px",
  borderRadius: "6px",
  backgroundColor: "#F5F5F5",
  color: theme.palette.primary.main,
  minWidth: "28px",
  width: "28px",
  height: "28px",
  "&:hover": {
    backgroundColor: theme.palette.primary.light,
  },
}));

export const TriggerButton = styled(Button)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "9px 16px",
  borderRadius: "6px",
  textTransform: "none",
  fontSize: "14px",
  fontWeight: 500,
  fontFamily: "var(--font-sans)",
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.border.main}`,
  justifyContent: "space-between",
  whiteSpace: "nowrap",
  minWidth: "200px",
  "&:hover": {
    backgroundColor: "#F5F5F5",
    borderColor: theme.palette.border.focus,
  },
  "&:focus": {
    borderColor: theme.palette.border.focus,
  },
}));

export const DividerLine = styled(Box)(({ theme }) => ({
  width: "1px",
  alignSelf: "stretch",
  backgroundColor: theme.palette.border.main,
  margin: "0 16px",
  flexShrink: 0,
  [theme.breakpoints.down("md")]: {
    width: "100%",
    height: "1px",
    margin: "0",
    backgroundColor: theme.palette.border.main,
    flexShrink: 0,
    marginBottom: "12px 0",
  },
}));
