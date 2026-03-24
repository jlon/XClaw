import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { StudioToggleButton } from '@/components/layout/StudioToggleButton';

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      switch (key) {
        case 'toolbar.office':
          return 'Studio';
        case 'toolbar.backToChat':
          return 'Chat';
        default:
          return key;
      }
    },
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
}

describe('StudioToggleButton', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('navigates into studio from non-chat workspace pages', () => {
    render(
      <MemoryRouter initialEntries={['/agents']}>
        <Routes>
          <Route
            path="/agents"
            element={(
              <>
                <StudioToggleButton compact />
                <LocationProbe />
              </>
            )}
          />
          <Route path="/studio" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText('Studio'));

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/studio');
  });

  it('returns to the last chat route from studio without inserting an intermediate suspend frame', () => {
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame');
    window.localStorage.setItem('XClaw:lastChatRoute', '/new/session-1');

    render(
      <MemoryRouter initialEntries={['/studio']}>
        <Routes>
          <Route
            path="/studio"
            element={(
              <>
                <StudioToggleButton compact />
                <LocationProbe />
              </>
            )}
          />
          <Route path="/new/:id" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText('Chat'));

    expect(requestAnimationFrameSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/new/session-1');
  });
});
