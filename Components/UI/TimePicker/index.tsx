import { Box } from "@mui/material";
import { Text } from "../../Page/CreatePaymentLink/styled";
import TimeDropdown from "./TimeDropdown";

interface TimeSelectorProps {
  hour: string;
  minute: string;
  ampm: string;
  hourOptions: string[];
  minuteOptions: string[];
  disabledHours?: string[];
  disabledMinutes?: string[];
  disableAM: boolean;
  onHourChange: (val: string) => void;
  onMinuteChange: (val: string) => void;
  onAmPmChange: (val: string) => void;
}

export default function TimeSelector({
  hour,
  minute,
  ampm,
  hourOptions,
  minuteOptions,
  disabledHours,
  disabledMinutes,
  disableAM,
  onHourChange,
  onMinuteChange,
  onAmPmChange,
}: TimeSelectorProps) {
  return (
    <Box sx={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <TimeDropdown
        value={hour}
        options={hourOptions}
        disabledOptions={disabledHours}
        onChange={onHourChange}
      />

      <Text sx={{ fontSize: "13px" }}>:</Text>

      <TimeDropdown
        value={minute}
        options={minuteOptions}
        disabledOptions={disabledMinutes}
        onChange={onMinuteChange}
      />

      <TimeDropdown
        value={ampm}
        options={["AM", "PM"]}
        disabledOptions={[...(disableAM ? ["AM"] : [])]}
        onChange={onAmPmChange}
        dropdownHeight={90}
      />
    </Box>
  );
}
