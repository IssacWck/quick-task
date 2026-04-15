# 快记 CHANGELOG

所有重要的变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [2.0.0] - 2026-04-15

### ✨ 新功能

#### 智能停顿检测保存

- **问题**: 原有固定 2 秒延迟过长，用户体验不够即时
- **方案**: 实现智能停顿检测机制
  - 用户停止输入 500ms 后立即保存（停顿阈值）
  - 持续输入时最长等待 1 秒强制保存（最大间隔）
  - 双保险机制，兼顾即时性和数据安全
- **验证**: 代码审查通过，定时器管理正确，无内存泄漏风险

#### 保存状态视觉指示器

- **问题**: 用户不知道当前是在等待还是已经保存
- **方案**: 新增三状态指示器
  - `detecting`: 「◐ 检测中...」（橙色旋转图标）
  - `saved`: 「✓ 已保存」（绿色图标）
  - `cleared`: 「输入即保存」（灰色，默认状态）
- **验证**: DOM 元素正确，CSS 动画已定义，状态切换逻辑完整

#### 数据统计模块

- **问题**: 缺少用户体验指标收集，无法验证「3 秒记录」假设
- **方案**: 新增完整统计系统
  - 首次输入延迟（`firstInputDelay`）：页面加载 → 首次按键
  - 记录时长（`recordDuration`）：开始输入 → 保存完成
  - 停顿次数（`pauseCount`）：输入中断超过 300ms 的次数
  - 字符数（`charCount`）：单次记录的字符数
  - 保存类型（`saveType`）：pause / max_interval / visibility / manual
  - 右侧滑出式统计面板，实时展示聚合数据
  - CSV / JSON 双格式导出，与测试框架模板字段匹配
- **验证**: API 完整暴露，集成点正确，导出功能可调用

### 🔧 优化

#### iOS Safari 键盘触发

- **问题**: iOS 拒绝在 `setTimeout` 延迟后弹出键盘
- **原因**: WebKit 安全策略要求键盘弹出必须在用户手势的同步上下文中
- **方案**: 将 `setTimeout(() => input.focus(), 300)` 改为同步调用 `input.focus()`
- **技术细节**:
  - 移除所有异步延迟（setTimeout、Promise.then、requestAnimationFrame）
  - 在 click handler 中同步调用 focus()
  - 同时绑定 `click` 和 `touchend` 事件确保移动端响应更快
- **验证**: 代码逻辑正确，符合 iOS Safari 的同步上下文要求

#### 引导层视觉优化

- **问题**: 用户不理解为什么点击后还需要再点击输入框
- **方案**: 优化引导层设计
  - 按钮改为渐变样式（`linear-gradient(135deg, #4A90D9, #357ABD)`）
  - 添加阴影和微动画（hover 光泽、按压缩放）
  - 图标添加弹跳动画
  - 过渡时间从 0.3s 缩短到 0.25s
  - 添加提示文案「点击按钮即可开始记录，键盘会自动弹出」
- **验证**: CSS 样式正确，动画流畅，提示文案清晰

### 🔌 新增 API

#### QuickTaskConfig（自动保存配置）

```javascript
// 查看当前配置
QuickTaskConfig.get()
// { pauseThreshold: 500, maxInterval: 1000, statusDuration: 1500 }

// 调整停顿阈值为 800ms
QuickTaskConfig.set('pauseThreshold', 800)

// 调整最大间隔为 2s
QuickTaskConfig.set('maxInterval', 2000)

// 显示帮助
QuickTaskConfig.help()

// 重置为默认配置
QuickTaskConfig.reset()
```

**配置范围**:
- `pauseThreshold`: 100-5000ms（停顿检测阈值）
- `maxInterval`: 500-10000ms（最大保存间隔）
- `statusDuration`: 500-5000ms（状态提示显示时长）

**配置方式**:
1. 浏览器控制台：`QuickTaskConfig.set('key', value)`
2. URL 参数：`?pause=800&max=2000`
3. localStorage：自动持久化

#### QuickTaskStats（数据统计）

```javascript
// 手动控制统计流程
QuickTaskStats.startRecord()           // 开始一次新记录
QuickTaskStats.recordInput(charCount)  // 记录输入事件
QuickTaskStats.finishRecord(type)      // 完成记录
QuickTaskStats.cancelRecord()          // 取消当前记录

// 获取数据
QuickTaskStats.getStats()              // 获取聚合统计数据

// 导出数据
QuickTaskStats.exportCSV()             // 导出并下载 CSV 文件
QuickTaskStats.exportJSON()            // 导出并下载 JSON 文件

// 清除数据
QuickTaskStats.clear()                 // 清除所有统计数据

// 帮助
QuickTaskStats.help()                  // 显示 API 文档
```

**导出格式（JSON）**:
```json
{
  "exportTime": "2026-04-15T07:00:00.000Z",
  "avgFirstInputDelay": 1250,
  "totalRecords": 10,
  "avgRecordDuration": 3200,
  "avgCharCount": 45.2,
  "avgPauseCount": 1.8,
  "saveTypeDistribution": { "pause": 7, "max_interval": 2, "visibility": 1 },
  "recentRecords": [...],
  "rawData": [...]
}
```

### 📁 文件变更

| 文件 | 变更 | 说明 |
|------|------|------|
| `index.html` | 大幅修改 | 核心交互优化、统计模块集成、UI 增强 |
| `stats.js` | 新增 | 数据统计模块（16KB） |

### 📦 技术栈

- 纯原生 JavaScript（无框架依赖）
- CSS3 动画与过渡
- localStorage 数据持久化
- Service Worker（PWA 支持）

### 🔗 相关微任务

- [micro-task-b27194e2](../micro-task-b27194e2/) - iOS 键盘触发优化与引导层重构
- [micro-task-8f25e1bf](../micro-task-8f25e1bf/) - 自动保存时机优化与可配置化
- [micro-task-50dd2a6c](../micro-task-50dd2a6c/) - 数据统计模块增强与验证

---

## [1.0.0] - 2026-04-14

### ✨ 初始版本

- 基础记录功能：输入 → 保存 → 清空循环
- 历史记录列表展示
- localStorage 数据持久化
- 固定 2 秒延迟自动保存
- 引导层首次使用提示
- PWA 支持（manifest.json、sw.js）

---

## 版本规划

### [2.1.0] - 计划中

- [ ] 自适应停顿阈值（根据用户历史输入速度调整）
- [ ] 保存动画优化（添加「滑入」效果）
- [ ] 离线保存提示
- [ ] 数据可视化图表

### [3.0.0] - 远期规划

- [ ] 多设备同步
- [ ] 标签分类
- [ ] 搜索功能
- [ ] 导出至其他应用
