import React from "react";
import Image from "next/image";

/**
 * ProductImage — storefront/product cover renderer.
 *
 * Merchant cover URLs are user-provided and unpredictable (own CDN, S3,
 * Cloudinary, a locally-served upload, occasionally http:// or a relative
 * path). `next/image` optimizes to AVIF/WebP + lazy-loads, but it throws on
 * non-http(s) / relative sources and requires the host to be allow-listed in
 * next.config `images.remotePatterns`.
 *
 * So we optimize only genuine https URLs (covered by the `**` https pattern)
 * and fall back to a plain, CLS-safe <img> for everything else — the live
 * storefront can never break because of an odd cover URL.
 *
 * The parent MUST be `position: relative` with a defined size (we render with
 * `fill` + `objectFit: cover` to match the previous <img> behaviour).
 */
interface ProductImageProps {
  src?: string | null;
  alt?: string;
  /** next/image `sizes` hint — the rendered box width, e.g. "72px" or "45vw". */
  sizes?: string;
}

const ProductImage: React.FC<ProductImageProps> = ({ src, alt = "", sizes = "72px" }) => {
  if (!src) return null;

  const isHttps = /^https:\/\//i.test(src);

  if (isHttps) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        style={{ objectFit: "cover" }}
      />
    );
  }

  // http:// / relative / data: URIs — render as-is (no optimizer).
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );
};

export default ProductImage;
