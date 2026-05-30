# AI Tool Calls — Function Calling Schema

AI 模块通过 OpenAI SDK 向 DeepSeek API 提交工具定义，DeepSeek 根据用户意图选择调用。以下为所有工具的 JSON Schema 定义。

---

## 1. run_command

在沙箱 `/data/tech-assistant` 路径下执行 shell 命令。

```json
{
    "type": "function",
    "function": {
        "name": "run_command",
        "description": "在沙箱目录 /data/tech-assistant 下执行 shell 命令。禁止执行 rm -rf /、sudo 等越权操作。",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "要执行的命令。仅接受白名单内的安全命令。"
                },
                "work_dir": {
                    "type": "string",
                    "description": "工作目录（相对于当前用户工作区的路径），不传则默认为用户工作区根目录"
                },
                "timeout_seconds": {
                    "type": "integer",
                    "description": "命令超时秒数，默认 30，最大 120"
                }
            },
            "required": ["command"]
        }
    }
}
```

**后端安全措施：**
- 命令执行前校验 `work_dir` 是否在 `/data/tech-assistant/<user_id>/` 沙箱内
- 禁止命令列表：`rm -rf /`、`sudo`、`su`、`chmod 777`、`mkfs`、`dd` 等
- 设置最大超时，防止 AI 挂起

---

## 2. read_file

读取沙箱内的文件内容。

```json
{
    "type": "function",
    "function": {
        "name": "read_file",
        "description": "读取指定路径的文件内容。路径必须位于 /data/tech-assistant 沙箱内。",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "相对于当前用户工作区或绝对路径（自动校验沙箱边界）"
                },
                "head": {
                    "type": "integer",
                    "description": "仅返回文件前 N 行（可选）"
                },
                "tail": {
                    "type": "integer",
                    "description": "仅返回文件后 N 行（可选）"
                }
            },
            "required": ["file_path"]
        }
    }
}
```

---

## 3. write_file

创建或覆盖沙箱内的文件。

```json
{
    "type": "function",
    "function": {
        "name": "write_file",
        "description": "创建新文件或覆盖已有文件的内容。路径必须位于 /data/tech-assistant 沙箱内。父目录不存在时自动创建。",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "文件路径（相对于当前用户工作区或绝对路径）"
                },
                "content": {
                    "type": "string",
                    "description": "文件内容"
                }
            },
            "required": ["file_path", "content"]
        }
    }
}
```

---

## 4. edit_file

对沙箱内的文件进行精确搜索替换编辑。

```json
{
    "type": "function",
    "function": {
        "name": "edit_file",
        "description": "对已有文件执行搜索替换编辑。search 文本必须在目标文件中唯一存在。先读取文件确认内容后再编辑。",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "文件路径"
                },
                "search": {
                    "type": "string",
                    "description": "要查找的精确文本（区分大小写、空白敏感）"
                },
                "replace": {
                    "type": "string",
                    "description": "替换后的文本"
                }
            },
            "required": ["file_path", "search", "replace"]
        }
    }
}
```

---

## 5. search_content

在代码项目目录中搜索文件内容。

```json
{
    "type": "function",
    "function": {
        "name": "search_content",
        "description": "在代码项目或文档目录中递归搜索文件内容（类似 grep）。支持正则和上下文行。",
        "parameters": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "搜索模式（字符串或正则表达式）"
                },
                "path": {
                    "type": "string",
                    "description": "搜索起点路径（相对于当前用户工作区），不传则搜索整个用户工作区"
                },
                "glob": {
                    "type": "string",
                    "description": "文件名过滤模式，如 '*.py'、'*.ts'"
                },
                "case_sensitive": {
                    "type": "boolean",
                    "description": "是否区分大小写，默认 false"
                },
                "context": {
                    "type": "integer",
                    "description": "匹配行上下文的行数，默认 2"
                }
            },
            "required": ["pattern"]
        }
    }
}
```

---

## 6. list_directory

列出沙箱内目录的内容。

```json
{
    "type": "function",
    "function": {
        "name": "list_directory",
        "description": "列出指定目录下的文件和子目录。路径必须位于沙箱内。",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "目录路径（相对于当前用户工作区或绝对路径）"
                }
            },
            "required": ["path"]
        }
    }
}
```

---

## 7. git_clone

将远程 Git 仓库克隆到当前用户工作区中。

```json
{
    "type": "function",
    "function": {
        "name": "git_clone",
        "description": "克隆远程 Git 仓库到用户工作区。自动使用用户已配置的 SSH Key。",
        "parameters": {
            "type": "object",
            "properties": {
                "repo_url": {
                    "type": "string",
                    "description": "Git 仓库 URL（https 或 git@ssh 格式）"
                },
                "target_dir": {
                    "type": "string",
                    "description": "目标目录名（相对于当前用户工作区），不传则从 URL 推断"
                }
            },
            "required": ["repo_url"]
        }
    }
}
```

**说明：** `git_clone` 不在 DeepSeek tool calls 中定义，而是作为一个**服务端自动操作**——当用户在 UI 上添加代码仓库时触发。AI 在对话中可建议用户添加仓库，但 clone 操作由后端直接执行，不通过 Tool Calls 下发。

如需让 AI 在对话中自主 clone，可取消注释上文；否则此工具仅作为内部服务使用。

---

## 8. delete_file

删除沙箱内的文件。

```json
{
    "type": "function",
    "function": {
        "name": "delete_file",
        "description": "删除沙箱内的指定文件。路径必须位于 /data/tech-assistant 沙箱内。不可删除目录。",
        "parameters": {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "要删除的文件路径"
                }
            },
            "required": ["file_path"]
        }
    }
}
```

---

## 工具总览

| # | 工具名 | 用途 | 安全级别 |
|---|---|---|---|
| 1 | `run_command` | 执行 shell 命令 | 🔴 命令白名单 + 超时控制 |
| 2 | `read_file` | 读取文件 | 🟢 只读 |
| 3 | `write_file` | 创建/覆盖文件 | 🟡 写沙箱内文件 |
| 4 | `edit_file` | 搜索替换编辑 | 🟡 写沙箱内文件 |
| 5 | `search_content` | 全文搜索 | 🟢 只读 |
| 6 | `list_directory` | 列出目录 | 🟢 只读 |
| 7 | `delete_file` | 删除文件 | 🟡 写操作 |
| — | `git_clone` | 克隆仓库 | 后端直接执行，非 Tool Calls |

## 安全边界

所有工具在执行前必须校验路径是否在 `/data/tech-assistant/<user_id>/` 范围内，防止路径穿越。

```python
# path_utils.py 核心逻辑（示意）
def safe_resolve(user_id: int, relative_path: str) -> Path:
    sandbox = Path(f"/data/tech-assistant/{user_id}")
    target = (sandbox / relative_path).resolve()
    if not str(target).startswith(str(sandbox.resolve())):
        raise PermissionError("路径越界")
    return target
```
