import React, { useRef, useEffect } from "react";

export interface TelegramUser {
  id: number;
  first_name: string;
  username: string;
  photo_url: string;
  auth_date: number;
  hash: string;
}

interface Props {
  dataOnauth?: (user: TelegramUser) => void;
}

declare global {
  interface Window {
    TelegramLoginWidget: {
      dataOnauth: (user: TelegramUser) => void;
    };
  }
}

const TelegramLoginButton = ({ dataOnauth }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current === null) return;

    if (typeof dataOnauth === "function") {
      window.TelegramLoginWidget = {
        dataOnauth: (user: TelegramUser) => dataOnauth(user),
      };
    }

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", "BozzWalletBot");
    script.setAttribute("data-size", "large");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-userpic", "true");

    script.setAttribute("data-onauth", "TelegramLoginWidget.dataOnauth(user)");

    script.async = true;

    ref.current.appendChild(script);
  }, [dataOnauth]);

  return <div ref={ref} />;
};

export default TelegramLoginButton;
