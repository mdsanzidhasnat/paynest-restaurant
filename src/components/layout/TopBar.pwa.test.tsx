import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';

function renderTopBar() {
  return render(
    <TopBar
      activeSection="dashboard"
      onNavigate={() => {}}
      onOpenMobileMenu={() => {}}
      onSelectOrder={() => {}}
      tables={[]}
      menuItems={[]}
      orders={[]}
      lowStockItems={[]}
      onSignOut={() => {}}
      userName="Ada Admin"
      userRole="Admin"
      canManageSettings={false}
    />
  );
}

function openProfileMenu() {
  fireEvent.click(screen.getByText('Ada'));
}

describe('TopBar install affordance', () => {
  it('stays hidden unless beforeinstallprompt fires', () => {
    renderTopBar();
    openProfileMenu();
    expect(screen.queryByRole('button', { name: /install app/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Add to Home Screen/)).not.toBeInTheDocument();
  });

  it('offers Install app and calls prompt when the browser allows it', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const userChoice = Promise.resolve({ outcome: 'accepted' as const });
    renderTopBar();

    const installEvent = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(installEvent, { prompt, userChoice });
    window.dispatchEvent(installEvent);

    openProfileMenu();
    fireEvent.click(await screen.findByRole('button', { name: /install app/i }));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
  });

  it('shows the short iOS hint instead of a button', () => {
    const originalAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone' });
    try {
      renderTopBar();
      openProfileMenu();
      expect(screen.getByText(/Share > Add to Home Screen/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /install app/i })).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, 'userAgent', { configurable: true, value: originalAgent });
    }
  });
});
