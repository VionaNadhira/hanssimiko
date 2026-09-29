'use client';

import {useWorkspace} from '@/components/WorkspaceContext';

/**
 * Content column beside the navigation.
 *
 * Horizontal offset is decided entirely in CSS (`.app-main`) so the server and
 * the client agree on the first paint — a JS-computed padding here would cause
 * a visible shift when the sidebar state hydrates. The header and the page body
 * share `.page-container`, giving both the same max width and gutters.
 */
export function MainContentWrapper({children}: {children: React.ReactNode}) {
  const {collapsed} = useWorkspace();

  return (
    <div className="app-shell min-w-0 flex-1" data-collapsed={collapsed ? 'true' : 'false'}>
      <div className="app-main min-w-0 transition-[padding] duration-250 ease-in-out">
        <main className="min-w-0 pb-[calc(var(--bottom-nav-height)+var(--safe-bottom))] md:pb-0">
          <div className="page-container py-6 sm:py-8 lg:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
