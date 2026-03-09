import { Card, Col, Row, Skeleton, Statistic, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { GiftOutlined, ReconciliationOutlined, UnorderedListOutlined, WalletOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { getQuotaSummary } from '@/features/billing/api/quota';
import styles from './Billing.module.scss';

const { Paragraph, Title } = Typography;

export default function OverviewPage() {
  const [summary, setSummary] = useState<{ recovery: number; gift: number; total: number; users: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getQuotaSummary()
      .then((data) => {
        if (cancelled) return;
        setSummary({
          recovery: data.recovery_count,
          gift: data.gift_count,
          total: data.total_count,
          users: data.user_count,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="概览"
        title="计费运营入口"
        description="从运营视角管理邀请、订单、流水与配额；补救配额与管理员赠送均会写入流水。"
        tags={['补救配额', '管理员赠送', '配额流水']}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Link to="/billing/quota-recovery" className={styles.resourceLink}>
            <Card bordered={false} className={styles.resourceCard}>
              <div className={styles.resourceMeta}>
                <div>
                  <Title level={4}>
                    <ReconciliationOutlined /> 补救配额
                  </Title>
                  <Paragraph className={styles.muted}>
                    支付失败等场景下补发用户配额，需填写订单 ID 与原因，记入流水（来源：支付失败补发）。
                  </Paragraph>
                </div>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>进入补救表单</span>
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
                    <GiftOutlined /> 管理员赠送
                  </Title>
                  <Paragraph className={styles.muted}>
                    运营/活动赠送配额，填写用户与备注，记入流水（来源：管理员赠送）。
                  </Paragraph>
                </div>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>进入赠送表单</span>
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
                    <UnorderedListOutlined /> 配额流水
                  </Title>
                  <Paragraph className={styles.muted}>查看所有配额变动记录。</Paragraph>
                </div>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>查看流水列表</span>
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
                    <WalletOutlined /> 订单与 Token
                  </Title>
                  <Paragraph className={styles.muted}>查看全站订单列表与 Token 流水。</Paragraph>
                </div>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>进入订单与 Token 视图</span>
              </div>
            </Card>
          </Link>
        </Col>
      </Row>

      <Card bordered={false} className={styles.card} title="快捷统计">
        {loading && !summary ? (
          <Skeleton active paragraph={false} />
        ) : (
          <Row gutter={24}>
            <Col span={6}>
              <Statistic title="补救笔数" value={summary?.recovery ?? 0} />
            </Col>
            <Col span={6}>
              <Statistic title="赠送笔数" value={summary?.gift ?? 0} />
            </Col>
            <Col span={6}>
              <Statistic title="流水条数" value={summary?.total ?? 0} />
            </Col>
            <Col span={6}>
              <Statistic title="涉及用户" value={summary?.users ?? 0} />
            </Col>
          </Row>
        )}
      </Card>
    </div>
  );
}
