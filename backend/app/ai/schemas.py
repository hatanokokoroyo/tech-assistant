"""Function Calling schemas for DeepSeek Tool Calls API."""

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "在沙箱目录下执行 shell 命令。禁止 rm -rf /、sudo 等越权操作。",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "要执行的命令"},
                    "work_dir": {"type": "string", "description": "工作目录（相对路径，可选）"},
                    "timeout_seconds": {"type": "integer", "description": "超时秒数，默认 30，最大 120"},
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "读取沙箱内指定路径的文件内容。",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "文件路径（绝对路径或相对于用户工作区）"},
                    "head": {"type": "integer", "description": "仅返回前 N 行"},
                    "tail": {"type": "integer", "description": "仅返回后 N 行"},
                },
                "required": ["file_path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "在 doc/ 目录或 instructions.md 中创建或覆盖文件。仅允许操作 doc/ 和 instructions.md，其他位置会被拒绝。父目录不存在时自动创建。",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "文件路径"},
                    "content": {"type": "string", "description": "文件内容"},
                },
                "required": ["file_path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_content",
            "description": "在代码项目或文档目录中递归搜索文件内容（类似 grep）。",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "搜索模式（字符串或正则）"},
                    "path": {"type": "string", "description": "搜索起点路径（相对路径，可选）"},
                    "glob": {"type": "string", "description": "文件名过滤，如 '*.py'"},
                    "case_sensitive": {"type": "boolean", "description": "区分大小写，默认 false"},
                    "context": {"type": "integer", "description": "上下文行数，默认 2"},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_directory",
            "description": "列出指定目录下的文件和子目录。",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "目录路径"},
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_file",
            "description": "删除 doc/ 或 instructions.md 中的指定文件。仅允许操作 doc/ 和 instructions.md。",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "要删除的文件路径"},
                },
                "required": ["file_path"],
            },
        },
    },
]

# MCP 数据库查询工具名称集合（用于判断工具是否为 MCP 工具）
MCP_TOOL_NAMES = {
    "list_datasources",
    "query_mysql",
    "query_redis",
    "query_tdengine",
}
