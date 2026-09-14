import multer from "multer";
import path from "path";
import fs from "fs";
import { apiLogger } from "../utils/loggers";

// Accept ANY image/* content type (JPEG, JPG, PNG, GIF, WebP, SVG, AVIF, BMP,
// HEIC, ICO, TIFF, ...). The browser-side <input accept="image/*"> matches
// this same rule, and anything that is not an image is still rejected.
const isImageMime = (mimetype: unknown): boolean =>
  typeof mimetype === "string" && mimetype.toLowerCase().startsWith("image/");

let storage;
try {
  storage = multer.diskStorage({
    destination: (
      _req: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, destination: string) => void
    ) => {
      if (file) {
        let directoryPath;

        if (file.mimetype.includes("image"))
          directoryPath = path.join(__dirname, "../public/images");

        if (!fs.existsSync(directoryPath)) {
          fs.mkdirSync(directoryPath, { recursive: true });
        }
        callback(null, directoryPath);
      }
    },
    filename: (
      _req: Express.Request,
      file: Express.Multer.File,
      callback: (errror: Error | null, destination: string) => void
    ) => {
      if (file && file.originalname) {
        // Derive the stored extension from the original filename, falling back
        // to the MIME subtype when the name has none (e.g. pasted blobs named
        // "image"). Keeps the local static server sending a correct
        // Content-Type for every image format.
        let extension = "";
        const tempExtension = file.originalname.split(".");
        if (tempExtension.length > 1) {
          extension = tempExtension[tempExtension.length - 1].toLowerCase();
        }
        if (!extension && typeof file.mimetype === "string" && file.mimetype.includes("/")) {
          extension = file.mimetype.split("/")[1].split("+")[0].toLowerCase(); // image/svg+xml -> svg
        }
        if (!extension) extension = "img";

        const randomString = (Math.random() + 1).toString(36).substring(2);
        callback(null, `media_${randomString}.${extension}`);
      }
    },
  });
} catch (err) {
  apiLogger.error("****UPLOAD ERROR****", err);
}

const uploadImage = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max file size
  },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    callback: multer.FileFilterCallback
  ) => {
    if (isImageMime(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error(`Invalid file type: ${file.mimetype}. Only image files (JPEG, PNG, GIF, WebP, SVG, AVIF, BMP, HEIC, ...) are allowed.`));
    }
  },
});

export default uploadImage;
