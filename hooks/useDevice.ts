import { useEffect, useState } from "react";

type OS = "ios" | "android" | "web";
type Browser = "safari" | "chrome" | "firefox" | "edge" | "other";

export const useDevice = () => {
    const [os, setOs] = useState<OS>("web");
    const [browser, setBrowser] = useState<Browser>("other");

    useEffect(() => {
        if (typeof window === "undefined") return;

        const ua = navigator.userAgent;

        // -------- OS --------
        if (
            /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
        ) {
            setOs("ios");
        } else if (/android/i.test(ua)) {
            setOs("android");
        } else {
            setOs("web");
        }

        // -------- Browser --------
        const isSafari =
            /^((?!chrome|android).)*safari/i.test(ua) &&
            !/crios|fxios|edgios/i.test(ua);

        if (isSafari) {
            setBrowser("safari");
        } else if (/chrome|crios/i.test(ua)) {
            setBrowser("chrome");
        } else if (/firefox|fxios/i.test(ua)) {
            setBrowser("firefox");
        } else if (/edg/i.test(ua)) {
            setBrowser("edge");
        } else {
            setBrowser("other");
        }
    }, []);

    return { os, browser };
};

export const getBrowser = () => {
    const ua = navigator.userAgent;

    const isIOS =
        /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const isSafari =
        /^((?!chrome|android).)*safari/i.test(ua);

    return {
        isDesktopSafari: isSafari && !isIOS,
        isIOS,
    };
};