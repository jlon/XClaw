import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

function SkillsDetailModalHarness() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button">View skill</button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skill details</DialogTitle>
          <DialogDescription>Desktop-neutral modal surface for skill metadata.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe('skills detail modal primitives', () => {
  it('renders a centered modal surface with dialog semantics', () => {
    render(<SkillsDetailModalHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'View skill' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('rounded-xl');
    expect(dialog).toHaveClass('border-border/70');
    expect(dialog).toHaveClass('bg-[hsl(var(--surface-elevated))]');
    expect(screen.getByText('Skill details')).toBeInTheDocument();
    expect(screen.getByText('Desktop-neutral modal surface for skill metadata.')).toBeInTheDocument();
  });

  it('closes through the dialog close control', () => {
    render(<SkillsDetailModalHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'View skill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
