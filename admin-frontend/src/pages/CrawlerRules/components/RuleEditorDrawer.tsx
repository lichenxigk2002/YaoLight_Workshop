import { Button, Col, Drawer, Form, Input, InputNumber, Row, Select, Space, Switch, Tabs } from 'antd';
import { useI18n } from '@/i18n';
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
  const { t } = useI18n();

  return (
    <Drawer
      title={editingRuleId ? t('crawlerRules.drawerEditTitle', { id: editingRuleId }) : t('crawlerRules.drawerCreateTitle')}
      width={920}
      open={open}
      onClose={onClose}
      extra={
        <Space>
          <Button onClick={onClose}>{t('crawlerRules.actionCancel')}</Button>
          {canEdit ? (
            <Button type="primary" loading={saving} onClick={() => void onSave()}>
              {t('crawlerRules.actionSave')}
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
              label: t('crawlerRules.tabBasic'),
              children: (
                <div className={styles.tabBlock}>
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item name="name" label={t('crawlerRules.formName')} rules={[{ required: true, message: t('crawlerRules.formNameRequired') }]}>
                        <Input placeholder={t('crawlerRules.formNamePlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item name="version" label={t('crawlerRules.formVersion')}>
                        <Input placeholder="1.0.0" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="description" label={t('crawlerRules.formDescription')}>
                    <Input.TextArea rows={3} placeholder={t('crawlerRules.formDescriptionPlaceholder')} />
                  </Form.Item>
                  <Form.Item name="tutorial" label={t('crawlerRules.formTutorial')}>
                    <Input.TextArea rows={10} placeholder={t('crawlerRules.formTutorialPlaceholder')} />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col xs={24} md={14}>
                      <Form.Item name="url_pattern" label={t('crawlerRules.formUrlPattern')} rules={[{ required: true, message: t('crawlerRules.formUrlPatternRequired') }]}>
                        <Input placeholder={t('crawlerRules.formUrlPatternPlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={5}>
                      <Form.Item name="url_pattern_type" label={t('crawlerRules.formPatternType')}>
                        <Select options={[{ value: 'regex', label: 'regex' }, { value: 'glob', label: 'glob' }, { value: 'exact', label: 'exact' }]} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={5}>
                      <Form.Item name="method" label={t('crawlerRules.formMethod')}>
                        <Select options={['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((value) => ({ value, label: value }))} />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: 'runtime',
              label: t('crawlerRules.tabRuntime'),
              children: (
                <div className={styles.tabBlock}>
                  <Row gutter={16}>
                    <Col xs={24} md={6}>
                      <Form.Item name="timeout" label={t('crawlerRules.formTimeout')}>
                        <InputNumber min={1} max={600} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                      <Form.Item name="retry_count" label={t('crawlerRules.formRetryCount')}>
                        <InputNumber min={0} max={20} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                      <Form.Item name="retry_delay" label={t('crawlerRules.formRetryDelay')}>
                        <InputNumber min={0} max={60} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                      <Form.Item name="wait_time" label={t('crawlerRules.formWaitTime')}>
                        <InputNumber min={0} max={120} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="user_agent" label="User-Agent">
                    <Input placeholder={t('crawlerRules.formUserAgentPlaceholder')} />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col xs={12} md={6}>
                      <Form.Item name="follow_redirects" label={t('crawlerRules.formFollowRedirects')} valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item name="verify_ssl" label={t('crawlerRules.formVerifySsl')} valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item name="javascript_enabled" label={t('crawlerRules.formJavascriptEnabled')} valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item name="screenshot" label={t('crawlerRules.formScreenshot')} valuePropName="checked">
                        <Switch />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="is_active" label={t('crawlerRules.formIsActive')} valuePropName="checked">
                    <Switch checkedChildren={t('crawlerRules.enable')} unCheckedChildren={t('crawlerRules.disable')} />
                  </Form.Item>
                </div>
              ),
            },
            {
              key: 'json',
              label: t('crawlerRules.tabJson'),
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
                  <Form.Item name="body_json" label={t('crawlerRules.formBodyJson')}>
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
