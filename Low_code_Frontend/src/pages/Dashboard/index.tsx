import { useState, useEffect } from 'react';
import { Card, Button, Table, Space, Modal, Form, Input, App, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, FolderOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { projectApi } from '@/api/project';
import type { Project, CreateProjectRequest } from '@/types/project';
import type { PageRequest } from '@/types/api';
import styles from './index.module.scss';

const { TextArea } = Input;

export default function Dashboard() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
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
  const handleCreate = () => {
    setEditingProject(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 进入项目详情（工作流列表）
  const handleEnterProject = (project: Project) => {
    navigate(`/projects/${project.id}/workflows`);
  };

  const columns = [
    {
      title: t('dashboard.projectName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Project) => (
        <Space>
          <FolderOutlined />
          <a onClick={() => handleEnterProject(record)}>{text}</a>
        </Space>
      ),
    },
    {
      title: t('dashboard.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('dashboard.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? t('dashboard.statusActive') : t('dashboard.statusArchived')}
        </Tag>
      ),
    },
    {
      title: t('dashboard.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString(i18n.language === 'zh-CN' ? 'zh-CN' : 'en-US'),
    },
    {
      title: t('common.actions'),
      key: 'action',
      render: (_: any, record: Project) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('common.edit')}
          </Button>
          <Popconfirm
            title={t('dashboard.deleteConfirm')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.ok')}
            cancelText={t('common.cancel')}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <Card
        title={t('dashboard.title')}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            {t('dashboard.createProject')}
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={projects}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => t('dashboard.paginationTotal', { total }),
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>

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

