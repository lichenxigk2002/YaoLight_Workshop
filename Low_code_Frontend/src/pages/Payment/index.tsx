import React from 'react';
import { Typography, Card, Button, Row, Col, Tag, Space, Alert } from 'antd';
import { AlipayCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { StardustIcon } from '@/components/Icons';

const { Title, Text, Paragraph } = Typography;

export default function Payment() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // 模拟套餐数据 (后续从后端获取)
  // 计算基准：¥1 = 400,000 星尘（基于 DeepSeek 平均价格）
  const packages = [
    { id: 'pkg_s', name: '星火包', price: 9.9, stardust: 4000000, tag: '入门' },  // ¥9.9 = 396万星尘，调整为400万
    { id: 'pkg_m', name: '星云包', price: 49.9, stardust: 20000000, tag: '热门' },  // ¥49.9 = 1996万星尘，调整为2000万
    { id: 'pkg_l', name: '星河包', price: 199.9, stardust: 80000000, tag: '超值' },  // ¥199.9 = 7996万星尘，调整为8000万
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
      <Title level={2} style={{ textAlign: 'center', marginBottom: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        充值星尘 <StardustIcon size={24} />
      </Title>

      <Alert
        message="温馨提示"
        description="星尘是平台内的通用资源，用于抵扣 AI 模型的 Token 消耗。充值后永久有效。"
        type="info"
        showIcon
        style={{ marginBottom: 32 }}
      />

      <Row gutter={[24, 24]}>
        {packages.map((pkg) => (
          <Col xs={24} sm={8} key={pkg.id}>
            <Card
              hoverable
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
            >
              {pkg.tag && (
                <Tag color="blue" style={{ position: 'absolute', top: 16, right: 16 }}>
                  {pkg.tag}
                </Tag>
              )}
              <Title level={3} style={{ margin: '16px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {pkg.stardust.toLocaleString()} <StardustIcon size={20} />
              </Title>
              <Text type="secondary" style={{ marginBottom: 24 }}>星尘</Text>

              <Title level={2} style={{ margin: '0 0 24px', color: '#1677ff' }}>
                ¥{pkg.price}
              </Title>

              <Button
                type="primary"
                size="large"
                icon={<AlipayCircleOutlined />}
                block
                onClick={() => {
                  // TODO: 调用创建订单接口
                  console.log('Selected package:', pkg.id);
                }}
              >
                支付宝支付
              </Button>
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ marginTop: 40, textAlign: 'center' }}>
        <Text type="secondary">
          遇到问题？<a href="#">联系客服</a>
        </Text>
      </div>
    </div>
  );
}
