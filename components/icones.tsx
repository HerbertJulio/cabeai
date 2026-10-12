import type { ReactNode } from 'react';

const P: Record<string, ReactNode> = {
  girar: <><path d="M20 12a8 8 0 1 1-2.34-5.66" /><path d="M20 4v5h-5" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  mais: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  add: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  enquadrar: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  regua: <><path d="M3 17 17 3l4 4L7 21z" /><path d="M7 13l2 2M10 10l2 2M13 7l2 2" /></>,
  ima: <><path d="M6 3v8a6 6 0 0 0 12 0V3" /><path d="M6 7h4M14 7h4" /></>,
  cadeado: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  estrela: <path d="M12 3l2.2 5.6L20 9.3l-4.5 3.8L17 19l-5-3.1L7 19l1.5-5.9L4 9.3l5.8-.7z" />,
  painel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  inspetor: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>,
  voltar: <path d="M15 18l-6-6 6-6" />,
  mover: <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />,
  ia: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><rect x="7" y="7" width="10" height="10" rx="3" /><path d="M10 12h4M12 10v4" /></>,
  coracao: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  lapis: <><path d="M4 20l4.5-1L19 8.5 15.5 5 5 15.5z" /><path d="M13.5 7l3.5 3.5" /></>,
  camera: <><path d="M4 8h3.2l1.8-2.6h6l1.8 2.6H20v11H4z" /><circle cx="12" cy="13.2" r="3.4" /></>
};

export function Icone({ n, className }: { n: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {P[n]}
    </svg>
  );
}

export function Logo({ className = 'logo' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect className="logo-bg" x="1" y="1" width="30" height="30" rx="8" />
      <path className="logo-l" d="M14 8h10v16H8V14" fill="none" strokeWidth={2.4} strokeLinejoin="round" />
      <path className="logo-l" d="M8 14V8" fill="none" strokeWidth={2} />
      <path className="logo-l" d="M14 8a6 6 0 0 1-6 6" fill="none" strokeWidth={1.4} strokeDasharray="1.6 1.6" />
      <rect className="logo-f" x="15.5" y="15" width="6" height="7" rx="1.2" />
    </svg>
  );
}
