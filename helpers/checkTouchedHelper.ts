import React from "react";

const checkTouched = (
  data: any,
  event: React.ChangeEvent<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >
) => {
  const tempData = { ...data };
  tempData[event.target.name] = true;
  return tempData;
};

export default checkTouched;
