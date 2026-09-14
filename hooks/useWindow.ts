import React, { useState, useEffect } from "react";

const useWindow = () => {
  const [customWindow, setCustomWindow] = useState<Window>();
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCustomWindow(window);
    }
  }, []);
  return customWindow;
};

export default useWindow;
