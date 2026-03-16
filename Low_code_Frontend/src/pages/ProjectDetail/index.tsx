import { useEffect, useMemo, useState } from 'react';
import { App, Breadcrumb, Button, Empty, Form, Input, Modal, Pagination, Popconfirm, Spin, Tabs, Tooltip } from 'antd';
import {
  ApiOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { projectApi } from '@/api/project';
import { workflowApi } from '@/api/workflow';
import { ProjectAssetsContent } from '@/pages/ProjectAssets';
import type { PageRequest } from '@/types/api';
import type { Project } from '@/types/project';
import type { Workflow } from '@/types/workflow';
import styles from './index.module.scss';

const { TextArea } = Input;

type ProjectPrimaryTab = 'workflows' | 'assets';

export default function ProjectDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const { projectId } = useParams<{ projectId: string }>();
  const isZh = i18n.language === 'zh-CN';

  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  const projectIdNumber = Number(projectId);

  const activeTab = useMemo<ProjectPrimaryTab>(
    () => (location.pathname.includes('/assets') ? 'assets' : 'workflows'),
    [location.pathname],
  );

  useEffect(() => {
    if (!projectId) return;

    const run = async () => {
      try {
        setProjectLoading(true);
        const data = await projectApi.getProjectById(Number(projectId));
        setProject(data);
      } catch (error: any) {
        message.error(error.message || t('dashboard.loadFailed'));
      } finally {
        setProjectLoading(false);
      }
    };

    void run();
  }, [message, projectId, t]);

  useEffect(() => {
    if (activeTab !== 'workflows') return;
    if (!projectId) return;

    const run = async () => {
      try {
        setWorkflowLoading(true);
        const params: PageRequest = {
          page,
          pageSize,
        };
        const response = await workflowApi.getWorkflowList({
          ...params,
          projectId: Number(projectId),
        });
        setWorkflows(response?.list || []);
        setTotal(response?.total || 0);
      } catch (error: any) {
        message.error(error.message || t('workflow.execFailed'));
      } finally {
        setWorkflowLoading(false);
      }
    };

    void run();
  }, [activeTab, message, page, pageSize, projectId, t]);

  const refreshWorkflows = async (nextPage = page, nextPageSize = pageSize) => {
    if (!projectId) return;

    try {
      setWorkflowLoading(true);
      const response = await workflowApi.getWorkflowList({
        page: nextPage,
        pageSize: nextPageSize,
        projectId: Number(projectId),
      });
      setWorkflows(response?.list || []);
      setTotal(response?.total || 0);
    } catch (error: any) {
      message.error(error.message || t('workflow.execFailed'));
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleSubmit = async (values: { name: string; description?: string }) => {
    if (!projectId) return;

    try {
      if (editingWorkflow) {
        await workflowApi.updateWorkflow(editingWorkflow.id, values);
      } else {
        await workflowApi.createWorkflow({
          ...values,
          projectId: Number(projectId),
        });
      }
      message.success(t('workflow.execSuccess'));
      setModalVisible(false);
      form.resetFields();
      setEditingWorkflow(null);
      void refreshWorkflows();
    } catch (error: any) {
      message.error(error.message || t('common.operationFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await workflowApi.deleteWorkflow(id);
      message.success(t('workflow.execSuccess'));
      void refreshWorkflows();
    } catch (error: any) {
      message.error(error.message || t('common.operationFailed'));
    }
  };

  const handleEdit = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    form.setFieldsValue({
      name: workflow.name,
      description: workflow.description,
    });
    setModalVisible(true);
  };

  const handleCreate = () => {
    setEditingWorkflow(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    navigate(`/projects/${projectId}/workflows/${workflow.id}/edit`);
  };

  const handleExecute = async (workflow: Workflow) => {
    try {
      const hide = message.loading(t('workflow.executeWorkflow'), 0);
      await workflowApi.executeWorkflow({
        workflowId: workflow.id,
      });
      hide();
      message.success(t('workflow.execSuccess'));
    } catch (error: any) {
      message.error(error.message || t('workflow.execFailed'));
    }
  };

  const handleOpenAPI = (workflow: Workflow) => {
    navigate(`/projects/${projectId}/workflows/${workflow.id}/api`);
  };

  const filteredWorkflows = useMemo(
    () =>
      workflows.filter(
        (workflow) =>
          workflow.name.toLowerCase().includes(searchText.toLowerCase()) ||
          (workflow.description || '').toLowerCase().includes(searchText.toLowerCase()),
      ),
    [searchText, workflows],
  );

  const formatDate = (dateStr?: string) => {
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

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      draft: t('workflow.statusDraft'),
      published: t('workflow.statusPublished'),
      archived: t('workflow.statusArchived'),
    };
    return statusMap[status] || status;
  };

  const getStatusClassName = (status: string) => {
    if (status === 'published') return styles.statusPublished;
    if (status === 'archived') return styles.statusArchived;
    return styles.statusDraft;
  };

  const pageDescription = project?.description || (isZh ? '保持页面安静，把当前项目需要继续推进的内容留在眼前。' : 'Keep this space quiet and leave the next useful action within reach.');

  const heroMetaItems = [
    {
      label: isZh ? '创建时间' : 'Created',
      value: formatDate(project?.createdAt),
    },
    {
      label: isZh ? '最近更新' : 'Updated',
      value: formatDate(project?.updatedAt),
    },
    {
      label: activeTab === 'workflows' ? (isZh ? '工作流' : 'Workflows') : (isZh ? '当前区域' : 'Current section'),
      value:
        activeTab === 'workflows'
          ? (isZh ? `共 ${total} 个` : `${total} total`)
          : isZh
            ? '资产管理'
            : 'Asset library',
    },
  ];

  const sideCardTitle =
    activeTab === 'workflows'
      ? isZh
        ? '从这里继续流程设计'
        : 'Continue building workflows'
      : isZh
        ? '从这里整理项目资产'
        : 'Organize project assets here';
  const sideCardText =
    activeTab === 'workflows'
      ? isZh
        ? '保持工作流列表简洁，只把创建、编辑、执行这几个关键动作留在前面。'
        : 'Keep the workflow list light and leave only create, edit, and run close at hand.'
      : isZh
        ? '知识、网站源和产物都收在一个资源视图里，方便继续补充和维护。'
        : 'Knowledge, sources, and artifacts stay in one calmer library view for ongoing maintenance.';

  const renderWorkflowPanel = () => {
    if (workflowLoading && workflows.length === 0) {
      return (
        <div className={styles.loadingShell}>
          <Spin />
        </div>
      );
    }

    if (!workflowLoading && total === 0) {
      return (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>{isZh ? '还没有工作流' : 'No workflows yet'}</div>
          <div className={styles.emptyText}>
            {isZh ? '先建立一个干净的流程起点，后续再逐步补充节点和描述。' : 'Start with a clean workflow and add nodes, rules, and details when you need them.'}
          </div>
          <Button type="primary" className={styles.primaryButton} icon={<PlusOutlined />} onClick={handleCreate}>
            {t('workflow.createWorkflow')}
          </Button>
        </div>
      );
    }

    return (
      <>
        <div className={styles.panelHeader}>
          <div>
            <div className={styles.panelTitle}>{isZh ? '工作流' : 'Workflows'}</div>
            <div className={styles.panelHint}>
              {isZh
                ? '把常用流程留在这个视图里，减少跳转和解释。'
                : 'Keep active flows in one clear view with less ceremony and less noise.'}
            </div>
          </div>
          <div className={styles.panelMeta}>
            {searchText && filteredWorkflows.length !== workflows.length
              ? isZh
                ? `筛选后 ${filteredWorkflows.length} 个`
                : `${filteredWorkflows.length} shown`
              : isZh
                ? `当前页 ${workflows.length} 个`
                : `${workflows.length} on this page`}
          </div>
        </div>

        <div className={styles.toolbar}>
          <Input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            prefix={<SearchOutlined />}
            placeholder={t('workflow.searchPlaceholder', isZh ? '搜索工作流' : 'Search workflows')}
            className={styles.searchInput}
            allowClear
          />
          <div className={styles.toolbarActions}>
            <Button className={styles.softButton} onClick={() => navigate(`/projects/${projectIdNumber}/assets`)}>
              {t('projectDetail.assetsTab')}
            </Button>
            <Button type="primary" className={styles.primaryButton} icon={<PlusOutlined />} onClick={handleCreate}>
              {t('workflow.createWorkflow')}
            </Button>
          </div>
        </div>

        {filteredWorkflows.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>{isZh ? '没有匹配结果' : 'No matching workflows'}</div>
            <div className={styles.emptyText}>
              {isZh ? '可以换个关键词，或者直接新建一个工作流。' : 'Try a different keyword, or start a new workflow instead.'}
            </div>
            <Button onClick={() => setSearchText('')} className={styles.softButton}>
              {isZh ? '清空搜索' : 'Clear search'}
            </Button>
          </div>
        ) : (
          <div className={styles.workflowGrid}>
            <button type="button" className={styles.createCard} onClick={handleCreate}>
              <PlusOutlined className={styles.createIcon} />
              <div className={styles.createTitle}>{isZh ? '新建工作流' : 'New workflow'}</div>
              <div className={styles.createText}>
                {isZh ? '为这个项目留出一个新的流程入口。' : 'Open a fresh workflow space for this project.'}
              </div>
            </button>

            {filteredWorkflows.map((workflow) => (
              <article
                key={workflow.id}
                className={styles.workflowCard}
                onClick={() => handleEditWorkflow(workflow)}
              >
                <div className={styles.cardTopRow}>
                  <span className={`${styles.statusPill} ${getStatusClassName(workflow.status)}`}>
                    {getStatusLabel(workflow.status)}
                  </span>
                </div>

                <div className={styles.cardTitle} title={workflow.name}>
                  {workflow.name}
                </div>

                <div className={styles.cardDescription} title={workflow.description}>
                  {workflow.description || t('common.noDescription', isZh ? '暂时还没有描述' : 'No description yet')}
                </div>

                <div className={styles.cardMeta}>
                  <span className={styles.metaText}>
                    <CalendarOutlined />
                    {formatDate(workflow.updatedAt || workflow.createdAt)}
                  </span>
                </div>

                <div className={styles.cardFooter} onClick={(event) => event.stopPropagation()}>
                  <Tooltip title={t('common.edit')}>
                    <Button type="text" icon={<EditOutlined />} className={styles.cardAction} onClick={() => handleEdit(workflow)} />
                  </Tooltip>
                  <Tooltip title={t('common.execute')}>
                    <Button type="text" icon={<PlayCircleOutlined />} className={styles.cardAction} onClick={() => void handleExecute(workflow)} />
                  </Tooltip>
                  <Tooltip title={t('projectDetail.openApi')}>
                    <Button type="text" icon={<ApiOutlined />} className={styles.cardAction} onClick={() => handleOpenAPI(workflow)} />
                  </Tooltip>
                  <Popconfirm
                    title={t('workflow.deleteConfirm')}
                    onConfirm={() => void handleDelete(workflow.id)}
                    okText={t('common.ok')}
                    cancelText={t('common.cancel')}
                  >
                    <Tooltip title={t('common.delete')}>
                      <Button type="text" danger icon={<DeleteOutlined />} className={styles.cardAction} />
                    </Tooltip>
                  </Popconfirm>
                </div>

                <button
                  type="button"
                  className={styles.openLink}
                  onClick={() => handleEditWorkflow(workflow)}
                >
                  {isZh ? '进入编辑' : 'Open editor'}
                  <ArrowRightOutlined />
                </button>
              </article>
            ))}
          </div>
        )}

        {total > 0 ? (
          <div className={styles.paginationWrap}>
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              showTotal={(value) => t('workflow.paginationTotal', { total: value })}
              onChange={(nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              }}
            />
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.glow} />

      <section className={styles.heroSection}>
        <div className={styles.breadcrumbWrap}>
          <Breadcrumb
            items={[
              {
                title: (
                  <button type="button" className={styles.breadcrumbButton} onClick={() => navigate('/')}>
                    {t('dashboard.projectsList')}
                  </button>
                ),
              },
              { title: project?.name || t('dashboard.projectDetail') },
            ]}
          />
        </div>

        <div className={styles.heroHeader}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>{isZh ? '项目空间' : 'Project space'}</span>
            <h1 className={styles.title}>{project?.name || t('dashboard.projectDetail')}</h1>
            <p className={styles.subtitle}>{projectLoading ? (isZh ? '正在加载项目内容…' : 'Loading project details...') : pageDescription}</p>
          </div>

          <div className={styles.heroActions}>
            <Button className={styles.softButton} onClick={() => navigate('/')}>
              {isZh ? '返回项目列表' : 'All projects'}
            </Button>
            <Button
              type="primary"
              className={styles.primaryButton}
              icon={activeTab === 'workflows' ? <PlusOutlined /> : <AppstoreOutlined />}
              onClick={() => (activeTab === 'workflows' ? handleCreate() : navigate(`/projects/${projectIdNumber}/workflows`))}
            >
              {activeTab === 'workflows' ? t('workflow.createWorkflow') : t('projectDetail.workflowsTab')}
            </Button>
          </div>
        </div>

        <div className={styles.metaGrid}>
          {heroMetaItems.map((item) => (
            <div key={item.label} className={styles.metaCard}>
              <div className={styles.metaLabel}>{item.label}</div>
              <div className={styles.metaValue}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.workspaceSection}>
        <div className={styles.mainColumn}>
          <div className={styles.surface}>
            <Tabs
              activeKey={activeTab}
              onChange={(key) => navigate(`/projects/${projectIdNumber}/${key}`)}
              items={[
                {
                  key: 'workflows',
                  label: (
                    <span className={styles.tabItem}>
                      <AppstoreOutlined />
                      {t('projectDetail.workflowsTab')}
                    </span>
                  ),
                  children: renderWorkflowPanel(),
                },
                {
                  key: 'assets',
                  label: (
                    <span className={styles.tabItem}>
                      <FolderOpenOutlined />
                      {t('projectDetail.assetsTab')}
                    </span>
                  ),
                  children: <ProjectAssetsContent embedded={true} projectId={projectIdNumber} project={project} />,
                },
              ]}
            />
          </div>
        </div>

        <aside className={styles.sideColumn}>
          <div className={styles.sideCard}>
            <div className={styles.sideEyebrow}>{isZh ? '从这里继续' : 'Continue from here'}</div>
            <div className={styles.sideTitle}>{sideCardTitle}</div>
            <div className={styles.sideText}>{sideCardText}</div>
            <div className={styles.sideActionStack}>
              <Button
                type="primary"
                className={styles.primaryButton}
                icon={activeTab === 'workflows' ? <PlusOutlined /> : <FolderOpenOutlined />}
                onClick={() => (activeTab === 'workflows' ? handleCreate() : navigate(`/projects/${projectIdNumber}/assets`))}
                block
              >
                {activeTab === 'workflows'
                  ? t('workflow.createWorkflow')
                  : isZh
                    ? '打开资产视图'
                    : 'Open assets'}
              </Button>
              <Button
                className={styles.softButton}
                onClick={() =>
                  navigate(`/projects/${projectIdNumber}/${activeTab === 'workflows' ? 'assets' : 'workflows'}`)
                }
                block
              >
                {activeTab === 'workflows' ? t('projectDetail.assetsTab') : t('projectDetail.workflowsTab')}
              </Button>
            </div>
          </div>

          <div className={styles.sideCard}>
            <div className={styles.sideEyebrow}>{isZh ? '项目信息' : 'Project info'}</div>
            <div className={styles.sideInfoList}>
              <div className={styles.sideInfoRow}>
                <span>{isZh ? '项目名称' : 'Project'}</span>
                <span>{project?.name || '-'}</span>
              </div>
              <div className={styles.sideInfoRow}>
                <span>{isZh ? '创建时间' : 'Created'}</span>
                <span>{formatDate(project?.createdAt)}</span>
              </div>
              <div className={styles.sideInfoRow}>
                <span>{isZh ? '更新时间' : 'Updated'}</span>
                <span>{formatDate(project?.updatedAt)}</span>
              </div>
              <div className={styles.sideInfoRow}>
                <span>{isZh ? '当前页工作流' : 'Workflows on page'}</span>
                <span>{workflows.length}</span>
              </div>
            </div>

            {activeTab === 'workflows' && workflows.length === 0 && !workflowLoading ? (
              <div className={styles.sideEmptyNote}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={isZh ? '先创建一个工作流，项目会更容易继续。' : 'Create the first workflow to give this project a clearer starting point.'}
                />
              </div>
            ) : null}
          </div>
        </aside>
      </section>

      <Modal
        title={editingWorkflow ? t('workflow.editWorkflow') : t('workflow.createWorkflow')}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setEditingWorkflow(null);
        }}
        onOk={() => form.submit()}
        okText={t('common.ok')}
        cancelText={t('common.cancel')}
        centered
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label={t('workflow.workflowName')}
            rules={[{ required: true, message: t('workflow.workflowName') }]}
          >
            <Input placeholder={t('workflow.workflowName')} />
          </Form.Item>
          <Form.Item name="description" label={t('workflow.workflowDescription')}>
            <TextArea rows={4} placeholder={t('workflow.workflowDescription')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
