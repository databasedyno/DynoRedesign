import CalendarIcon from "@/assets/Icons/calendar-icon.svg";
import TimeIcon from "@/assets/Icons/time-icon.svg";
import CustomDatePicker, { DatePickerRef } from "@/Components/UI/DatePicker";
import useIsMobile from "@/hooks/useIsMobile";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, useTheme } from "@mui/material";
import { format } from "date-fns";
import Image from "next/image";
import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import TimeSelector from ".";
import { Text } from "../../Page/CreatePaymentLink/styled";

interface ExpirationDateTimeProps {
  value?: Date;
  onChange?: (date: Date) => void;
}

export default function ExpirationDateTime({
  value,
  onChange,
}: ExpirationDateTimeProps) {
  const { t } = useTranslation("createPaymentLinkScreen");
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const datePickerRef = useRef<DatePickerRef>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [selectedDateTime, setSelectedDateTime] = useState<Date>(
    value ?? new Date(),
  );

  const now = new Date();

  const isToday = selectedDateTime.toDateString() === new Date().toDateString();

  const formatDate = (date: Date) => format(date, "dd.MM.yyyy");

  const selectedHour = useMemo(() => {
    const hours = selectedDateTime.getHours();
    return String(((hours + 11) % 12) + 1).padStart(2, "0");
  }, [selectedDateTime]);

  const selectedMinute = useMemo(() => {
    return String(selectedDateTime.getMinutes()).padStart(2, "0");
  }, [selectedDateTime]);

  const selectedAmPm = useMemo(() => {
    return selectedDateTime.getHours() >= 12 ? "PM" : "AM";
  }, [selectedDateTime]);

  const hourOptions = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );

  const minuteOptions = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, "0"),
  );

  const disabledHours = useMemo(() => {
    if (!isToday) return [];

    const currentHour24 = now.getHours();

    const disabled: string[] = [];

    for (let i = 0; i < 12; i++) {
      const hour12 = i + 1;
      let hour24 = hour12;

      if (selectedAmPm === "PM" && hour12 !== 12) hour24 += 12;
      if (selectedAmPm === "AM" && hour12 === 12) hour24 = 0;

      if (hour24 < currentHour24) {
        disabled.push(String(hour12).padStart(2, "0"));
      }
    }

    return disabled;
  }, [isToday, now, selectedAmPm]);

  const disabledMinutes = useMemo(() => {
    if (!isToday) return [];

    const currentHour24 = now.getHours();
    const selectedHour24 = selectedDateTime.getHours();

    if (selectedHour24 !== currentHour24) return [];

    const currentMinute = now.getMinutes();

    return Array.from({ length: currentMinute }, (_, i) =>
      String(i).padStart(2, "0"),
    );
  }, [isToday, now, selectedDateTime]);

  const disableAM = useMemo(() => {
    if (!isToday) return false;
    return now.getHours() >= 12;
  }, [isToday, now]);

  const updateDateTime = (updated: Date) => {
    if (isToday && updated < new Date()) {
      updated = new Date();
    }

    setSelectedDateTime(updated);
    onChange?.(updated);
  };

  const handleOpenDatePicker = (event: React.MouseEvent<HTMLElement>) => {
    datePickerRef.current?.open({
      currentTarget: event.currentTarget,
    });
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: "16px",
        width: isMobile ? "100%" : "95%",
      }}
    >
      {/* DATE */}
      <Box
        sx={{
          width: isMobile ? "160px" : "190px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Image
            src={CalendarIcon}
            alt="calendar"
            width={12}
            height={12}
            className="themed-icon"
            style={{
              marginTop: "-3px",
            }}
          />
          <Text
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              color: theme.palette.text.primary,
            }}
          >
            {t("expiteDate")}
          </Text>
        </Box>

        <Box
          onClick={handleOpenDatePicker}
          sx={{
            border: `1px solid ${theme.palette.border.main}`,
            p: isMobile ? "7px 10px" : "11px 10px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
        >
          <Text
            sx={{
              fontSize: isMobile ? "10px" : "13px",
              color: theme.palette.text.primary,
            }}
          >
            {formatDate(selectedDateTime)}
          </Text>

          <Box sx={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Box
              sx={{
                height: "16px",
                width: "1px",
                backgroundColor: theme.palette.secondary.contrastText,
              }}
            />
            {isDatePickerOpen ? (
              <ExpandLessIcon
                sx={{ fontSize: "16px", color: theme.palette.text.secondary }}
              />
            ) : (
              <ExpandMoreIcon
                sx={{ fontSize: "16px", color: theme.palette.text.secondary }}
              />
            )}
          </Box>
        </Box>

        <Box sx={{ position: "absolute", width: 0, height: 0, opacity: 0 }}>
          <CustomDatePicker
            ref={datePickerRef}
            datePickerType="single"
            hideTrigger
            value={{
              startDate: selectedDateTime,
              endDate: null,
            }}
            onChange={(range) => {
              if (!range.startDate) return;

              const updated = new Date(selectedDateTime);
              updated.setFullYear(
                range.startDate.getFullYear(),
                range.startDate.getMonth(),
                range.startDate.getDate(),
              );

              updateDateTime(updated);
            }}
          />
        </Box>
      </Box>

      {/* TIME */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Image
            src={TimeIcon}
            alt="time"
            width={12}
            height={12}
            className="themed-icon"
            style={{
              marginTop: isMobile ? "-2px" : "-3px",
            }}
          />
          <Text
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              color: theme.palette.text.primary,
            }}
          >
            {t("expiteTime")}
          </Text>
        </Box>

        <TimeSelector
          hour={selectedHour}
          minute={selectedMinute}
          ampm={selectedAmPm}
          hourOptions={hourOptions}
          minuteOptions={minuteOptions}
          disabledHours={disabledHours}
          disabledMinutes={disabledMinutes}
          disableAM={disableAM}
          onHourChange={(val) => {
            const updated = new Date(selectedDateTime);
            let hour24 = parseInt(val);

            if (selectedAmPm === "PM" && hour24 !== 12) hour24 += 12;
            if (selectedAmPm === "AM" && hour24 === 12) hour24 = 0;

            updated.setHours(hour24);
            updateDateTime(updated);
          }}
          onMinuteChange={(val) => {
            const updated = new Date(selectedDateTime);
            updated.setMinutes(parseInt(val));
            updateDateTime(updated);
          }}
          onAmPmChange={(val) => {
            const updated = new Date(selectedDateTime);
            let hour = updated.getHours();

            if (val === "PM" && hour < 12) hour += 12;
            if (val === "AM" && hour >= 12) hour -= 12;

            updated.setHours(hour);
            updateDateTime(updated);
          }}
        />
      </Box>
    </Box>
  );
}
