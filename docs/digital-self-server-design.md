# Digital Self Server 技术设计与选型

# 项目核心：
- 有一个统一的 Persona Core
- 所有入口通过 API 与其交互
- 回答基于：
  - 人格定义
  - 可检索资料
  - 历史回答
- 能明确区分：
  - 已知 / 未知
  - 事实 / 观点
支持未来加入：
- Agent
- 新入口（微信）

## 技术选型结论

第一版推荐组合：

```text
Frontend:  Next.js + tailwind
Backend Language: Python 3.12+
Server: FastAPI
Realtime: FastAPI WebSocket, SSE optional
Database: containerized Postgres + pgvector
LLM: Provider adapter, OpenAI/DeepSeek first
RAG: custom lightweight Python pipeline
Queue: Celery + Redis (later)
Deploy: Docker Compose 

```

# 推荐目录
下面给你的是**“可以直接建仓库”的项目结构树**，不是示意图。这个结构同时满足：

* 有真实可用的 **Web 对话页面**
* 有 **RAG + Agent + Memory** 的完整后端
* 允许你未来演进为多 Agent / 多 Persona
* 不会被早期 demo 决策拖死

我会先给**总览结构树**，再解释每一层“为什么这样分”。

---

#### 一、仓库总览（Monorepo，强烈推荐）

```text
hjhpersona/
├── frontend/                 # Web 对话界面
├── backend/                  # Persona Core Brain
├── infra/                    # 基础设施 & 部署
├── docs/                     # 设计文档 / 思考记录
├── scripts/                  # 运维 / 初始化脚本
├── .env.example
├── docker-compose.yml
├── README.md
```

---

#### 二、frontend/（用户交流页面）

```text
frontend/
├── app/                      # Next.js App Router
│   ├── page.tsx              # 首页（Chat）
│   ├── layout.tsx
│   └── api/                  # 可选：BFF
├── components/
│   ├── Chat/
│   │   ├── MessageList.tsx
│   │   ├── MessageItem.tsx
│   │   └── ChatInput.tsx
│   ├── Persona/
│   │   └── PersonaBadge.tsx
│   └── ui/                   # Button / Modal 等
├── hooks/
│   └── useChatStream.ts      # SSE / streaming
├── lib/
│   └── api.ts                # 后端 API 封装
├── styles/
├── public/
└── package.json
```

---

#### 三、backend/（整个系统的大脑）

```text
backend/
├── main.py                   # FastAPI 启动入口
├── api/                      # HTTP 层
│   ├── chat.py               # 对话入口
│   ├── session.py            # 会话管理
│   └── admin.py              # 可选管理接口
│
├── session/                  # Persona 会话态
│   ├── models.py
│   ├── manager.py
│   └── context_builder.py
│
├── agent/                    # Agent 系统
│   ├── orchestrator.py       # 核心调度器
│   ├── planner.py            # Thought / Plan
│   ├── executor.py           # Tool 执行
│   └── tools/
│       ├── search_memory.py
│       ├── write_memory.py
│       └── reflect.py
│
├── rag/                      # RAG 系统
│   ├── retriever.py
│   ├── ranker.py
│   ├── embedder.py
│   └── prompts.py
│
├── memory/                   # 长期记忆
│   ├── schemas.py            # Memory 数据模型
│   ├── store.py              # 向量 / DB 统一接口
│   └── summarizer.py
│
├── llm/                      # 模型抽象层
│   ├── base.py
│   ├── openai.py
│   └── local.py
│
├── infra/                    # 外部依赖
│   ├── redis.py
│   ├── db.py
│   └── vector.py
│
├── config/
│   └── settings.py
└── requirements.txt
```

---

#### 四、infra/（部署与运行）

```text
infra/
├── nginx/
│   └── hjhpersona.beer.conf
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── qdrant.Dockerfile
└── scripts/
    ├── init_db.sh
    └── init_qdrant.sh
```

---

#### 五、docs/

```text
docs/
├── architecture.md           # 总体架构
├── persona_definition.md     # 你是谁
├── memory_design.md          # 记忆系统设计
├── agent_loop.md             # Agent 推理循环
└── roadmap.md
```


