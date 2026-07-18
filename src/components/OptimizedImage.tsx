/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  /** Set to true for above-the-fold images (LCP candidates) — disables lazy loading */
  priority?: boolean;
  onError?: () => void;
  onLoad?: () => void;
  style?: React.CSSProperties;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

const FALLBACK_SRC = 'https://images.unsplash.com/photo-1496181130204-755241544e35?auto=format&fit=crop&w=800&q=80';

/**
 * OptimizedImage — مكوّن الصور المحسّن لأداء أعلى
 * - loading="lazy" تلقائي لكل صورة خارج viewport
 * - decoding="async" لمنع إيقاف Main Thread
 * - fetchpriority="high" للصور الحرجة (LCP)
 * - Shimmer placeholder أثناء التحميل لمنع CLS
 * - Fallback تلقائي عند فشل التحميل
 */
const OptimizedImage = React.memo(function OptimizedImage({
  src,
  alt,
  className = '',
  width,
  height,
  priority = false,
  onError,
  onLoad,
  style,
  referrerPolicy = 'no-referrer',
  objectFit = 'cover',
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);

  // إعادة تعيين الحالة عند تغيير src
  useEffect(() => {
    setCurrentSrc(src);
    setIsLoaded(false);
    setHasError(false);
  }, [src]);

  // إذا كانت الصورة محمّلة بالفعل في cache المتصفح
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    if (!hasError && currentSrc !== FALLBACK_SRC) {
      setHasError(true);
      setCurrentSrc(FALLBACK_SRC);
    }
    onError?.();
  };

  return (
    <img
      ref={imgRef}
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      {...(priority ? { fetchPriority: 'high' } : {})}
      referrerPolicy={referrerPolicy}
      className={`${className} transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      style={{ objectFit, ...style }}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
});

export default OptimizedImage;
