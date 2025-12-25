export type IconName = 'spark' | 'wires' | 'shield' | 'bolt' | 'layers' | 'code' | 'book' | 'menu' | 'close' | 'sun' | 'moon' | 'arrow' | 'search';

interface IconProps {
  name: IconName;
  className?: string;
}

export function Icon({ name, className = '' }: IconProps) {
  const common = 'fill-none stroke-current stroke-[1.6]';

  switch (name) {
    case 'spark':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path className={common} d="M12 2l1.2 5.1L18 9l-4.8 1.9L12 16l-1.2-5.1L6 9l4.8-1.9L12 2z" />
          <path className={common} d="M20 14l.7 2.8L23 18l-2.3.9L20 22l-.7-3.1L17 18l2.3-1.2L20 14z" />
        </svg>
      );
    case 'wires':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path className={common} d="M4 7h6l2 2h8" />
          <path className={common} d="M4 17h6l2-2h8" />
          <path className={common} d="M10 7v10" />
          <path className={common} d="M20 9v6" />
          <path className={common} d="M20 9a1 1 0 1 0 0 .01" />
          <path className={common} d="M20 15a1 1 0 1 0 0 .01" />
        </svg>
      );
    case 'shield':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path className={common} d="M12 2l8 4v6c0 6-4 9-8 10-4-1-8-4-8-10V6l8-4z" />
          <path className={common} d="M8.5 12l2.2 2.2L15.8 9" />
        </svg>
      );
    case 'bolt':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path className={common} d="M13 2L3 14h7l-1 8 12-14h-7l-1-6z" />
        </svg>
      );
    case 'layers':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path className={common} d="M12 2l9 5-9 5-9-5 9-5z" />
          <path className={common} d="M3 12l9 5 9-5" />
          <path className={common} d="M3 17l9 5 9-5" />
        </svg>
      );
    case 'code':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path className={common} d="M16 18l6-6-6-6" />
          <path className={common} d="M8 6l-6 6 6 6" />
        </svg>
      );
    case 'book':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path className={common} d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path className={common} d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          <path className={common} d="M8 7h8" />
          <path className={common} d="M8 11h6" />
        </svg>
      );
    case 'menu':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path className={common} d="M4 6h16" />
          <path className={common} d="M4 12h16" />
          <path className={common} d="M4 18h16" />
        </svg>
      );
    case 'close':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path className={common} d="M18 6L6 18" />
          <path className={common} d="M6 6l12 12" />
        </svg>
      );
    case 'sun':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <circle className={common} cx="12" cy="12" r="5" />
          <path className={common} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      );
    case 'moon':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path className={common} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      );
    case 'arrow':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path className={common} d="M5 12h14" />
          <path className={common} d="M12 5l7 7-7 7" />
        </svg>
      );
    case 'search':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <circle className={common} cx="11" cy="11" r="8" />
          <path className={common} d="M21 21l-4.35-4.35" />
        </svg>
      );
    default:
      return null;
  }
}
