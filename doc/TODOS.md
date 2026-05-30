# TODOS

## 下一步工作清单

- [x] **技术方案设计文档**
  - [x] 数据库 ER 图 + 建表 DDL
  - [x] 完整 API 接口定义
  - [x] 前端 Vue 项目目录结构设计
  - [x] 后端 FastAPI 项目目录结构设计
  - [x] AI Tool Calls 的 function calling schema 定义
  - [x] Dockerfile + docker-compose.yml 设计
- [x] **项目初始化**
  - [x] 初始化前端（Vue 3 + Element Plus）项目
  - [x] 初始化后端（FastAPI + SQLAlchemy）项目
  - [x] 配置 Docker Compose 开发环境
- [ ] **迭代开发（建议顺序，可调整）**

  **Phase 1：登录模块** ✅
  - [x] 后端：注册/登录 API、JWT 签发与验证、bcrypt 密码加密
  - [x] 前端：登录/注册页面、路由守卫、Token 持久化存储
  - [x] 验证：前端 TypeScript 编译通过，后端语法检查通过（Docker Desktop 暂不可用，运行时验证需手动执行 `docker compose up -d --build`）

  **Phase 2：项目与文件管理** ✅
  - [x] 后端：定制项目 CRUD、代码仓库添加/删除、分支查询/切换、SSH Key 上传/删除、文档文件读写
  - [x] 前端：三栏布局（项目列表 → 文件/对话选择 → 内容区）、项目列表页、项目详情页、Markdown 编辑器
  - [x] 验证：前端 TypeScript 编译通过（需 Docker Desktop 运行时验证）

  **Phase 3：AI 交互模块 + 事件日志** ✅
  - [x] 后端：DeepSeek API 集成、SSE 流式输出、Tool Calls 执行（run_command/文件操作/搜索）、事件完成+log 生成
  - [x] 前端：对话界面（消息列表/输入框/SSE 流式渲染）、思维链折叠、工具调用状态展示
  - [x] 验证：前端 TypeScript 编译通过（需 Docker Desktop + DeepSeek API Key 进行运行时验证）
