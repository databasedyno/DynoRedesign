import { formatDisplayDate, formatDisplayTime } from "./displayDate";

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  return formatDisplayDate(dateString);
};

const getTime = (dateString: string) => {
  if (!dateString) return "";
  return formatDisplayTime(dateString);
};

export { formatDate, getTime };
