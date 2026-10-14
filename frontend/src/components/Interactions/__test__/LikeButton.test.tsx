import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { interactionApi } from '@/api/interactions';
import LikeButton from '../LikeButton';

vi.mock('@/api/interactions', () => ({
  interactionApi: {
    getLikeSummary: vi.fn(),
    toggleLike: vi.fn(),
  },
}));

const mockedInteractionApi = vi.mocked(interactionApi);

describe('LikeButton', () => {
  it('loads the like summary and toggles the liked state', async () => {
    mockedInteractionApi.getLikeSummary.mockResolvedValueOnce({ count: 2, liked: false });
    mockedInteractionApi.toggleLike.mockResolvedValueOnce({ count: 3, liked: true });

    render(<LikeButton resourceType="workflow" resourceId={9} />);

    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });
    expect(mockedInteractionApi.getLikeSummary).toHaveBeenCalledWith('workflow', 9);
    expect(mockedInteractionApi.toggleLike).toHaveBeenCalledWith('workflow', 9);
  });

  it('keeps the default summary when loading fails', async () => {
    mockedInteractionApi.getLikeSummary.mockRejectedValueOnce(new Error('network'));

    render(<LikeButton resourceType="workflow" resourceId={10} />);

    await waitFor(() => {
      expect(mockedInteractionApi.getLikeSummary).toHaveBeenCalledWith('workflow', 10);
    });
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
