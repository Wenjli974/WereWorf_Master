# 狼人杀游戏

这是一个基于 React 开发的狼人杀游戏 Web 应用。

## 功能特点

- 支持 6-12 人游戏
- 角色包括：狼人、平民、女巫、预言家
- 完整的昼夜交替机制
- 语音播报功能
- 实时游戏状态显示
- 投票系统
- 游戏历史记录

## 技术栈

- React
- TypeScript
- Tailwind CSS
- Web Speech API

## 安装和运行

1. 克隆仓库：
```bash
git clone [仓库地址]
```

2. 安装依赖：
```bash
npm install
```

3. 运行开发服务器：
```bash
npm start
```

4. 在浏览器中访问：
```
http://localhost:3000
```

## 游戏规则

1. 游戏支持 6-12 名玩家
2. 每个玩家被分配一个角色：狼人、平民、女巫或预言家
3. 游戏分为夜晚和白天两个阶段
4. 夜晚阶段：
   - 狼人选择击杀目标
   - 女巫可以使用解药或毒药
   - 预言家可以查验一名玩家的身份
5. 白天阶段：
   - 玩家讨论并投票
   - 得票最多的玩家被淘汰
6. 直到一方胜利为止

## 贡献

欢迎提交 Issue 和 Pull Request。

## 许可证

MIT License 