import React from 'react';

interface AvatarProps {
  src?: string | null;
  name: string;
  className?: string;
  sizeClassName?: string; // e.g. "w-14 h-14"
}

// Check if the URL is our known placeholder Unsplash image
const isPlaceholder = (url?: string | null): boolean => {
  if (!url || url.trim() === '') return true;
  return url.includes('photo-1535713875002-d1d0cf377fde') || url.includes('unsplash.com');
};

export const getAvatarColor = (name: string) => {
  const colors = [
    'from-emerald-500 to-teal-600 text-white',
    'from-blue-500 to-indigo-600 text-white',
    'from-purple-500 to-pink-600 text-white',
    'from-rose-500 to-red-600 text-white',
    'from-amber-500 to-orange-600 text-white',
    'from-cyan-500 to-blue-600 text-white',
    'from-violet-600 to-indigo-700 text-white',
    'from-fuchsia-500 to-pink-600 text-white',
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export const sanitizeName = (name: string): string => {
  if (!name || !name.trim()) return 'مستخدم جديد';
  const trimmed = name.trim();
  if (/^[A-Za-z0-9_-]{20,}$/.test(trimmed) || trimmed.includes('@phone.aswaq.com')) {
    return 'مستخدم جديد';
  }
  return trimmed;
};

export const getInitials = (name: string) => {
  const clean = sanitizeName(name);
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  const first = parts[0].charAt(0).toUpperCase();
  const last = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first}${last}`;
};

const getTextSize = (size?: string) => {
  if (!size) return 'text-sm';
  if (size.includes('w-14') || size.includes('h-14')) return 'text-xl';
  if (size.includes('w-12') || size.includes('h-12')) return 'text-lg';
  if (size.includes('w-10') || size.includes('h-10')) return 'text-base';
  if (size.includes('w-8') || size.includes('h-8')) return 'text-xs';
  if (size.includes('w-9') || size.includes('h-9')) return 'text-sm';
  return 'text-sm';
};

export const Avatar: React.FC<AvatarProps> = ({ src, name, className = '', sizeClassName = 'w-10 h-10' }) => {
  const [imgError, setImgError] = React.useState(false);
  const hasAvatar = !isPlaceholder(src) && src && !imgError;
  const cleanName = sanitizeName(name);
  const initials = getInitials(cleanName);
  const gradientColor = getAvatarColor(cleanName);
  const textSize = getTextSize(sizeClassName);

  // Combine classes. If rounded class is not specified, default to rounded-2xl to match design
  const baseClasses = `flex items-center justify-center font-black select-none shrink-0 ${sizeClassName} ${
    className.includes('rounded-') ? '' : 'rounded-2xl'
  } ${className}`;

  if (hasAvatar) {
    return (
      <img
        src={src!}
        alt={name}
        className={`object-cover ${sizeClassName} ${
          className.includes('rounded-') ? '' : 'rounded-2xl'
        } ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className={`${baseClasses} bg-gradient-to-br ${gradientColor} ${textSize}`}>
      <span className="uppercase tracking-wider">{initials}</span>
    </div>
  );
};
