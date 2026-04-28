import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeBlock } from '../CodeBlock';

describe('CodeBlock', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('formats object values and shows language and line count', () => {
    render(<CodeBlock value={{ ok: true }} language="json" />);

    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('Ln 3')).toBeInTheDocument();
    expect(screen.getByText(/"ok"/)).toBeInTheDocument();
    expect(screen.getByText(/true/)).toBeInTheDocument();
  });

  it('collapses long code and copies the complete content', async () => {
    const value = ['one', 'two', 'three'].join('\n');

    render(<CodeBlock value={value} language="text" collapsedLines={2} defaultExpanded={false} />);

    expect(screen.getByText('展开')).toBeInTheDocument();
    expect(screen.queryByText(/three/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('复制'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(value);

    await userEvent.click(screen.getByText('展开'));
    expect(screen.getByText(/three/)).toBeInTheDocument();
  });
});
