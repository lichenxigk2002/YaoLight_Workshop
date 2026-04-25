import React, { useEffect, useState } from 'react';
import { Button } from 'antd';
import { HeartFilled, HeartOutlined } from '@ant-design/icons';
import { interactionApi } from '@/api/interactions';
import type { InteractionResourceType, LikeSummary } from '@/types/interactions';
import styles from './LikeButton.module.scss';

interface LikeButtonProps {
  resourceType: InteractionResourceType;
  resourceId: number;
}

const LikeButton: React.FC<LikeButtonProps> = ({ resourceType, resourceId }) => {
  const [summary, setSummary] = useState<LikeSummary>({ count: 0, liked: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    interactionApi.getLikeSummary(resourceType, resourceId)
      .then((data) => {
        if (mounted) setSummary(data);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [resourceType, resourceId]);

  const handleToggle = async () => {
    try {
      setLoading(true);
      const data = await interactionApi.toggleLike(resourceType, resourceId);
      setSummary(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      className={`${styles.likeButton} ${summary.liked ? styles.liked : ''}`}
      icon={summary.liked ? <HeartFilled /> : <HeartOutlined />}
      loading={loading}
      onClick={handleToggle}
      aria-pressed={summary.liked}
    >
      <span className={styles.count}>{summary.count}</span>
    </Button>
  );
};

export default LikeButton;
