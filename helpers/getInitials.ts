/**
 * Gets the first 2 letters of a name in uppercase for use as initials
 * @param firstName - First name or full name
 * @param lastName - Optional last name. If not provided, will try to extract from firstName if it contains a space
 * @returns First 2 letters in uppercase
 */
const getInitials = (firstName?: string, lastName?: string): string => {
  let firstInitial = "";
  let lastInitial = "";

  if (firstName) {
    // If lastName is not provided, try to split firstName by space
    if (!lastName && firstName.includes(" ")) {
      const nameParts = firstName.split(" ");
      firstInitial = nameParts[0]?.charAt(0)?.toUpperCase() || "";
      lastInitial = nameParts[1]?.charAt(0)?.toUpperCase() || "";
    } else {
      firstInitial = firstName.charAt(0)?.toUpperCase() || "";
      lastInitial = lastName?.charAt(0)?.toUpperCase() || "";
    }
  }

  return (firstInitial + lastInitial).slice(0, 2);
};

export default getInitials;

