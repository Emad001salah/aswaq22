import React from 'react';

interface ErrorOverlayProps {
  /** Error message to display */
  message: string;
}

/**
 * A premium error overlay that appears on top of the map when a critical error occurs.
 * Uses glassmorphism, subtle backdrop blur and attractive typography.
 */
export const ErrorOverlay: React.FC<ErrorOverlayProps> = ({ message }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl p-6">
      <div className="max-w-md text-center bg-white/10 border border-white/20 backdrop-blur-xl rounded-2xl p-8 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">⚠️ خطأ في الخريطة</h2>
        <p className="text-sm text-white/80 whitespace-pre-wrap break-words">{message}</p>
        <p className="mt-4 text-xs text-white/60">Please verify your Google Maps API key and network connection.</p>
      </div>
    </div>
  );
};
