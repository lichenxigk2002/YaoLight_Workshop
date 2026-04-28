import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PlaceholderPage from '../PlaceholderPage';

describe('PlaceholderPage', () => {
  it('renders hero and all card bullets', () => {
    render(
      <PlaceholderPage
        eyebrow="建设中"
        title="知识库"
        description="管理上传内容和索引状态"
        tags={['文档', '检索']}
        cards={[
          {
            title: '数据接入',
            description: '查看导入进度',
            bullets: ['上传文件', '解析文本'],
          },
          {
            title: '质量控制',
            description: '定位异常数据',
            bullets: ['重复检测'],
          },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: '知识库' })).toBeInTheDocument();
    expect(screen.getByText('文档')).toBeInTheDocument();
    expect(screen.getByText('数据接入')).toBeInTheDocument();
    expect(screen.getByText('质量控制')).toBeInTheDocument();
    expect(screen.getByText('上传文件')).toBeInTheDocument();
    expect(screen.getByText('解析文本')).toBeInTheDocument();
    expect(screen.getByText('重复检测')).toBeInTheDocument();
  });
});
