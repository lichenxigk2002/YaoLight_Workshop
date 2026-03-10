import PlaceholderPage from '@/pages/_shared/PlaceholderPage';

export default function WorkflowTemplatesPage() {
  return (
    <PlaceholderPage
      eyebrow="工作流模板"
      title="工作流模板管理"
      description="围绕现有 workflows 表的模板能力，做模板审核、上下架、推荐、分类和运营管理。"
      tags={['模板审核', '推荐位', '上下架', '分类标签']}
      cards={[
        {
          title: '模板治理',
          description: '后续接入审核状态、发布时间、推荐分数、模板详情和复用次数。',
          bullets: ['待审核列表', '推荐排序', '上下架', '模板详情'],
        },
        {
          title: '与现有模型的关系',
          description: '复用当前 workflow 实体，不额外新建一套模板引擎。',
          bullets: ['is_template', 'is_public', 'category', 'tags'],
        },
      ]}
    />
  );
}
