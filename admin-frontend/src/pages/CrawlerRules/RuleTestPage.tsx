import { useEffect, useState } from 'react';
import { App, Button, Card, Col, Descriptions, Divider, Form, Input, Result, Row, Space, Spin, Statistic, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { getCrawlerRule, testCrawlerRule } from '@/api/crawlerRules';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import type { CrawlerRuleDetail, CrawlerRuleTestResult } from '@/types/crawlerRules';
import styles from './CrawlerRules.module.scss';
import { DEFAULT_TEST_FORM, parseJsonField, prettyJson, type TestFormValues } from './utils';

const { Paragraph, Title } = Typography;

export default function RuleTestPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const { canEdit } = useAdminPermission('crawler_rules');
  const [form] = Form.useForm<TestFormValues>();
  const [rule, setRule] = useState<CrawlerRuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<CrawlerRuleTestResult | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCrawlerRule(Number(id))
      .then(setRule)
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : '加载规则详情失败');
      })
      .finally(() => setLoading(false));
  }, [id, message]);

  const handleRunTest = async () => {
    if (!id) return;
    try {
      const values = await form.validateFields();
      const override = parseJsonField('测试覆盖配置', values.override_json, 'optional-object') as Record<string, unknown> | undefined;
      setTesting(true);
      const result = await testCrawlerRule({
        rule_id: Number(id),
        test_url: values.test_url.trim(),
        override,
      });
      setTestResult(result);
      message.success(result.success ? '规则测试完成' : '规则测试返回失败结果');
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '规则测试失败');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className={styles.page} style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}><Spin /></div>;
  }

  if (!canEdit) {
    return (
      <div className={styles.page}>
        <Card bordered={false} className={styles.card}>
          <Result
            status="403"
            title="无权测试规则"
            subTitle="规则测试会触发真实执行，请使用具备 crawler_rules:edit 权限的管理员账号。"
            extra={<Button onClick={() => navigate('/crawler-rules')}>返回列表</Button>}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Card bordered={false} className={styles.card}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Button onClick={() => navigate('/crawler-rules')}>返回列表</Button>
            <Button onClick={() => navigate(`/crawler-rules/${id}`)}>规则详情</Button>
            <Button onClick={() => navigate(`/crawler-rules/${id}/usages`)}>查看引用</Button>
          </Space>
          <div>
            <Title level={3} className={styles.sectionTitle}>规则测试</Title>
            <Paragraph className={styles.muted}>{rule ? `当前测试规则：${rule.name}` : '规则不存在'}</Paragraph>
          </div>
        </Space>
      </Card>

      <Card bordered={false} className={styles.card}>
        <Form form={form} layout="vertical" initialValues={DEFAULT_TEST_FORM}>
          <Form.Item name="test_url" label="测试 URL" rules={[{ required: true, message: '请输入测试 URL' }]}>
            <Input placeholder="https://example.com/article/123" />
          </Form.Item>
          <Form.Item name="override_json" label="覆盖配置 JSON（可选）">
            <Input.TextArea rows={7} className={styles.codeArea} />
          </Form.Item>
          <Space>
            <Button type="primary" loading={testing} onClick={() => void handleRunTest()}>
              执行测试
            </Button>
          </Space>
        </Form>

        {testResult ? (
          <>
            <Divider />
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="执行状态" value={testResult.success ? '成功' : '失败'} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="状态码" value={testResult.status_code ?? '-'} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="耗时" value={testResult.response_time ?? 0} suffix="ms" />
                </Card>
              </Col>
            </Row>
            <Descriptions bordered size="small" column={1} className={styles.resultPanel}>
              <Descriptions.Item label="最终 URL">{testResult.url ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="错误信息">{testResult.error || '-'}</Descriptions.Item>
              <Descriptions.Item label="提取结果">
                <pre className={styles.resultCode}>{prettyJson(testResult.data ?? testResult.extracted ?? {}, '{}')}</pre>
              </Descriptions.Item>
              <Descriptions.Item label="原始 HTML">
                <pre className={styles.resultCode}>{testResult.raw_html || '-'}</pre>
              </Descriptions.Item>
            </Descriptions>
          </>
        ) : null}
      </Card>
    </div>
  );
}
