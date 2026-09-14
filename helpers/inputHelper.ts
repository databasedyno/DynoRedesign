import React from "react";

const inputHelper = (
  data: any,
  event: React.ChangeEvent<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >
) => {
  const tempData = { ...data };
  tempData[event.target.name] = event.target.value;
  return tempData;
};

export default inputHelper;
