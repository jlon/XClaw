import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

describe('shared ui primitives theme', () => {
  it('makes the button system read like a desktop control instead of the default shadcn web button', () => {
    expect(buttonVariants({ variant: 'default' })).toContain('rounded-[11px]');
    expect(buttonVariants({ variant: 'default' })).toContain('shadow-none');
    expect(buttonVariants({ variant: 'default' })).toContain('bg-primary');
    expect(buttonVariants({ variant: 'default' })).toContain('text-primary-foreground');
    expect(buttonVariants({ variant: 'outline' })).toContain('border-border/70');
    expect(buttonVariants({ variant: 'outline' })).toContain('bg-[hsl(var(--surface-elevated)/0.98)]');
    expect(buttonVariants({ variant: 'outline' })).toContain('hover:bg-[hsl(var(--foreground)/0.05)]');
    expect(buttonVariants({ variant: 'secondary' })).toContain('bg-[hsl(var(--surface-panel)/1)]');
    expect(buttonVariants({ variant: 'ghost' })).toContain('hover:bg-[hsl(var(--foreground)/0.05)]');

    render(<Button>Launch</Button>);

    expect(screen.getByRole('button', { name: 'Launch' })).toHaveClass('rounded-[11px]');
  });

  it('aligns input-like controls with the shared desktop surface language', () => {
    render(
      <div>
        <Input aria-label="input" />
        <Textarea aria-label="textarea" />
        <Select
          aria-label="select"
          value=""
          options={[
            { value: 'alpha', label: 'Alpha' },
            { value: 'beta', label: 'Beta' },
          ]}
        />
      </div>,
    );

    expect(screen.getByLabelText('input')).toHaveClass('rounded-[11px]');
    expect(screen.getByLabelText('input')).toHaveClass('border-border/70');
    expect(screen.getByLabelText('textarea')).toHaveClass('rounded-[11px]');
    expect(screen.getByLabelText('textarea')).toHaveClass('border-border/70');
    expect(screen.getByLabelText('select')).toHaveClass('rounded-[11px]');
    expect(screen.getByLabelText('select')).toHaveClass('border-border/70');
  });

  it('keeps tabs, badges, cards, and switches on the same token-driven surface rhythm', () => {
    render(
      <div>
        <Tabs value="one">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="one">One</TabsTrigger>
          </TabsList>
        </Tabs>
        <Badge data-testid="badge">Live</Badge>
        <Card data-testid="card">Surface</Card>
        <Switch data-testid="switch" />
      </div>,
    );

    expect(screen.getByTestId('tabs-list')).toHaveClass('rounded-2xl');
    expect(screen.getByTestId('badge')).toHaveClass('rounded-full');
    expect(screen.getByTestId('card')).toHaveClass('rounded-[18px]');
    expect(screen.getByTestId('switch')).toHaveClass('rounded-full');
  });

  it('uses neutral desktop surface classes instead of black/white web highlight constants', () => {
    const files = [
      'src/components/ui/button.tsx',
      'src/components/ui/input.tsx',
      'src/components/ui/textarea.tsx',
      'src/components/ui/select.tsx',
      'src/components/ui/tabs.tsx',
      'src/components/ui/badge.tsx',
      'src/components/ui/card.tsx',
      'src/components/ui/switch.tsx',
    ];

    const source = files.map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')).join('\n');

    expect(source).not.toContain('border-black/10');
    expect(source).not.toContain('bg-black/[0.05]');
    expect(source).not.toContain('dark:border-white/10');
    expect(source).not.toContain('dark:data-[highlighted]:bg-white/[0.08]');
    expect(source).toContain('bg-[hsl(var(--surface-panel)/1)]');
    expect(source).toContain('border-border/70');
    expect(source).toContain('bg-muted/40');
  });
});
