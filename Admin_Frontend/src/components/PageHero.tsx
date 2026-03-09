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
}

export default function PageHero({ eyebrow, title, description, tags = [], action }: PageHeroProps) {
  return (
    <Card className={styles.hero} bordered={false}>
      <div className={styles.content}>
        <div>
          {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
          <Title level={2} className={styles.title}>
            {title}
          </Title>
          <Paragraph className={styles.description}>{description}</Paragraph>
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
