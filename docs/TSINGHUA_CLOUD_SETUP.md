# 清华云盘：获取 Token 与首次配置

技能安装后，还需 **Python 3.9+、资料库 Repo-Token 和同一资料库的 Repo ID**。本站不收集凭据，也不代为创建 Token。

## 1. 获取资料库 API Token

1. 登录 [清华云盘网页版](https://cloud.tsinghua.edu.cn/)，打开“我的资料库”。
2. 找到要授权的资料库，打开它的操作菜单，选择 **高级（Advanced）→ API Token**。
3. 填写应用名称，例如 `my-agent`，明确选择权限后提交：只查看或下载选**只读**，需要上传、写入或整理文件才选**读写**。不要直接沿用默认权限。
4. 将生成的 Token 保存到本机私密配置中。它只用于这个资料库，不是账户 Token，也不是学校统一身份认证密码。

以上菜单路径来自 Seafile 官方文档及 11.0 分支；清华定制界面尚未登录复核，菜单名称或位置可能不同。不要把个人中心里的任意 Token 当作本技能可用的 Repo-Token。没有入口时，联系资料库所有者或管理员确认权限。

管理弹窗可能直接显示已有 Token。不要分享完整弹窗截图；不再使用或意外泄露时，在该资料库的 Token 管理中删除对应 Token。

## 2. 获取同一资料库的 Repo ID

进入资料库，查看浏览器地址栏：

```text
https://cloud.tsinghua.edu.cn/library/<repo_id>/<资料库名>/
```

取 `/library/` 后的 ID 段，形如 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`。不要复制资料库名称、文件路径或分享链接中的短标识；Token 与 Repo ID 必须属于同一个资料库。

## 3. 配置凭据（二选一）

### 方式 A：包外私密 JSON

用本机编辑器保存下面的模板，替换占位值，不要提交到 Git、放入技能目录或云同步目录。

默认路径：`~/.config/tsinghua-cloud-drive/credentials.json`。Windows 的 `~` 指当前用户主目录。

```json
{
  "base_url": "https://cloud.tsinghua.edu.cn",
  "repo_id": "替换为资料库 ID",
  "api_token": "替换为该资料库的 API Token"
}
```

macOS / Linux：先创建权限受限的目录和空文件，再用编辑器填写，避免秘密曾以宽松权限落盘：

```sh
mkdir -p "$HOME/.config/tsinghua-cloud-drive"
chmod 700 "$HOME/.config/tsinghua-cloud-drive"
(umask 077; touch "$HOME/.config/tsinghua-cloud-drive/credentials.json")
chmod 600 "$HOME/.config/tsinghua-cloud-drive/credentials.json"
```

已有文件时保留内容，不要覆盖。Windows 请使用仅当前用户可读的私密目录；0600 是 POSIX 权限要求，不是加密。

### 方式 B：Agent 运行环境

在启动 Agent 的环境或其私密环境变量配置中同时设置：

| 变量 | 内容 |
| --- | --- |
| `TSINGHUA_CLOUD_TOKEN` | 该资料库的 API Token |
| `TSINGHUA_CLOUD_REPO_ID` | 同一资料库的 ID |

不要把真实 Token 写进公开命令、终端历史或对话；不需要把 Token 传给 npx 安装器。环境变量只在另一个终端里设置时，已运行的 Agent 不会自动继承，需要从已配置的环境重新启动。

优先级：显式 `--config` → 上述两个环境变量 → `TSINGHUA_CLOUD_CONFIG` 指定文件 → 默认私密文件。两个凭据环境变量必须同时有效；只设置一个会报错，不会悄悄回退。

## 4. 安装依赖与只读验证

将 `<技能目录>` 替换为安装器实际输出的目标目录，不要原样复制占位符。建议在 Python 虚拟环境中执行：

```sh
python3 -m pip install -r "<技能目录>/requirements.txt"
python3 "<技能目录>/scripts/drive.py" --help
python3 "<技能目录>/scripts/drive.py" list /
```

Windows 将 `python3` 换成 `py -3`。`--help` 只验证程序入口；`list /` 返回目录 JSON（空资料库可为 `[]`），才说明当前凭据的只读访问可用，不代表写权限已验证。

使用非默认配置路径时，`--config` 必须放在子命令前：

```sh
python3 "<技能目录>/scripts/drive.py" --config "<私密配置路径>/credentials.json" list /
```

后续可让 Agent：“列出已授权资料库根目录，不修改任何文件。”删除、覆盖和移动前仍须明确授权。

## 常见问题

- **Set both … correctly / Invalid credential schema**：检查两个值是否都已配置。Token 应为 40 位十六进制字符，Repo ID 为 UUID；格式正确不等于凭据有效，不要自己补齐或修改值。
- **Credential file must be … mode 0600**：macOS / Linux 将私密文件权限设为 `600`。
- **Cannot load private credential configuration**：检查文件路径、JSON 格式及 Agent 运行用户；不要粘贴完整配置求助。
- **Repository scope mismatch**：Token 和 Repo ID 不属于同一个资料库。
- **HTTP read failed**：检查 Token 是否有效、是否为 Repo-Token、是否有读取权限；也可能是服务或网络问题。
- **只读成功、上传失败**：确认确实需要写操作后，再检查是否创建了读写 Token；网络超时先查看远端状态，不盲目重发写入。

## 参考

- [清华云盘公开帮助](https://cloud.tsinghua.edu.cn/help/)
- [Seafile 官方 Token 说明](https://seafile-api.readme.io/reference/authentication)
- [Seahub 11.0 资料库菜单](https://github.com/haiwen/seahub/blob/3ddb293f22f9a4dc0793342305e6875817a4b984/frontend/src/pages/my-libs/mylib-repo-menu.js#L106-L119)
- [完整技能命令与安全规则](../examples/tsinghua-cloud-drive/SKILL.md)
