# Glosc CLI

### 使用方法

```sh
npm create glosc@latest
```

也支持直接传入项目名：

```sh
npm create glosc@latest <your-project-name>
```

```sh
Project name: <your-project-name>
Description: A brief description of your project
Author: <system-username>
Use Language: Python / TypeScript
Main File Name: main.py / index.ts
Readme: Y / N
License: MIT
```
生成的项目模板现在默认是 **MCP (Model Context Protocol) stdio server**，并内置一个最基础的工具：

- `get_current_time`：返回当前 UTC 时间（ISO 8601 字符串）


### Python结构

```sh

<your-project-name>/
├── main.py             # MCP Server 入口 (Python, stdio)
├── pyproject.toml      # 项目配置
├── requirements.txt    # 依赖文件
├── config.yml          # 配置文件
├── README.md           # 项目说明文件
└── LICENSE             # 许可证文件
```


### TypeScript结构

```sh
<your-project-name>/
├── src/                # 源代码目录
│   ├── index.ts        # MCP Server 入口 (TypeScript, stdio)
├── package.json        # 依赖文件（含 @modelcontextprotocol/sdk）
├── config.yml          # 配置文件
├── README.md           # 项目说明文件
└── LICENSE             # 许可证文件
```

### 运行生成的 MCP Server

Python：

```sh
python -m pip install -r requirements.txt
python main.py
```

TypeScript：

```sh
npm install
npm run build
npm start
```

### 本地开发（维护此 CLI）

```sh
npm install
npm run build
node bin/index.js
```

非交互模式（方便 CI/自测，不会卡在交互输入）：

```sh
node bin/index.js my-app --defaults --language python
node bin/index.js my-app --defaults --language typescript
```