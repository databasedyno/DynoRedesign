import axios from "axios";
import fs from "fs";
import { userLogger } from "../utils/loggers";

// Bundled fallback that ships with the repo (always exists, survives redeploys).
const DEFAULT_USER_IMAGE = "/images/user_image.png";

/**
 * Fetches a random avatar for a brand-new account. This is a COSMETIC nicety and
 * must NEVER be able to fail a signup. picsum.photos is a free service that
 * regularly 503s / rate-limits; when it did, the unguarded await here threw and
 * blew up account creation (observed: 500 on /api/user/registerEmail/verify-otp,
 * OTP consumed but no account created — also affected phone + Google/GitHub auth).
 * Any failure now falls back to the bundled default image.
 */
const downloadUserImage = async (): Promise<string> => {
  try {
    const randomString = (Math.random() + 1).toString(36).substring(2);
    const imageLocation = "/images/user_" + randomString + ".png";

    const response = await axios({
      url: "https://picsum.photos/400",
      responseType: "stream",
      timeout: 8000,
    });

    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream("public/" + imageLocation);
      response.data
        .pipe(writeStream)
        .on("finish", () => resolve())
        .on("error", (e: Error) => reject(e));
    });
    return imageLocation;
  } catch (e) {
    userLogger.warn(
      `[downloadUserImage] avatar fetch failed, using default: ${(e as Error)?.message || e}`
    );
    return DEFAULT_USER_IMAGE;
  }
};

export default downloadUserImage;
