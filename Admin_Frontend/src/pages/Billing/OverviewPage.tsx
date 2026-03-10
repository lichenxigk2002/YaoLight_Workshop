import { Card, Col, Row, Skeleton, Statistic, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { GiftOutlined, ReconciliationOutlined, UnorderedListOutlined, WalletOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { getQuotaSummary } from '@/features/billing/api/quota';
import { useI18n } from '@/i18n';
import styles from './Billing.module.scss';

const { Paragraph, Title } = Typography;

export default function OverviewPage() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<{ recovery: number; gift: number; total: number; users: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getQuotaSummary()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setSummary({
          recovery: data.recovery_count,
          gift: data.gift_count,
          total: data.total_count,
          users: data.user_count,
        });
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('billing.overviewEyebrow')}
        title={t('billing.overviewTitle')}
        description={t('billing.overviewDescription')}
        tags={[t('billing.overviewTagRecovery'), t('billing.overviewTagGrant'), t('billing.overviewTagLedger')]}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Link to="/billing/quota-recovery" className={styles.resourceLink}>
            <Card bordered={false} className={styles.resourceCard}>
              <div className={styles.resourceMeta}>
                <div>
                  <Title level={4}>
                    <ReconciliationOutlined /> {t('billing.cardRecoveryTitle')}
                  </Title>
                  <Paragraph className={styles.muted}>{t('billing.cardRecoveryDescription')}</Paragraph>
                </div>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>{t('billing.cardRecoveryAction')}</span>
              </div>
            </Card>
          </Link>
        </Col>
        <Col xs={24} lg={12}>
          <Link to="/billing/admin-grant" className={styles.resourceLink}>
            <Card bordered={false} className={styles.resourceCard}>
              <div className={styles.resourceMeta}>
                <div>
                  <Title level={4}>
                    <GiftOutlined /> {t('billing.cardGrantTitle')}
                  </Title>
                  <Paragraph className={styles.muted}>{t('billing.cardGrantDescription')}</Paragraph>
                </div>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>{t('billing.cardGrantAction')}</span>
              </div>
            </Card>
          </Link>
        </Col>
        <Col xs={24} lg={12}>
          <Link to="/billing/ledger" className={styles.resourceLink}>
            <Card bordered={false} className={styles.resourceCard}>
              <div className={styles.resourceMeta}>
                <div>
                  <Title level={4}>
                    <UnorderedListOutlined /> {t('billing.cardLedgerTitle')}
                  </Title>
                  <Paragraph className={styles.muted}>{t('billing.cardLedgerDescription')}</Paragraph>
                </div>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>{t('billing.cardLedgerAction')}</span>
              </div>
            </Card>
          </Link>
        </Col>
        <Col xs={24} lg={12}>
          <Link to="/billing/orders" className={styles.resourceLink}>
            <Card bordered={false} className={styles.resourceCard}>
              <div className={styles.resourceMeta}>
                <div>
                  <Title level={4}>
                    <WalletOutlined /> {t('billing.cardOrdersTitle')}
                  </Title>
                  <Paragraph className={styles.muted}>{t('billing.cardOrdersDescription')}</Paragraph>
                </div>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>{t('billing.cardOrdersAction')}</span>
              </div>
            </Card>
          </Link>
        </Col>
      </Row>

      <Card bordered={false} className={styles.card} title={t('billing.quickStatsTitle')}>
        {loading && !summary ? (
          <Skeleton active paragraph={false} />
        ) : (
          <Row gutter={24}>
            <Col span={6}>
              <Statistic title={t('billing.metricRecovery')} value={summary?.recovery ?? 0} />
            </Col>
            <Col span={6}>
              <Statistic title={t('billing.metricGrant')} value={summary?.gift ?? 0} />
            </Col>
            <Col span={6}>
              <Statistic title={t('billing.metricLedger')} value={summary?.total ?? 0} />
            </Col>
            <Col span={6}>
              <Statistic title={t('billing.metricUsers')} value={summary?.users ?? 0} />
            </Col>
          </Row>
        )}
      </Card>
    </div>
  );
}
