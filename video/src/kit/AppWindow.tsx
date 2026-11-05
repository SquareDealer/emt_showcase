import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

export const APP_W = 1440;
export const APP_H = 900;

/**
 * The CRM «browser window»: 1440×900, tokens of `theme`, its own MemoryRouter at `route` (so the
 * sidebar highlights the right item). `scale` is a plain transform around the centre; the window
 * also becomes the containing block for the CRM's position:fixed overlays (toast, modal backdrop),
 * so they stay inside the window instead of covering the whole frame.
 */
export function AppWindow({
  theme,
  scale = 1,
  route = '/board',
  children,
}: {
  theme: 'light' | 'dark';
  scale?: number;
  route?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="crm-root"
      data-theme={theme}
      style={{
        position: 'relative',
        flex: 'none',
        width: APP_W,
        height: APP_H,
        overflow: 'hidden',
        borderRadius: 16,
        boxShadow:
          '0 0 0 1px rgb(0 0 0 / 0.08), 0 24px 48px -12px rgb(0 0 0 / 0.35), 0 60px 120px -24px rgb(0 0 0 / 0.35)',
        transform: `scale(${scale})`,
        contain: 'paint',
      }}
    >
      <MemoryRouter
        initialEntries={[route]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {children}
      </MemoryRouter>
    </div>
  );
}
