'use client';

import Image from 'next/image';
import {Menu} from 'lucide-react';

import {AccountChip, NetworkChip} from '@/components/AccountChip';
import {useWorkspace} from '@/components/WorkspaceContext';
import {Monogram} from '@/components/Wordmark';
import {SIDEBAR_ID} from '@/components/Sidebar';
import favicoLogo from '../../assets/favico.png';

/**
 * Top bar selebar viewport penuh (width: 100%), sticky di atas seluruh aplikasi.
 *
 * Menggunakan position: relative sebagai acuan absolut untuk:
 * - Tombol toggle sidebar di kiri (left: 16px)
 * - Logo Hanssimiko Bunker di tengah viewport (left: 50%, top: 50%, transform: translate(-50%, -50%))
 * - Chip jaringan dan akun di kanan (right: 16px)
 */
export function TopBar() {
  const {toggleSidebar, mobileOpen, collapsed} = useWorkspace();

  return (
    <header
      id="app-topbar"
      className="safe-top sticky top-0 z-50 w-full border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] backdrop-blur-md relative"
      style={{height: 'var(--header-height)'}}
    >
      {/* 3. KIRI TOP BAR: Tombol toggle sidebar absolut di left: 16px */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        aria-expanded={mobileOpen || !collapsed}
        aria-controls={SIDEBAR_ID}
        title="Toggle sidebar"
        style={{left: '16px', top: '50%', transform: 'translateY(-50%)'}}
        className="absolute z-20 inline-flex h-[36px] w-[36px] shrink-0 cursor-pointer items-center justify-center rounded-[8px] border border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary-1)] focus-visible:outline-offset-[-2px]"
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      {/* 2 & 4. LOGO DI TENGAH LAYAR: Absolut di pusat viewport */}
      <div
        role="img"
        aria-label="Hanssimiko Bunker"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
        className="flex items-center justify-center select-none"
      >
        {/* Di bawah 480px: Monogram HB 32px */}
        <div className="block min-[480px]:hidden">
          <Monogram size={32} />
        </div>

        {/* 480px ke atas: Logo favico (36px di bawah 768px, 44px di 768px ke atas) */}
        <div className="hidden min-[480px]:block">
          <Image
            src={favicoLogo}
            alt="Hanssimiko Bunker"
            priority
            className="h-[36px] md:h-[44px] w-auto object-contain"
          />
        </div>
      </div>

      {/* 3. KANAN TOP BAR: Chip jaringan & akun absolut di right: 16px */}
      <div
        style={{right: '16px', top: '50%', transform: 'translateY(-50%)'}}
        className="absolute z-20 flex items-center gap-2"
      >
        <NetworkChip />
        <AccountChip />
      </div>
    </header>
  );
}
