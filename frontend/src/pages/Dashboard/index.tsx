import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, Form, Input, App, Popconfirm, Tooltip, Pagination, Spin } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CalendarOutlined,
  ArrowRightOutlined,
  GlobalOutlined,
  RobotOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { projectApi } from '@/api/project';
import type { Project, CreateProjectRequest } from '@/types/project';
import type { PageRequest } from '@/types/api';
import styles from './index.module.scss';
import { useAuth } from '@/components/AuthContext';

const { TextArea } = Input;

function getGreeting(isZh: boolean) {
  const hour = new Date().getHours();

  if (isZh) {
    if (hour < 12) return '早上好，今天想做点什么？';
    if (hour < 18) return '下午好，今天想做点什么？';
    return '晚上好，今天想做点什么？';
  }

  if (hour < 12) return 'Good morning, where would you like to begin?';
  if (hour < 18) return 'Good afternoon, where would you like to begin?';
  return 'Good evening, where would you like to begin?';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const { user } = useAuth();
  const isZh = i18n.language === 'zh-CN';
  const projectsSectionRef = useRef<HTMLElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form] = Form.useForm();

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
    void loadProjects();
  }, [page, pageSize]);

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
      void loadProjects();
    } catch (error: any) {
      message.error(error.message || t('common.operationFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await projectApi.deleteProject(id);
      message.success(t('dashboard.deleteSuccess'));
      void loadProjects();
    } catch (error: any) {
      message.error(error.message || t('dashboard.deleteFailed'));
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    form.setFieldsValue({
      name: project.name,
      description: project.description,
    });
    setModalVisible(true);
  };

  const handleCreate = (templateName?: string, templateDesc?: string) => {
    setEditingProject(null);
    form.resetFields();
    if (templateName) {
      form.setFieldsValue({
        name: templateName,
        description: templateDesc,
      });
    }
    setModalVisible(true);
  };

  const handleEnterProject = (project: Project) => {
    navigate(`/projects/${project.id}/workflows`);
  };

  const greeting = useMemo(() => getGreeting(isZh), [isZh]);

  const quickStarts = useMemo(
    () => [
      {
        key: 'crawler',
        icon: <GlobalOutlined />,
        title: isZh ? '网页采集' : 'Web capture',
        desc: isZh ? '从网页内容开始' : 'Start from web content',
      },
      {
        key: 'assistant',
        icon: <RobotOutlined />,
        title: isZh ? '助手项目' : 'Assistant project',
        desc: isZh ? '适合对话或流程协作' : 'Good for chat or flow collaboration',
      },
      {
        key: 'data',
        icon: <DatabaseOutlined />,
        title: isZh ? '数据处理' : 'Data flow',
        desc: isZh ? '清洗与整理数据' : 'Clean and organize data',
      },
    ],
    [isZh],
  );

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return '-';

      return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '-';
    }
  };

  const sectionTitle = isZh ? '最近项目' : 'Recent projects';
  const sectionHint = isZh
    ? '上次停下的地方，可以从这里继续。'
    : 'Keep active work within easy reach.';
  const emptyTitle = isZh ? '还没有项目' : 'No projects yet';
  const emptyText = isZh
    ? '从空白开始，或者用一个轻量模板先把工作铺开。'
    : 'Start from blank, or use a light template to get moving.';

  return (
    <div className={styles.container}>
      <div className={styles.glow} />

      <section className={styles.introSection}>
        <span className={styles.eyebrow}>YaoLight Workspace</span>
        <h1 className={styles.title}>{greeting}</h1>
        <p className={styles.subtitle}>
          {isZh
            ? `${user?.username || '你'}，欢迎回来。今天想先推进哪件事？`
            : `A quieter place for ${user?.username || 'you'} to begin. Less noise, more room to work.`}
        </p>

        <div className={styles.actionRow}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className={styles.primaryButton}
            onClick={() => handleCreate()}
          >
            {isZh ? '新建项目' : 'New project'}
          </Button>
          <Button
            className={styles.softButton}
            onClick={() => projectsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {isZh ? '最近项目' : 'Recent projects'}
          </Button>
        </div>

        <div className={styles.quickStartRow}>
          {quickStarts.map((item) => (
            <button
              key={item.key}
              type="button"
              className={styles.quickStartChip}
              onClick={() => handleCreate(item.title, item.desc)}
            >
              <span className={styles.quickStartIcon}>{item.icon}</span>
              <span className={styles.quickStartLabel}>{item.title}</span>
            </button>
          ))}
        </div>
      </section>

      <section ref={projectsSectionRef} className={styles.projectsSection}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionTitle}>{sectionTitle}</div>
            <div className={styles.sectionHint}>{sectionHint}</div>
          </div>
          <div className={styles.sectionMeta}>
            {isZh ? `当前页 ${projects.length}` : `${projects.length} on this page`}
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingShell}>
            <Spin />
          </div>
        ) : projects.length > 0 ? (
          <div className={styles.projectGrid}>
            <button type="button" className={styles.createCard} onClick={() => handleCreate()}>
              <PlusOutlined className={styles.createIcon} />
              <div className={styles.createTitle}>{isZh ? '开始一个新项目' : 'Start a new project'}</div>
              <div className={styles.createText}>
                {isZh ? '给下一段工作留一个干净的起点。' : 'Open a clean space for the next piece of work.'}
              </div>
            </button>

            {projects.map((project) => (
              <article
                key={project.id}
                className={styles.projectCard}
                onClick={() => handleEnterProject(project)}
              >
                <div className={styles.projectHeader}>
                  <div className={styles.projectName} title={project.name}>
                    {project.name}
                  </div>

                  <div className={styles.cardActions} onClick={(event) => event.stopPropagation()}>
                    <Tooltip title={isZh ? '编辑项目' : 'Edit project'}>
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        className={styles.cardIconButton}
                        onClick={() => handleEdit(project)}
                      />
                    </Tooltip>
                    <Popconfirm
                      title={t('dashboard.deleteConfirm')}
                      onConfirm={() => void handleDelete(project.id)}
                      okText={t('common.ok')}
                      cancelText={t('common.cancel')}
                    >
                      <Tooltip title={isZh ? '删除项目' : 'Delete project'}>
                        <Button
                          type="text"
                          icon={<DeleteOutlined />}
                          className={styles.cardIconButton}
                        />
                      </Tooltip>
                    </Popconfirm>
                  </div>
                </div>

                <div className={styles.projectDescription} title={project.description}>
                  {project.description || (isZh ? '还没有描述，可以稍后再补充。' : 'No description yet, you can add one later.')}
                </div>

                <div className={styles.projectFooter}>
                  <div className={styles.projectDate}>
                    <CalendarOutlined />
                    {formatDate(project.createdAt)}
                  </div>

                  <button
                    type="button"
                    className={styles.projectLink}
                    onClick={() => handleEnterProject(project)}
                  >
                    {isZh ? '进入项目' : 'Open'}
                    <ArrowRightOutlined />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>{emptyTitle}</div>
            <div className={styles.emptyText}>{emptyText}</div>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleCreate()}>
              {isZh ? '创建项目' : 'Create project'}
            </Button>
          </div>
        )}

        {total > 0 ? (
          <div className={styles.paginationWrap}>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              showTotal={(value) => t('dashboard.paginationTotal', { total: value })}
              onChange={(nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              }}
            />
          </div>
        ) : null}
      </section>

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
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label={t('dashboard.projectName')}
            rules={[{ required: true, message: t('dashboard.nameRequired') }]}
          >
            <Input placeholder={t('dashboard.namePlaceholder')} />
          </Form.Item>
          <Form.Item name="description" label={t('dashboard.projectDescription')}>
            <TextArea rows={4} placeholder={t('dashboard.descriptionPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
