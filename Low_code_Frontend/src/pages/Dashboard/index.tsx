import { useState, useEffect } from 'react';
import { Button, Modal, Form, Input, App, Popconfirm, Tag, Tooltip, Pagination, Row, Col, Card, Typography } from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined, 
  CalendarOutlined,
  GlobalOutlined,
  RobotOutlined,
  DatabaseOutlined,
  RocketOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { projectApi } from '@/api/project';
import type { Project, CreateProjectRequest } from '@/types/project';
import type { PageRequest } from '@/types/api';
import styles from './index.module.scss';
import { useAuth } from '@/components/AuthContext';
import { useThemeStore } from '@/store/theme';

const { TextArea } = Input;
const { Title, Text } = Typography;

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const { user } = useAuth();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  // 加载项目列表
  const loadProjects = async () => {
    try {
      setLoading(true);
      const params: PageRequest = {
        page,
        pageSize,
      };
      const response = await projectApi.getProjectList(params);
      setProjects(response.list || []);
      setTotal(response.total || 0);
    } catch (error: any) {
      message.error(error.message || t('dashboard.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [page, pageSize]);

  // 创建/更新项目
  const handleSubmit = async (values: CreateProjectRequest) => {
    try {
      if (editingProject) {
        await projectApi.updateProject(editingProject.id, values);
        message.success(t('dashboard.updateSuccess'));
      } else {
        await projectApi.createProject(values);
        message.success(t('dashboard.createSuccess'));
      }
      setModalVisible(false);
      form.resetFields();
      setEditingProject(null);
      loadProjects();
    } catch (error: any) {
      message.error(error.message || t('common.operationFailed'));
    }
  };

  // 删除项目
  const handleDelete = async (id: number) => {
    try {
      await projectApi.deleteProject(id);
      message.success(t('dashboard.deleteSuccess'));
      loadProjects();
    } catch (error: any) {
      message.error(error.message || t('dashboard.deleteFailed'));
    }
  };

  // 打开编辑模态框
  const handleEdit = (project: Project) => {
    setEditingProject(project);
    form.setFieldsValue({
      name: project.name,
      description: project.description,
    });
    setModalVisible(true);
  };

  // 打开创建模态框
  const handleCreate = (templateName?: string, templateDesc?: string) => {
    setEditingProject(null);
    form.resetFields();
    if (templateName) {
      form.setFieldsValue({
        name: templateName,
        description: templateDesc
      });
    }
    setModalVisible(true);
  };

  // 进入项目详情
  const handleEnterProject = (project: Project) => {
    navigate(`/projects/${project.id}/workflows`);
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchText.toLowerCase()) || 
    (p.description || '').toLowerCase().includes(searchText.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '-';
      
      return date.toLocaleDateString(i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return '-';
    }
  };

  // 场景模板数据
  const templates = [
    {
      key: 'crawler',
      icon: <GlobalOutlined />,
      title: t('dashboard.templateCrawler', '网页采集助手'),
      desc: t('dashboard.templateCrawlerDesc', '自动抓取网页数据并结构化提取')
    },
    {
      key: 'ai',
      icon: <RobotOutlined />,
      title: t('dashboard.templateAI', 'AI 智能助手'),
      desc: t('dashboard.templateAIDesc', '构建基于大模型的对话或处理应用')
    },
    {
      key: 'data',
      icon: <DatabaseOutlined />,
      title: t('dashboard.templateData', '数据清洗流水线'),
      desc: t('dashboard.templateDataDesc', '对多源数据进行清洗、转换和整合')
    }
  ];

  return (
    <div className={styles.container}>
      {/* 欢迎 Banner */}
      <div className={styles.welcomeSection}>
        <div className={styles.welcomeContent}>
          <Title level={2} style={{ margin: 0, color: isDark ? '#ffffff' : '#000000' }}>
            {t('dashboard.welcomeBack', '欢迎回来')}, {user?.username || 'User'} 👋
          </Title>
          <Text style={{ fontSize: 16, color: isDark ? '#d9d9d9' : '#333333', marginTop: 8, display: 'block' }}>
            {t('dashboard.welcomeSubtitle', '今天想构建什么工作流？')}
          </Text>
          <div className={styles.quickStart}>
            <Button 
              type="primary" 
              size="large" 
              icon={<RocketOutlined />}
              onClick={() => handleCreate()}
              className={styles.startBtn}
            >
              {t('dashboard.startFromBlank', '从空白开始')}
            </Button>
            <Button 
              size="large" 
              className={styles.viewDocsBtn}
              onClick={() => window.open('https://github.com/YaoLight/workshop', '_blank')}
            >
              {t('dashboard.viewDocs', '查看文档')}
            </Button>
          </div>
        </div>
      </div>

      {/* 场景模板 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('dashboard.startWithTemplate', '从模板开始')}</div>
        <div className={styles.templateGrid}>
          {templates.map(tpl => (
            <div 
              key={tpl.key} 
              className={styles.templateCard}
              onClick={() => handleCreate(tpl.title, tpl.desc)}
            >
              <div className={styles.tplIcon}>{tpl.icon}</div>
              <div className={styles.tplInfo}>
                <div className={styles.tplTitle}>{tpl.title}</div>
                <div className={styles.tplDesc}>{tpl.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 项目列表 */}
      <div className={styles.section}>
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <div className={styles.sectionTitle} style={{ marginBottom: 0 }}>
              {t('dashboard.myProjects', '我的项目')}
            </div>
          </div>
          
          <div className={styles.actions}>
            <Input 
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />} 
              placeholder={t('dashboard.searchPlaceholder', '搜索项目...')} 
              value={searchText}
              onChange={e => setSearchText(e.target.value)} 
              style={{ width: 240, borderRadius: '8px' }}
              allowClear
            />
          </div>
        </div>

        <div className={styles.projectGrid}>
          <div className={styles.createCard} onClick={() => handleCreate()}>
            <PlusOutlined className={styles.createIcon} />
            <div className={styles.createText}>{t('dashboard.createProject')}</div>
          </div>

          {filteredProjects.map(project => (
            <div 
              key={project.id} 
              className={styles.projectCard}
              onClick={() => handleEnterProject(project)}
            >
              <div className={styles.cardHeader}>
                <div className={styles.title} title={project.name}>{project.name}</div>
                <Tag color={project.status === 'active' ? 'green' : 'default'} style={{ margin: 0 }}>
                  {project.status === 'active' ? t('dashboard.statusActive') : t('dashboard.statusArchived')}
                </Tag>
              </div>
              
              <div className={styles.cardBody}>
                <div className={styles.description} title={project.description}>
                  {project.description || t('common.noDescription', '暂无描述')}
                </div>
                <div className={styles.meta}>
                  <div className={styles.metaItem}>
                    <CalendarOutlined />
                    {formatDate(project.createdAt)}
                  </div>
                </div>
              </div>

              <div className={styles.cardFooter} onClick={e => e.stopPropagation()}>
                <Tooltip title={t('common.edit')}>
                  <Button 
                    type="text" 
                    icon={<EditOutlined />} 
                    onClick={() => handleEdit(project)} 
                  />
                </Tooltip>
                <Popconfirm
                  title={t('dashboard.deleteConfirm')}
                  onConfirm={() => handleDelete(project.id)}
                  okText={t('common.ok')}
                  cancelText={t('common.cancel')}
                >
                  <Tooltip title={t('common.delete')}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>

        {total > 0 && (
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              showTotal={(total) => t('dashboard.paginationTotal', { total })}
              onChange={(p, ps) => {
                setPage(p);
                setPageSize(ps);
              }}
            />
          </div>
        )}
      </div>

      <Modal
        title={editingProject ? t('dashboard.editProject') : t('dashboard.newProject')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingProject(null);
        }}
        onOk={() => form.submit()}
        okText={t('common.ok')}
        cancelText={t('common.cancel')}
        centered
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label={t('dashboard.projectName')}
            rules={[{ required: true, message: t('dashboard.nameRequired') }]}
          >
            <Input placeholder={t('dashboard.namePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="description"
            label={t('dashboard.projectDescription')}
          >
            <TextArea
              rows={4}
              placeholder={t('dashboard.descriptionPlaceholder')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
