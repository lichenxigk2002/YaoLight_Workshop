import { BugOutlined, MailOutlined, SettingOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, Form, Input, Row, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHero from '@/components/PageHero';
import { sendEmailDebug } from '@/api/systemConfigs';
import { useI18n } from '@/i18n';
import styles from './index.module.scss';

const { Paragraph, Text, Title } = Typography;

type SupportedLocale = 'zh-CN' | 'en-US';

const copyByLocale: Record<SupportedLocale, {
  eyebrow: string;
  title: string;
  description: string;
  tags: string[];
  mailCardTitle: string;
  mailCardDesc: string;
  toLabel: string;
  toPlaceholder: string;
  subjectLabel: string;
  subjectPlaceholder: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  attachmentNameLabel: string;
  attachmentNamePlaceholder: string;
  attachmentContentLabel: string;
  attachmentContentPlaceholder: string;
  send: string;
  reset: string;
  success: string;
  failed: string;
  requiredEmail: string;
  invalidEmail: string;
  debugHintTitle: string;
  debugHintDesc: string;
  logLink: string;
  logCode: string;
  configCardTitle: string;
  configCardDesc: string;
  configBulletEnv: string;
  configBulletAttachment: string;
  configBulletLogs: string;
}> = {
  'zh-CN': {
    eyebrow: '平台设置',
    title: '平台配置',
    description: '先把邮件发送链路的调试入口放在这里，方便验证 SMTP 配置、附件名兼容性和服务器投递错误。',
    tags: ['邮件调试', '腾讯云 SES', '附件兼容', '应用日志'],
    mailCardTitle: '邮件发送调试',
    mailCardDesc: '会按工作流输出邮件的同一套发送逻辑投递一封测试邮件，并带一个附件。',
    toLabel: '收件邮箱',
    toPlaceholder: '输入你的测试邮箱',
    subjectLabel: '邮件主题',
    subjectPlaceholder: '瑶光工坊邮件发送调试',
    bodyLabel: '邮件正文',
    bodyPlaceholder: '用于验证邮件正文和附件是否正常送达。',
    attachmentNameLabel: '附件名称',
    attachmentNamePlaceholder: '测试附件-中文(1).txt',
    attachmentContentLabel: '附件内容',
    attachmentContentPlaceholder: '这里是测试附件内容',
    send: '发送测试邮件',
    reset: '重置',
    success: '测试邮件已发送',
    failed: '测试邮件发送失败',
    requiredEmail: '请输入收件邮箱',
    invalidEmail: '请输入有效邮箱',
    debugHintTitle: '排查说明',
    debugHintDesc: '如果腾讯云返回附件名错误，后端会把实际发送的附件名、原附件名和错误详情写入应用日志。',
    logLink: '查看应用日志',
    logCode: '日志编号 7001-7006',
    configCardTitle: '当前处理范围',
    configCardDesc: '这里暂时不做完整配置中心，只保留和线上邮件问题直接相关的调试能力。',
    configBulletEnv: '验证 SMTP 环境变量是否能正常连接',
    configBulletAttachment: '验证中文或特殊字符附件名是否已被兼容处理',
    configBulletLogs: '失败时可在应用日志里查看 SES 原始错误',
  },
  'en-US': {
    eyebrow: 'Platform Settings',
    title: 'Platform Configuration',
    description: 'This page currently focuses on email delivery debugging for SMTP configuration, attachment names, and server-side delivery errors.',
    tags: ['Email debug', 'Tencent SES', 'Attachment compatibility', 'App logs'],
    mailCardTitle: 'Email Delivery Debug',
    mailCardDesc: 'Sends a test email through the same workflow output email path, including one attachment.',
    toLabel: 'Recipient email',
    toPlaceholder: 'Enter your test email',
    subjectLabel: 'Subject',
    subjectPlaceholder: 'YaoLight Workshop email debug',
    bodyLabel: 'Body',
    bodyPlaceholder: 'Use this to verify email body and attachment delivery.',
    attachmentNameLabel: 'Attachment name',
    attachmentNamePlaceholder: '测试附件-中文(1).txt',
    attachmentContentLabel: 'Attachment content',
    attachmentContentPlaceholder: 'Test attachment content',
    send: 'Send test email',
    reset: 'Reset',
    success: 'Test email sent',
    failed: 'Failed to send test email',
    requiredEmail: 'Enter recipient email',
    invalidEmail: 'Enter a valid email',
    debugHintTitle: 'Debug notes',
    debugHintDesc: 'If Tencent Cloud rejects the attachment name, backend logs include the original filename, actual sent filename, and SES error details.',
    logLink: 'View app logs',
    logCode: 'Log codes 7001-7006',
    configCardTitle: 'Current Scope',
    configCardDesc: 'This is not a full configuration center yet. It only keeps the debug tools needed for the live email issue.',
    configBulletEnv: 'Verify SMTP environment variables can connect',
    configBulletAttachment: 'Verify Chinese or special attachment names are handled',
    configBulletLogs: 'Inspect raw SES errors from app logs when delivery fails',
  },
};

export default function SystemConfigsPage() {
  const { message } = App.useApp();
  const { locale } = useI18n();
  const copy = copyByLocale[locale] ?? copyByLocale['zh-CN'];
  const [form] = Form.useForm();
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    try {
      const values = await form.validateFields();
      setSending(true);
      await sendEmailDebug({
        to: values.to,
        subject: values.subject,
        body: values.body,
        attachment_name: values.attachment_name,
        attachment_content: values.attachment_content,
      });
      message.success(copy.success);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      if (error instanceof Error) {
        message.error(error.message || copy.failed);
      } else {
        message.error(copy.failed);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.page}>
      <PageHero eyebrow={copy.eyebrow} title={copy.title} description={copy.description} tags={copy.tags} />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card bordered={false} className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <Title level={3} className={styles.cardTitle}><MailOutlined /> {copy.mailCardTitle}</Title>
                <Paragraph className={styles.cardDesc}>{copy.mailCardDesc}</Paragraph>
              </div>
              <Tag color="blue">{copy.logCode}</Tag>
            </div>

            <Form
              form={form}
              layout="vertical"
              initialValues={{
                subject: copy.subjectPlaceholder,
                body: copy.bodyPlaceholder,
                attachment_name: copy.attachmentNamePlaceholder,
                attachment_content: copy.attachmentContentPlaceholder,
              }}
            >
              <Form.Item
                label={copy.toLabel}
                name="to"
                rules={[{ required: true, message: copy.requiredEmail }, { type: 'email', message: copy.invalidEmail }]}
              >
                <Input placeholder={copy.toPlaceholder} allowClear />
              </Form.Item>
              <Form.Item label={copy.subjectLabel} name="subject">
                <Input placeholder={copy.subjectPlaceholder} allowClear />
              </Form.Item>
              <Form.Item label={copy.bodyLabel} name="body">
                <Input.TextArea rows={5} placeholder={copy.bodyPlaceholder} />
              </Form.Item>
              <Form.Item label={copy.attachmentNameLabel} name="attachment_name">
                <Input placeholder={copy.attachmentNamePlaceholder} allowClear />
              </Form.Item>
              <Form.Item label={copy.attachmentContentLabel} name="attachment_content">
                <Input.TextArea rows={4} placeholder={copy.attachmentContentPlaceholder} />
              </Form.Item>
              <Space>
                <Button type="primary" icon={<BugOutlined />} loading={sending} onClick={handleSend}>
                  {copy.send}
                </Button>
                <Button onClick={() => form.resetFields()}>{copy.reset}</Button>
              </Space>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={9}>
          <Card bordered={false} className={styles.card}>
            <Title level={3} className={styles.cardTitle}><SettingOutlined /> {copy.configCardTitle}</Title>
            <Paragraph className={styles.cardDesc}>{copy.configCardDesc}</Paragraph>
            <div className={styles.bulletList}>
              {[copy.configBulletEnv, copy.configBulletAttachment, copy.configBulletLogs].map((item) => (
                <div key={item} className={styles.bulletItem}>
                  <span className={styles.dot} />
                  <Text>{item}</Text>
                </div>
              ))}
            </div>
          </Card>

          <Alert
            className={styles.alert}
            type="info"
            showIcon
            message={copy.debugHintTitle}
            description={(
              <div className={styles.alertBody}>
                <div>{copy.debugHintDesc}</div>
                <Link to="/logs/app">{copy.logLink}</Link>
              </div>
            )}
          />
        </Col>
      </Row>
    </div>
  );
}
