import { Button, Col, Drawer, Form, Input, InputNumber, Row, Select, Space, Switch, Tabs } from 'antd';
import styles from '../CrawlerRules.module.scss';
import type { RuleFormValues } from '../utils';
import { DEFAULT_RULE_FORM } from '../utils';

interface RuleEditorDrawerProps {
  open: boolean;
  editingRuleId: number | null;
  saving: boolean;
  canEdit: boolean;
  form: ReturnType<typeof Form.useForm<RuleFormValues>>[0];
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

export default function RuleEditorDrawer({
  open,
  editingRuleId,
  saving,
  canEdit,
  form,
  onClose,
  onSave,
}: RuleEditorDrawerProps) {
  return (
    <Drawer
      title={editingRuleId ? `编辑规则 #${editingRuleId}` : '新建规则'}
      width={920}
      open={open}
      onClose={onClose}
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          {canEdit ? (
            <Button type="primary" loading={saving} onClick={() => void onSave()}>
              保存
            </Button>
          ) : null}
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={DEFAULT_RULE_FORM} className={styles.form} disabled={!canEdit}>
        <Tabs
          items={[
            {
              key: 'basic',
              label: '基础信息',
              children: (
                <div className={styles.tabBlock}>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
                        <Input placeholder="例如：新闻正文抽取规则" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="version" label="版本号">
                        <Input placeholder="1.0.0" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="description" label="规则说明">
                    <Input.TextArea rows={3} placeholder="说明这个规则适用于哪些站点、页面结构或采集目的。" />
                  </Form.Item>
                  <Form.Item name="tutorial" label="使用教程">
                    <Input.TextArea rows={10} placeholder={'建议包含：适用场景、操作步骤、常见失败原因、调参建议、示例 URL。'} />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col xs={24} md={14}>
                      <Form.Item name="url_pattern" label="URL 模式" rules={[{ required: true, message: '请输入 URL 模式' }]}>
                        <Input placeholder="例如：https://example.com/article/*" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={5}>
                      <Form.Item name="url_pattern_type" label="模式类型">
                        <Select options={[{ value: 'regex', label: 'regex' }, { value: 'glob', label: 'glob' }, { value: 'exact', label: 'exact' }]} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={5}>
                      <Form.Item name="method" label="请求方法">
                        <Select options={['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((value) => ({ value, label: value }))} />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: 'runtime',
              label: '运行参数',
              children: (
                <div className={styles.tabBlock}>
                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item name="timeout" label="超时（秒）">
                        <InputNumber min={1} max={600} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                      <Form.Item name="retry_count" label="重试次数">
                        <InputNumber min={0} max={20} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                      <Form.Item name="retry_delay" label="重试延迟（秒）">
                        <InputNumber min={0} max={60} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                      <Form.Item name="wait_time" label="请求后等待（秒）">
                        <InputNumber min={0} max={120} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="user_agent" label="User-Agent">
                    <Input placeholder="留空则由后端使用默认 UA" />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col xs={12} md={6}>
                      <Form.Item name="follow_redirects" label="跟随重定向" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item name="verify_ssl" label="校验证书" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item name="javascript_enabled" label="启用 Headless" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item name="screenshot" label="执行截图" valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="is_active" label="规则启用" valuePropName="checked">
                    <Switch checkedChildren="启用" unCheckedChildren="停用" />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'json',
              label: 'JSON 配置',
              children: (
                <div className={styles.tabBlock}>
                  <Row gutter={16}>
                    <Col xs={24} lg={12}>
                      <Form.Item name="headers_json" label="Headers JSON">
                        <Input.TextArea rows={7} className={styles.codeArea} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Form.Item name="params_json" label="Params JSON">
                        <Input.TextArea rows={7} className={styles.codeArea} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="body_json" label="Body JSON / 文本">
                    <Input.TextArea rows={6} className={styles.codeArea} />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col xs={24} lg={12}>
                      <Form.Item name="selectors_json" label="Selectors JSON">
                        <Input.TextArea rows={8} className={styles.codeArea} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={12}>
                      <Form.Item name="data_extraction_json" label="Data Extraction JSON">
                        <Input.TextArea rows={8} className={styles.codeArea} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col xs={24} lg={8}>
                      <Form.Item name="pagination_json" label="Pagination JSON">
                        <Input.TextArea rows={7} className={styles.codeArea} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={8}>
                      <Form.Item name="proxy_config_json" label="Proxy Config JSON">
                        <Input.TextArea rows={7} className={styles.codeArea} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} lg={8}>
                      <Form.Item name="cookies_json" label="Cookies JSON">
                        <Input.TextArea rows={7} className={styles.codeArea} />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              ),
            },
          ]}
        />
      </Form>
    </Drawer>
  );
}
