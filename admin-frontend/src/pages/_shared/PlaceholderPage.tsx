import { Card, Col, Row, Typography } from 'antd';
import PageHero from '@/components/PageHero';
import styles from './PlaceholderPage.module.scss';

const { Title, Paragraph, Text } = Typography;

interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
  tags: string[];
  cards: Array<{
    title: string;
    description: string;
    bullets: string[];
  }>;
}

export default function PlaceholderPage({
  eyebrow,
  title,
  description,
  tags,
  cards,
}: PlaceholderPageProps) {
  return (
    <div className={styles.page}>
      <PageHero eyebrow={eyebrow} title={title} description={description} tags={tags} />
      <Row gutter={[16, 16]}>
        {cards.map((card) => (
          <Col key={card.title} xs={24} xl={12}>
            <Card bordered={false} className={styles.card}>
              <Title level={4}>{card.title}</Title>
              <Paragraph className={styles.copy}>{card.description}</Paragraph>
              <div className={styles.bullets}>
                {card.bullets.map((bullet) => (
                  <div key={bullet} className={styles.bullet}>
                    <span className={styles.dot} />
                    <Text>{bullet}</Text>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}

