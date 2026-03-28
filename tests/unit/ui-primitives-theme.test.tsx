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
  it('makes the button system read like a compact desktop control instead of a default web button', () => {
    expect(buttonVariants({ variant: 'default' })).toContain('rounded-[6px]');
    expect(buttonVariants({ variant: 'default' })).toContain('bg-primary');
    expect(buttonVariants({ variant: 'default' })).toContain('text-primary-foreground');
    expect(buttonVariants({ variant: 'default' })).toContain('desktop-focus-ring');
    expect(buttonVariants({ variant: 'outline' })).toContain('border-[hsl(var(--border-subtle))]');
    expect(buttonVariants({ variant: 'outline' })).toContain('bg-[hsl(var(--surface-elevated))]');
    expect(buttonVariants({ variant: 'outline' })).toContain('hover:bg-[hsl(var(--surface-hover))]');
    expect(buttonVariants({ variant: 'secondary' })).toContain('bg-[hsl(var(--surface-panel)/0.92)]');
    expect(buttonVariants({ variant: 'ghost' })).toContain('hover:bg-[hsl(var(--foreground)/0.05)]');
    expect(buttonVariants({ variant: 'default' })).not.toContain('focus-visible:ring-2');

    render(<Button>Launch</Button>);

    expect(screen.getByRole('button', { name: 'Launch' })).toHaveClass('rounded-[6px]', 'desktop-focus-ring');
  });

  it('aligns input-like controls with a single sharp desktop focus grammar', () => {
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

    expect(screen.getByLabelText('input')).toHaveClass('rounded-[6px]');
    expect(screen.getByLabelText('input')).toHaveClass('desktop-focus-ring');
    expect(screen.getByLabelText('input')).toHaveClass('caret-foreground');
    expect(screen.getByLabelText('textarea')).toHaveClass('rounded-[6px]');
    expect(screen.getByLabelText('textarea')).toHaveClass('desktop-focus-ring');
    expect(screen.getByLabelText('textarea')).toHaveClass('caret-foreground');
    expect(screen.getByLabelText('select')).toHaveClass('rounded-[6px]');
    expect(screen.getByLabelText('select')).toHaveClass('desktop-focus-ring');
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

    expect(screen.getByTestId('tabs-list')).toHaveClass('rounded-[8px]');
    expect(screen.getByTestId('tabs-list')).not.toHaveClass('shadow-inner');
    expect(screen.getByTestId('badge')).toHaveClass('rounded-md');
    expect(screen.getByTestId('card')).toHaveClass('rounded-xl');
    expect(screen.getByTestId('switch')).toHaveClass('rounded-full');
  });

  it('uses neutral desktop surface classes instead of web-style ring and tab defaults', () => {
    const files = [
      'src/components/ui/button.tsx',
      'src/components/ui/input.tsx',
      'src/components/ui/textarea.tsx',
      'src/components/ui/select.tsx',
      'src/components/ui/tabs.tsx',
    ];

    const source = files.map((relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8')).join('\n');

    expect(source).not.toContain('border-black/10');
    expect(source).not.toContain('bg-black/[0.05]');
    expect(source).not.toContain('dark:border-white/10');
    expect(source).not.toContain('dark:data-[highlighted]:bg-white/[0.08]');
    expect(source).not.toContain('focus-visible:ring-2');
    expect(source).not.toContain('shadow-inner');
    expect(source).toContain('desktop-focus-ring');
    expect(source).toContain('bg-[hsl(var(--surface-panel)/0.96)]');
    expect(source).toContain('border-[hsl(var(--border-subtle))]');
  });
});
