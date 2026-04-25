import { useCallback, useEffect, useMemo, useState } from 'react';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, InputNumber, message, Modal, Popconfirm, Space, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import {
  createBillingPackage,
  deleteBillingPackage,
  getBillingPackages,
  updateBillingPackage,
  updateBillingPackageStatus,
} from '@/features/billing/api/quota';
import type { BillingPackage, BillingPackagePayload } from '@/features/billing/types';
import styles from './Billing.module.scss';

type PackageFormValues = BillingPackagePayload;

const defaultFormValues: PackageFormValues = {
  id: '',
  name: '',
  nameEn: '',
  price: 9.9,
  stardust: 1000000,
  tag: '',
  tagEn: '',
  description: '',
  descriptionEn: '',
  status: 'active',
  sortOrder: 10,
};

export default function PackagesPage() {
  const { t } = useI18n();
  const { canEdit } = useAdminPermission('billing.packages');
  const [form] = Form.useForm<PackageFormValues>();
  const [packages, setPackages] = useState<BillingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BillingPackage | null>(null);
  const watchedStatus = Form.useWatch('status', form);

  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      setPackages(await getBillingPackages());
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('billing.errorPackagesFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  const activeCount = useMemo(() => packages.filter((item) => item.status === 'active').length, [packages]);

  function openCreateModal() {
    setEditing(null);
    form.setFieldsValue(defaultFormValues);
    setModalOpen(true);
  }

  function openEditModal(record: BillingPackage) {
    setEditing(record);
    form.setFieldsValue({
      id: record.id,
      name: record.name,
      nameEn: record.nameEn ?? '',
      price: record.price,
      stardust: record.stardust,
      tag: record.tag ?? '',
      tagEn: record.tagEn ?? '',
      description: record.description ?? '',
      descriptionEn: record.descriptionEn ?? '',
      status: record.status,
      sortOrder: record.sortOrder,
    });
    setModalOpen(true);
  }

  async function submitPackage() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await updateBillingPackage(editing.id, values);
      } else {
        await createBillingPackage(values);
      }
      message.success(t('billing.packageSaved'));
      setModalOpen(false);
      await loadPackages();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('billing.errorPackageSaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(record: BillingPackage, checked: boolean) {
    try {
      await updateBillingPackageStatus(record.id, checked ? 'active' : 'inactive');
      message.success(checked ? t('billing.packagePublished') : t('billing.packageUnpublished'));
      await loadPackages();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('billing.errorPackageStatusFailed'));
    }
  }

  async function handleDelete(record: BillingPackage) {
    try {
      await deleteBillingPackage(record.id);
      message.success(t('billing.packageDeleted'));
      await loadPackages();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('billing.errorPackageDeleteFailed'));
    }
  }

  const columns: ColumnsType<BillingPackage> = [
    { title: t('billing.packageColumnSort'), dataIndex: 'sortOrder', key: 'sortOrder', width: 90 },
    { title: t('billing.packageColumnId'), dataIndex: 'id', key: 'id', width: 140 },
    {
      title: t('billing.packageColumnName'),
      dataIndex: 'name',
      key: 'name',
      render: (value, record) => (
        <Space>
          <span>{value}</span>
          {record.tag ? <Tag>{record.tag}</Tag> : null}
        </Space>
      ),
    },
    {
      title: t('billing.packageColumnPrice'),
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
    {
      title: t('billing.packageColumnStardust'),
      dataIndex: 'stardust',
      key: 'stardust',
      width: 150,
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: t('billing.packageColumnUnitPrice'),
      key: 'unitPrice',
      width: 160,
      render: (_, record) => `¥${((record.price / record.stardust) * 1000000).toFixed(2)}`,
    },
    {
      title: t('billing.packageColumnStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (_, record) => (
        <Switch
          checked={record.status === 'active'}
          checkedChildren={t('billing.packageStatusActive')}
          unCheckedChildren={t('billing.packageStatusInactive')}
          disabled={!canEdit}
          onChange={(checked) => void toggleStatus(record, checked)}
        />
      ),
    },
    {
      title: t('billing.packageColumnActions'),
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} disabled={!canEdit} onClick={() => openEditModal(record)}>
            {t('billing.packageEdit')}
          </Button>
          <Popconfirm
            title={t('billing.packageDeleteConfirm')}
            okText={t('billing.packageDelete')}
            cancelText={t('billing.packageCancel')}
            disabled={!canEdit}
            onConfirm={() => void handleDelete(record)}
          >
            <Button size="small" danger disabled={!canEdit}>
              {t('billing.packageDelete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <Card
        className={styles.card}
        title={t('billing.packagesTitle')}
        extra={
          <Space>
            <Tag color="green">{t('billing.packagesActiveCount', { count: activeCount })}</Tag>
            <Button type="primary" icon={<PlusOutlined />} disabled={!canEdit} onClick={openCreateModal}>
              {t('billing.packageCreate')}
            </Button>
          </Space>
        }
      >
        <p className={styles.muted}>{t('billing.packagesDescription')}</p>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={packages}
          pagination={false}
          scroll={{ x: 1080 }}
        />
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? t('billing.packageEditTitle') : t('billing.packageCreateTitle')}
        okText={t('billing.packageSave')}
        cancelText={t('billing.packageCancel')}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        onOk={() => void submitPackage()}
        destroyOnClose
      >
        <Form<PackageFormValues> form={form} layout="vertical" initialValues={defaultFormValues}>
          <Form.Item name="id" label={t('billing.packageFieldId')} rules={[{ required: true }]}>
            <Input disabled={Boolean(editing)} placeholder={t('billing.packageFieldIdPlaceholder')} />
          </Form.Item>
          <Form.Item name="name" label={t('billing.packageFieldName')} rules={[{ required: true }]}>
            <Input placeholder={t('billing.packageFieldNamePlaceholder')} />
          </Form.Item>
          <Form.Item name="nameEn" label={t('billing.packageFieldNameEn')}>
            <Input placeholder={t('billing.packageFieldNameEnPlaceholder')} />
          </Form.Item>
          <Form.Item name="price" label={t('billing.packageFieldPrice')} rules={[{ required: true, type: 'number', min: 0.01 }]}>
            <InputNumber min={0.01} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="stardust" label={t('billing.packageFieldStardust')} rules={[{ required: true, type: 'number', min: 1 }]}>
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="tag" label={t('billing.packageFieldTag')}>
            <Input placeholder={t('billing.packageFieldTagPlaceholder')} />
          </Form.Item>
          <Form.Item name="tagEn" label={t('billing.packageFieldTagEn')}>
            <Input placeholder={t('billing.packageFieldTagEnPlaceholder')} />
          </Form.Item>
          <Form.Item name="description" label={t('billing.packageFieldDescription')}>
            <Input.TextArea rows={3} placeholder={t('billing.packageFieldDescriptionPlaceholder')} />
          </Form.Item>
          <Form.Item name="descriptionEn" label={t('billing.packageFieldDescriptionEn')}>
            <Input.TextArea rows={3} placeholder={t('billing.packageFieldDescriptionEnPlaceholder')} />
          </Form.Item>
          <Form.Item name="sortOrder" label={t('billing.packageFieldSort')} rules={[{ required: true, type: 'number' }]}>
            <InputNumber precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label={t('billing.packageFieldStatus')}>
            <Switch
              checkedChildren={t('billing.packageStatusActive')}
              unCheckedChildren={t('billing.packageStatusInactive')}
              checked={watchedStatus === 'active'}
              onChange={(checked) => form.setFieldValue('status', checked ? 'active' : 'inactive')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
