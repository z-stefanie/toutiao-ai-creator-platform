import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
  })
});

const createdAt = new Date();
const userId = 'user_demo_creator';

async function main() {
  await prisma.rankingMetric.deleteMany();
  await prisma.aiCallLog.deleteMany();
  await prisma.qualityScore.deleteMany();
  await prisma.auditResult.deleteMany();
  await prisma.content.deleteMany();
  await prisma.draft.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.prompt.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      id: userId,
      email: 'demo@toutiao.ai',
      nickname: '训练营创作者',
      role: 'creator',
      createdAt
    }
  });

  await prisma.prompt.create({
    data: {
      id: 'prompt_short_post',
      ownerId: userId,
      name: '热点短图文创作',
      description: '把素材和观点整理成适合信息流消费的短图文。',
      template:
        '请围绕主题生成今日头条风格短图文：标题清晰、正文分段、信息密度高，结尾给出可执行建议。',
      category: 'short_post',
      status: 'active',
      createdAt,
      updatedAt: createdAt
    }
  });

  await prisma.asset.createMany({
    data: [
      {
        id: 'asset_city',
        ownerId: userId,
        type: 'image',
        url: '/demo-assets/city-workspace.svg',
        filename: 'city-workspace.svg',
        mimeType: 'image/svg+xml',
        size: 1200,
        complianceStatus: 'passed',
        createdAt
      },
      {
        id: 'asset_chart',
        ownerId: userId,
        type: 'image',
        url: '/demo-assets/content-chart.svg',
        filename: 'content-chart.svg',
        mimeType: 'image/svg+xml',
        size: 1400,
        complianceStatus: 'passed',
        createdAt
      }
    ]
  });

  const contentOne = {
    id: 'content_seed_1',
    authorId: userId,
    title: 'AI 进入创作工作台后，创作者真正省下的是什么',
    summary: '从选题、素材归纳到发布前审核，AI 更像一个稳定的副驾驶。',
    body:
      'AI 创作工具的价值不只是更快地产出文字，而是把创作者从重复整理、格式调整、风险自查中解放出来。\n\n一个完整的创作工作台应该把灵感、素材、草稿、审核和分发放在同一条链路中。创作者保留判断权，AI 负责提供候选、检查风险并给出修改建议。\n\n当质量评分进入分发环节，内容生产就不再停留在发布按钮之前，而会形成持续优化的闭环。',
    coverUrl: '/demo-assets/city-workspace.svg',
    assetIdsJson: JSON.stringify(['asset_city']),
    tagsJson: JSON.stringify(['AI创作', '人机协同', '内容生产']),
    status: 'published',
    auditResultId: 'audit_seed_1',
    qualityScoreId: 'quality_seed_1',
    publishedAt: createdAt,
    createdAt,
    updatedAt: createdAt
  };

  const contentTwo = {
    id: 'content_seed_2',
    authorId: userId,
    title: '爆文榜单不该只看热度，还要看内容质量',
    summary: '质量分、阅读热度和发布时间结合，才能避免榜单被单一指标绑架。',
    body:
      '单纯按照阅读量排序，会让早发布内容和标题党天然占优。更合理的方式是把质量分、热度和新鲜度组合起来。\n\n质量分来自结构、可读性、信息密度和图文匹配度等维度；热度来自阅读、点赞、评论、分享；新鲜度则控制内容生命周期。\n\n这种排序方式最大的好处是可解释，创作者也能知道自己应该优化哪里。',
    coverUrl: '/demo-assets/content-chart.svg',
    assetIdsJson: JSON.stringify(['asset_chart']),
    tagsJson: JSON.stringify(['榜单排序', '内容质量', '推荐系统']),
    status: 'published',
    auditResultId: 'audit_seed_2',
    qualityScoreId: 'quality_seed_2',
    publishedAt: createdAt,
    createdAt,
    updatedAt: createdAt
  };

  await prisma.content.createMany({ data: [contentOne, contentTwo] });

  await prisma.auditResult.createMany({
    data: [
      {
        id: 'audit_seed_1',
        contentId: contentOne.id,
        passed: true,
        riskLevel: 'none',
        categoriesJson: JSON.stringify([]),
        hitSpansJson: JSON.stringify([]),
        action: 'allow',
        suggestion: '内容合规，可发布。',
        modelName: 'mock-audit-v1',
        createdAt
      },
      {
        id: 'audit_seed_2',
        contentId: contentTwo.id,
        passed: true,
        riskLevel: 'none',
        categoriesJson: JSON.stringify([]),
        hitSpansJson: JSON.stringify([]),
        action: 'allow',
        suggestion: '内容合规，可发布。',
        modelName: 'mock-audit-v1',
        createdAt
      }
    ]
  });

  await prisma.qualityScore.createMany({
    data: [
      {
        id: 'quality_seed_1',
        contentId: contentOne.id,
        total: 88,
        dimensionsJson: JSON.stringify({
          originality: 86,
          structure: 90,
          readability: 91,
          informationDensity: 84,
          titleAttraction: 88,
          imageTextMatch: 87
        }),
        reasonsJson: JSON.stringify(['结构完整', '信息密度稳定', '标题表达清楚']),
        modelName: 'mock-quality-v1',
        createdAt
      },
      {
        id: 'quality_seed_2',
        contentId: contentTwo.id,
        total: 84,
        dimensionsJson: JSON.stringify({
          originality: 82,
          structure: 87,
          readability: 85,
          informationDensity: 86,
          titleAttraction: 83,
          imageTextMatch: 80
        }),
        reasonsJson: JSON.stringify(['排序观点明确', '解释性较强', '可继续补充案例']),
        modelName: 'mock-quality-v1',
        createdAt
      }
    ]
  });

  await prisma.rankingMetric.createMany({
    data: [
      {
        contentId: contentOne.id,
        qualityScore: 88,
        viewCount: 2460,
        likeCount: 188,
        commentCount: 36,
        shareCount: 41,
        heatScore: 82,
        freshnessScore: 90,
        rankingScore: 86.3,
        calculatedAt: createdAt
      },
      {
        contentId: contentTwo.id,
        qualityScore: 84,
        viewCount: 1980,
        likeCount: 142,
        commentCount: 28,
        shareCount: 33,
        heatScore: 74,
        freshnessScore: 88,
        rankingScore: 81.3,
        calculatedAt: createdAt
      }
    ]
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
