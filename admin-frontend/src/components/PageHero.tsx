import { Card, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import styles from './PageHero.module.scss';

const { Title, Paragraph } = Typography;

interface PageHeroProps {
  eyebrow?: string;
  title: ReactNode;
  description: string;
  tags?: string[];
  action?: ReactNode;
  descriptionRows?: number;
  contentClassName?: string;
}

export default function PageHero({
  eyebrow,
  title,
  description,
  tags = [],
  action,
  descriptionRows,
  contentClassName,
}: PageHeroProps) {
  return (
    <Card className={styles.hero} bordered={false}>
      <div className={styles.content}>
        <div className={[styles.main, contentClassName].filter(Boolean).join(' ')}>
          {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
          <Title level={2} className={styles.title}>
            {title}
          </Title>
          <Paragraph
            className={styles.description}
            ellipsis={
              descriptionRows
                ? {
                    rows: descriptionRows,
                    expandable: 'collapsible',
                    symbol: (expanded) => (expanded ? '收起' : '展开更多'),
                  }
                : undefined
            }
          >
            {description}
          </Paragraph>
          {tags.length > 0 ? (
            <Space wrap>
              {tags.map((tag) => (
                <Tag key={tag} className={styles.tag}>
                  {tag}
                </Tag>
              ))}
            </Space>
          ) : null}
        </div>
        {action ? <div className={styles.action}>{action}</div> : null}
      </div>
    </Card>
  );
}
