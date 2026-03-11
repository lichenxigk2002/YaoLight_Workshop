import { Card, Col, Row, Statistic, Table, Tag, Typography } from 'antd';
import {
  ArrowUpOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import PageHero from '@/components/PageHero';

const { Text } = Typography;

const recentAlerts = [
  { key: '1', module: '任务监控', level: 'warning', message: '过去 1 小时失败任务 12 条', owner: '系统' },
  { key: '2', module: '工作流模板', level: 'info', message: '新增待审核模板 4 个', owner: '内容运营' },
  { key: '3', module: '计费运营', level: 'error', message: '支付回调异常 2 条待排查', owner: '财务运营' },
];

const levelLabels = {
  error: '严重',
  warning: '警告',
  info: '提示',
} as const;

export default function DashboardPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <PageHero
        eyebrow="后台概览"
        title="平台全局视图"
        description="这里是瑶光管理后台的首页入口，集中展示平台层级的关键指标、任务状态和近期提醒。"
        tags={['用户', '模板', '任务', '计费', '配置', '审计']}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}>
          <Card bordered={false}>
            <Statistic
              title="总用户数"
              value={1482}
              prefix={<ArrowUpOutlined />}
              suffix={<Text type="secondary">+5.6%</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card bordered={false}>
            <Statistic
              title="今日任务数"
              value={912}
              prefix={<ClockCircleOutlined />}
              suffix={<Text type="secondary">运行中 43</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card bordered={false}>
            <Statistic
              title="模板使用量"
              value={287}
              prefix={<CheckCircleOutlined />}
              suffix={<Text type="secondary">已发布 61</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} xl={6}>
          <Card bordered={false}>
            <Statistic
              title="异常告警"
              value={7}
              prefix={<WarningOutlined />}
              suffix={<Text type="secondary">待处理</Text>}
            />
          </Card>
        </Col>
      </Row>

      <Card bordered={false} title="近期平台提醒">
        <Table
          pagination={false}
          dataSource={recentAlerts}
          columns={[
            { title: '模块', dataIndex: 'module', key: 'module' },
            {
              title: '级别',
              dataIndex: 'level',
              key: 'level',
              render: (value: keyof typeof levelLabels) => {
                const color = value === 'error' ? 'red' : value === 'warning' ? 'orange' : 'blue';
                return <Tag color={color}>{levelLabels[value]}</Tag>;
              },
            },
            { title: '内容', dataIndex: 'message', key: 'message' },
            { title: '处理人', dataIndex: 'owner', key: 'owner' },
          ]}
        />
      </Card>
    </div>
  );
}
