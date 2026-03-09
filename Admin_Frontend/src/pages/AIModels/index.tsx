import { useEffect, useState } from 'react';
import { Card, Col, Row, Skeleton, Statistic, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import PageHero from '@/components/PageHero';
import { getAIModelsOverview, getAIProviders } from '@/api/aiModels';
import type { AIModelsOverview, AIProviderSummary } from '@/types/aiModels';
import styles from './AIModels.module.scss';

const { Paragraph, Title } = Typography;

const statusColorMap = {
  healthy: '#8b5cf6',
  degraded: '#60a5fa',
  disabled: '#9ca3af',
} as const;

export default function AIModelsHomePage() {
  const [overview, setOverview] = useState<AIModelsOverview | null>(null);
  const [providers, setProviders] = useState<AIProviderSummary[]>([]);

  useEffect(() => {
    void Promise.all([getAIModelsOverview(), getAIProviders()]).then(([overviewData, providerData]) => {
      setOverview(overviewData);
      setProviders(providerData);
    });
  }, []);

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="AI 概览"
        title="AI 管理域"
        description="按服务商、模型、能力、计费和统计拆分资源，避免把所有字段堆在同一个页面。"
        tags={['服务商', '模型', '能力', '计费', '统计']}
      />

      {overview ? (
        <div className={styles.metrics}>
          <Card bordered={false} className={styles.card}>
            <Statistic title="服务商数量" value={overview.providers_count} />
          </Card>
          <Card bordered={false} className={styles.card}>
            <Statistic title="模型数量" value={overview.models_count} />
          </Card>
          <Card bordered={false} className={styles.card}>
            <Statistic title="生效规则数" value={overview.active_rules_count} />
          </Card>
          <Card bordered={false} className={styles.card}>
            <Statistic title="月度成本" prefix="$" value={overview.monthly_cost} precision={2} />
          </Card>
        </div>
      ) : (
        <Skeleton active />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Link to="/ai-models/providers" className={styles.resourceLink}>
            <Card bordered={false} className={styles.resourceCard}>
              <div className={styles.resourceMeta}>
                <div>
                  <Title level={4}>服务商</Title>
                  <Paragraph className={styles.muted}>
                    查看服务商接入状态、默认币种和挂载模型列表。
                  </Paragraph>
                </div>
                <Tag color="cyan">{providers.length}</Tag>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>进入服务商列表与详情</span>
              </div>
            </Card>
          </Link>
        </Col>
        <Col xs={24} lg={8}>
          <Link to="/ai-models/models" className={styles.resourceLink}>
            <Card bordered={false} className={styles.resourceCard}>
              <div className={styles.resourceMeta}>
                <div>
                  <Title level={4}>模型</Title>
                  <Paragraph className={styles.muted}>
                    先维护模型基础信息，再进入详情页继续配置能力和计费。
                  </Paragraph>
                </div>
                <Tag color="geekblue">资源域</Tag>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>进入模型列表和新建流程</span>
              </div>
            </Card>
          </Link>
        </Col>
        <Col xs={24} lg={8}>
          <Link to="/ai-models/pricing-rules" className={styles.resourceLink}>
            <Card bordered={false} className={styles.resourceCard}>
              <div className={styles.resourceMeta}>
                <div>
                  <Title level={4}>计费规则</Title>
                  <Paragraph className={styles.muted}>
                    使用 `pricing_type + pricing_data` 统一抽象不同模型的计费方式。
                  </Paragraph>
                </div>
                <Tag color="volcano">规则编辑器</Tag>
              </div>
              <div className={styles.resourceFooter}>
                <span className={styles.muted}>查看规则总表和模型级配置</span>
              </div>
            </Card>
          </Link>
        </Col>
      </Row>

      <Card bordered={false} className={styles.card} title="服务商快照">
        <Row gutter={[16, 16]}>
          {providers.map((provider) => (
            <Col key={provider.key} xs={24} md={12} xl={8}>
              <Link to={`/ai-models/providers/${provider.key}`} className={styles.resourceLink}>
                <Card size="small" className={styles.resourceCard}>
                  <div className={styles.resourceMeta}>
                    <div className={styles.providerHeading}>
                      <ProviderIcon provider={provider.key} size={24} />
                      <div className={styles.providerTextBlock}>
                        <Title level={5}>{provider.name}</Title>
                        <Paragraph className={styles.muted}>{provider.description}</Paragraph>
                      </div>
                    </div>
                    <span
                      className={styles.statusDot}
                      style={{ backgroundColor: statusColorMap[provider.status] }}
                    />
                  </div>
                  <div className={styles.resourceFooter}>
                    <span className={styles.muted}>
                      {provider.active_models_count}/{provider.models_count} 个模型已启用
                    </span>
                    <Tag>{provider.default_currency}</Tag>
                  </div>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
