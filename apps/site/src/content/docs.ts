export interface DocSection {
  id: string;
  title: string;
  summary?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface SiteDoc {
  slug: string;
  path: string;
  type: "page" | "faq" | "article" | "changelog";
  title: string;
  summary: string;
  updatedAt: string;
  effectiveAt?: string;
  label: string;
  heroNote?: string;
  sections: DocSection[];
}

export const siteDocs: SiteDoc[] = [
  {
    slug: "product",
    path: "/product",
    type: "page",
    title: "产品介绍",
    summary: "围绕下一顿吃什么，把计划、菜谱、冰箱、购物与饭搭子关系收成一条轻量闭环。",
    updatedAt: "2026-08-04",
    label: "产品",
    heroNote: "不是菜谱平台，也不是聊天工具，而是帮助家里把做饭决策真正推进下去。",
    sections: [
      {
        id: "loop",
        title: "核心闭环",
        paragraphs: [
          "炊火记关注的不是单次搜索一道菜，而是从想吃什么、怎么决定、缺什么食材，到最后真正做出来的一整段链路。",
          "小程序把菜谱、计划、冰箱、购物与饭局关系放在同一条家庭决策线上，减少做饭前的重复讨论和重复准备。"
        ]
      },
      {
        id: "modules",
        title: "核心模块",
        bullets: [
          "我的 / 灵感 / 合集：区分个人菜谱、系统灵感和只读收藏版本",
          "下一餐计划：把抽象想法落成明确餐次",
          "冰箱与采购：围绕缺口决定购物，不做复杂库存账本",
          "饭搭子：维护关系和邀请，不接管个人数据"
        ]
      },
      {
        id: "boundary",
        title: "不做什么",
        paragraphs: [
          "炊火记当前不把聊天、社区、评论、公开动态流和公开 UGC 运营站当作第一交付目标。",
          "官网也不会演变成 PC 业务端，登录后正式操作仍以小程序为主。"
        ]
      }
    ]
  },
  {
    slug: "scenes",
    path: "/scenes",
    type: "page",
    title: "适用场景",
    summary: "适合经常做饭、需要一起商量下一顿，但又不想把家务协作做成复杂项目的人。",
    updatedAt: "2026-08-04",
    label: "场景",
    sections: [
      {
        id: "couple",
        title: "情侣与二人家庭",
        paragraphs: [
          "日常最常见的问题不是没有菜谱，而是每天都要重新问一遍今天吃什么、冰箱里还有什么、要不要顺路买。",
          "炊火记适合把这些小决定收束成一个稳定流程，而不是每次都靠口头同步。"
        ]
      },
      {
        id: "family",
        title: "小家庭与饭搭子协作",
        paragraphs: [
          "如果家里成员经常一起吃饭，但购物、做饭、带菜、发起饭局的人并不固定，炊火记可以把这些关系表达得更清楚。",
          "关系是共享的，数据仍是个人的，避免把个人冰箱、购物和计划永久混成一个公共空间。"
        ]
      },
      {
        id: "learner",
        title: "正在建立厨房习惯的人",
        paragraphs: [
          "对正在学习备菜、做饭和整理的人，知识内容中心会比一堆零散收藏更稳定。",
          "官网与小程序内嵌内容保持同源，方便在不同设备上继续看。"
        ]
      }
    ]
  },
  {
    slug: "about",
    path: "/about",
    type: "page",
    title: "关于我们",
    summary: "炊火记希望把家庭里的做饭决策，从重复讨论变成更轻松的日常协作。",
    updatedAt: "2026-08-04",
    label: "关于",
    sections: [
      {
        id: "origin",
        title: "我们为什么做它",
        paragraphs: [
          "很多做饭问题并不是缺一道菜，而是缺一个能让家里人顺畅决定下一顿的轻量工具。",
          "炊火记从家庭做饭的真实日常出发，希望把计划、准备、采购和做饭记录连接起来。"
        ]
      },
      {
        id: "principles",
        title: "我们坚持的边界",
        bullets: [
          "先解决家庭做饭闭环，再考虑更大的内容或社区扩张",
          "个人数据归个人，不把饭搭子关系做成共享数据空间",
          "知识内容优先服务做饭过程，不追求内容站式流量堆叠"
        ]
      },
      {
        id: "contact",
        title: "联系与反馈",
        paragraphs: [
          "现阶段官网承担产品说明、内容阅读和后续联系方式承接。",
          "如果你愿意参与内测或提供建议，后续可通过官网更新页与小程序内入口获取最新进展。"
        ]
      }
    ]
  },
  {
    slug: "privacy",
    path: "/privacy",
    type: "page",
    title: "隐私政策",
    summary: "说明炊火记在当前阶段如何收集、使用、存储和保护必要的用户信息。",
    updatedAt: "2026-08-04",
    effectiveAt: "2026-08-04",
    label: "法务",
    sections: [
      {
        id: "scope",
        title: "1. 适用范围",
        paragraphs: [
          "本政策适用于炊火记官网、内容中心和小程序当前已开放的服务。",
          "如果未来新增独立业务模块，会在对应服务上线前补充说明。"
        ]
      },
      {
        id: "collect",
        title: "2. 我们收集哪些信息",
        bullets: [
          "账号与登录信息：例如手机号、账号标识、登录态信息",
          "基础资料：例如昵称、头像、与展示相关的最小资料字段",
          "业务数据：例如个人菜谱、计划、购物清单、饭搭子关系",
          "必要日志：例如请求时间、错误摘要和基础设备环境"
        ]
      },
      {
        id: "use",
        title: "3. 如何使用这些信息",
        bullets: [
          "完成登录、身份识别和基础安全校验",
          "保存你的个人菜谱、计划、购物和展示设置",
          "保障服务运行、排查问题和进行必要的产品改进"
        ]
      },
      {
        id: "protect",
        title: "4. 保护与控制",
        paragraphs: [
          "我们会按当前服务必要范围使用数据，不会把个人冰箱、购物或计划默认公开给其他人。",
          "如果你停止使用服务，具体的数据保留和删除策略将以届时有效的正式规则和产品能力为准。"
        ]
      }
    ]
  },
  {
    slug: "terms",
    path: "/terms",
    type: "page",
    title: "用户协议",
    summary: "说明炊火记服务的基本使用规则、可用范围、账号责任与内容边界。",
    updatedAt: "2026-08-04",
    effectiveAt: "2026-08-04",
    label: "法务",
    sections: [
      {
        id: "service",
        title: "1. 服务说明",
        paragraphs: [
          "炊火记当前提供家庭做饭相关的小程序服务、官网内容展示与基础支持页面。",
          "不同模块的开放状态可能不同，未正式开放的能力不构成现阶段可交付承诺。"
        ]
      },
      {
        id: "account",
        title: "2. 账号责任",
        paragraphs: [
          "你需要妥善保管自己的登录方式和账号信息，并对通过账号发生的操作负责。",
          "如果发现异常登录或未经授权的使用，请及时通过后续提供的渠道联系我们。"
        ]
      },
      {
        id: "content",
        title: "3. 内容与使用边界",
        bullets: [
          "请勿上传违法、侵权或明显不适宜公开推荐的内容",
          "灵感推荐与公开展示能力以实际审核与产品开放状态为准",
          "知识内容页仅作信息参考，不替代专业医疗、营养或食品安全建议"
        ]
      },
      {
        id: "change",
        title: "4. 变更与终止",
        paragraphs: [
          "我们可能根据产品演进调整服务内容、页面结构和部分规则，并在合理范围内更新说明。",
          "重大变更将结合官网内容页或产品内提示进行说明。"
        ]
      }
    ]
  },
  {
    slug: "faq",
    path: "/faq",
    type: "faq",
    title: "常见问题",
    summary: "集中回答炊火记当前阶段最常见的产品定位、使用方式与内容页问题。",
    updatedAt: "2026-08-04",
    label: "帮助",
    sections: [
      {
        id: "faq-what",
        title: "炊火记是菜谱站吗？",
        paragraphs: [
          "不是。菜谱是其中一部分，但产品核心是帮助你把下一顿真正安排顺，包括决定、计划、准备、购物和做饭记录。"
        ]
      },
      {
        id: "faq-pc",
        title: "官网会变成 PC 业务端吗？",
        paragraphs: [
          "当前不会。官网先承担品牌介绍、内容阅读、法务说明和后续承接，正式业务操作仍以小程序为主。"
        ]
      },
      {
        id: "faq-content",
        title: "为什么内容页同时支持 PC 和小程序？",
        paragraphs: [
          "关于我们、隐私政策、厨房准备这类内容天然适合单份维护、多端阅读。这样能减少重复维护，也方便分享与搜索收录。"
        ]
      },
      {
        id: "faq-dark",
        title: "内容页支持暗黑模式吗？",
        paragraphs: [
          "支持。官网与内容中心从首版开始按亮色和暗色双主题处理，不把亮色当成唯一前提。"
        ]
      }
    ]
  },
  {
    slug: "kitchen-prep",
    path: "/guides/kitchen-prep",
    type: "article",
    title: "厨房准备",
    summary: "从备菜、收纳、工具摆放到一餐前的准备顺序，帮助家里做饭更从容。",
    updatedAt: "2026-08-04",
    label: "厨房知识",
    sections: [
      {
        id: "prep-flow",
        title: "先准备，再开火",
        paragraphs: [
          "开始做饭前，先确认菜单、主要食材、缺口和所需工具，通常会比边做边找更省时间。",
          "如果一顿饭涉及多个菜，先做共同准备项，例如洗菜、切配、分装和腌制。"
        ]
      },
      {
        id: "prep-space",
        title: "给台面留出工作区",
        bullets: [
          "清出一块稳定切配区",
          "湿区与熟食区尽量分开",
          "常用调味料放在一步能拿到的位置"
        ]
      },
      {
        id: "prep-store",
        title: "短周期收纳比一次性整理更重要",
        paragraphs: [
          "厨房准备并不一定意味着一次大整理，更重要的是每次做饭后把下次还会继续用到的物品放回稳定位置。",
          "这类稳定位置和常用组合，也很适合在炊火记内容中心中逐步沉淀。"
        ]
      }
    ]
  },
  {
    slug: "cooking-skills",
    path: "/guides/cooking-skills",
    type: "article",
    title: "烹饪技巧",
    summary: "从火候、下锅顺序到常见失误控制，整理适合日常家常菜的实用技巧。",
    updatedAt: "2026-08-04",
    label: "厨房知识",
    sections: [
      {
        id: "heat",
        title: "先判断锅和火，不只看时间",
        paragraphs: [
          "火候不是固定分钟数，而是锅温、食材含水量和分量一起决定的结果。",
          "先观察锅面状态和食材反应，再决定是否继续加热或转小火。"
        ]
      },
      {
        id: "order",
        title: "下锅顺序影响成菜稳定性",
        bullets: [
          "先下需要更长时间成熟的主料",
          "容易出水的食材不要过早混入",
          "香料与调味料分清提香时机和收味时机"
        ]
      },
      {
        id: "mistakes",
        title: "减少失败的三个办法",
        bullets: [
          "不要一次同时学太多步骤",
          "记录自己真正成功过的做法",
          "同一道菜优先做小修正，而不是每次都换一版新配方"
        ]
      }
    ]
  },
  {
    slug: "recipe-skills",
    path: "/guides/recipe-skills",
    type: "article",
    title: "食谱技巧",
    summary: "帮助你理解配方、替换原料、处理份量与保存个人改法，而不是机械照抄。",
    updatedAt: "2026-08-04",
    label: "厨房知识",
    sections: [
      {
        id: "read",
        title: "先读懂配方意图",
        paragraphs: [
          "看食谱时，不要只看步骤，还要先理解这道菜的核心口味、主要口感和关键成型环节。",
          "这样在替换原料或调整份量时，才知道哪些能动，哪些最好不要动。"
        ]
      },
      {
        id: "replace",
        title: "替换原料时优先保持角色相近",
        bullets: [
          "主料替换优先看口感和含水量",
          "香料替换优先看香型而不是颜色",
          "调味料替换优先看咸度、甜度和酸度强弱"
        ]
      },
      {
        id: "version",
        title: "把自己的成功改法沉淀成稳定版本",
        paragraphs: [
          "真正有价值的不是看过多少菜谱，而是哪些做法你已经在自己家里稳定复现过。",
          "炊火记的内容与产品设计都更鼓励记录这种个人稳定版本。"
        ]
      }
    ]
  },
  {
    slug: "changelog",
    path: "/changelog",
    type: "changelog",
    title: "更新日志",
    summary: "记录官网、内容中心与小程序展示链路的当前进展，方便后续持续对照。",
    updatedAt: "2026-08-04",
    label: "更新",
    sections: [
      {
        id: "2026-08-04",
        title: "2026-08-04",
        bullets: [
          "确认官网定位为品牌与内容承接，不扩成 PC 业务端",
          "新增 `apps/site` 第一阶段工程壳",
          "小程序新增通用内容 `web-view` 承接页，开始打通同源内容展示链路"
        ]
      }
    ]
  }
];

export const docsByPath = new Map(siteDocs.map((doc) => [doc.path, doc]));
export const docsBySlug = new Map(siteDocs.map((doc) => [doc.slug, doc]));
