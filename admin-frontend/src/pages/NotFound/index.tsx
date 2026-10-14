import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Result
      status="404"
      title="页面不存在"
      subTitle="当前路由未定义，或者模块还没有接入。"
      extra={
        <Button type="primary" onClick={() => navigate('/')}>
          返回后台首页
        </Button>
      }
    />
  );
}
