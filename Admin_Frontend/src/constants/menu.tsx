import {
  AuditOutlined,
  BellOutlined,
  BranchesOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  FileSearchOutlined,
  RobotOutlined,
  SettingOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import type { AdminMenuItem } from '@/types/menu';

// 路径相对 basename /admin（navigate 会自动加上 basename）
export const adminMenuItems: AdminMenuItem[] = [
  { key: 'dashboard', path: '/', label: '仪表盘', icon: <DashboardOutlined /> },
  { key: 'users', path: '/users', label: '用户管理', icon: <TeamOutlined /> },
  {
    key: 'workflow-templates',
    path: '/workflow-templates',
    label: '工作流模板',
    icon: <DeploymentUnitOutlined />,
  },
  { key: 'node-types', path: '/node-types', label: '节点类型', icon: <BranchesOutlined /> },
  {
    key: 'crawler-rules',
    path: '/crawler-rules',
    label: '爬虫规则',
    icon: <FileSearchOutlined />,
  },
  {
    key: 'ai-models',
    label: 'AI 模型',
    icon: <RobotOutlined />,
    children: [
      { key: 'ai-models-overview', path: '/ai-models', label: '概览' },
      { key: 'ai-models-providers', path: '/ai-models/providers', label: '服务商' },
      {
        key: 'ai-models-models',
        path: '/ai-models/models',
        label: '模型',
        aliases: ['/ai-models/models/new'],
      },
      {
        key: 'ai-models-pricing-rules',
        path: '/ai-models/pricing-rules',
        label: '计费规则',
      },
      { key: 'ai-models-usage', path: '/ai-models/usage', label: '使用统计' },
    ],
  },
  { key: 'tasks', path: '/tasks', label: '任务监控', icon: <DatabaseOutlined /> },
  {
    key: 'billing',
    label: '计费运营',
    icon: <WalletOutlined />,
    children: [
      { key: 'billing-overview', path: '/billing', label: '概览' },
      { key: 'billing-quota-recovery', path: '/billing/quota-recovery', label: '补救配额' },
      { key: 'billing-admin-grant', path: '/billing/admin-grant', label: '管理员赠送' },
      { key: 'billing-ledger', path: '/billing/ledger', label: '配额流水' },
    ],
  },
  {
    key: 'system-configs',
    path: '/system-configs',
    label: '系统配置',
    icon: <SettingOutlined />,
  },
  { key: 'notifications', path: '/notifications', label: '通知中心', icon: <BellOutlined /> },
  {
    key: 'operation-logs',
    path: '/operation-logs',
    label: '操作日志',
    icon: <AuditOutlined />,
  },
];
