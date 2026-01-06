import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Descriptions, Avatar, Modal } from 'antd';
import { UserOutlined, EditOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/redux/auth';
import { userApi } from '@/api/user';
import styles from './index.module.scss';

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 刷新用户信息
  const refreshUserInfo = async () => {
    try {
      const userData = await userApi.getCurrentUser();
      setUser(userData);
    } catch (error: any) {
      message.error('获取用户信息失败');
    }
  };

  useEffect(() => {
    refreshUserInfo();
  }, []);

  // 修改用户名
  const handleUpdateUsername = async (values: { username: string }) => {
    try {
      setLoading(true);
      await userApi.updateUsername(values.username);
      message.success('用户名修改成功');
      setModalVisible(false);
      form.resetFields();
      // 刷新用户信息
      await refreshUserInfo();
    } catch (error: any) {
      message.error(error.message || '修改用户名失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Card title="个人信息" className={styles.card}>
        <div className={styles.avatarSection}>
          <Avatar size={80} icon={<UserOutlined />} style={{ backgroundColor: '#000' }} />
          <div className={styles.userInfo}>
            <h2>{user?.username || '未知用户'}</h2>
            <p className={styles.email}>{user?.email}</p>
          </div>
        </div>

        <Descriptions column={1} className={styles.descriptions}>
          <Descriptions.Item label="用户名">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span>{user?.username}</span>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => {
                  form.setFieldsValue({ username: user?.username });
                  setModalVisible(true);
                }}
              >
                修改
              </Button>
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="邮箱">{user?.email}</Descriptions.Item>
          <Descriptions.Item label="手机号">{user?.phone || '未绑定'}</Descriptions.Item>
          <Descriptions.Item label="角色">
            {user?.role === 'admin' ? '管理员' : '普通用户'}
          </Descriptions.Item>
          <Descriptions.Item label="账号状态">
            {user?.status === 'active' ? '正常' : '未激活'}
          </Descriptions.Item>
          <Descriptions.Item label="登录次数">{user?.login_count || 0}</Descriptions.Item>
          <Descriptions.Item label="上次登录">
            {user?.last_login_at
              ? new Date(user.last_login_at).toLocaleString('zh-CN')
              : '无记录'}
          </Descriptions.Item>
          <Descriptions.Item label="注册时间">
            {user?.createdAt
              ? new Date(user.createdAt).toLocaleString('zh-CN')
              : '未知'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Modal
        title="修改用户名"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={loading}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleUpdateUsername}>
          <Form.Item
            name="username"
            label="新用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' },
              { max: 50, message: '用户名最多50个字符' },
              {
                pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
                message: '用户名只能包含字母、数字、下划线和中文',
              },
            ]}
          >
            <Input placeholder="请输入新用户名" maxLength={50} />
          </Form.Item>
          <div style={{ color: '#999', fontSize: '12px' }}>
            提示：用户名修改后将作为您的显示名称
          </div>
        </Form>
      </Modal>
    </div>
  );
}

