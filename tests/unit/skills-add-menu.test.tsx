import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function SkillsAddMenuHarness({ onCreate }: { onCreate: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button">Add skill</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onCreate}>Create skill</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Import from GitHub</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

describe('skills add menu primitives', () => {
  it('opens in a portal with desktop surface classes', async () => {
    const onCreate = vi.fn();

    render(<SkillsAddMenuHarness onCreate={onCreate} />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Add skill' }));

    const menu = await screen.findByRole('menu');
    expect(menu).toHaveClass('rounded-[16px]');
    expect(menu).toHaveClass('border-border/70');
    expect(menu).toHaveClass('bg-popover');
    expect(await screen.findByRole('menuitem', { name: 'Create skill' })).toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: 'Import from GitHub' })).toBeInTheDocument();
  });

  it('invokes the selected item and closes after selection', async () => {
    const onCreate = vi.fn();

    render(<SkillsAddMenuHarness onCreate={onCreate} />);

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Add skill' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Create skill' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem', { name: 'Create skill' })).not.toBeInTheDocument();
  });
});
