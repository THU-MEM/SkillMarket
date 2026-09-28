---
name: tsinghua-cloud-drive
description: Use when managing files on Tsinghua cloud drive.
version: 2.0.0
---

# 清华云盘

通过资料库 Repo-Token 实现文件和文件夹增删改查、上传下载、文本读写。Python 3.9+。

## 安装与凭据

将本文件夹放入 Agent 的 skills 目录，用 `terminal` 执行 `python3 -m pip install -r <skill目录>/requirements.txt`。

**先取得资料库凭据**：登录清华云盘，在“我的资料库”中打开目标资料库的操作菜单，寻找“高级 → API Token”，创建专用于该资料库的 Repo-Token；仅查询/下载选只读，需要上传/修改才选读写。此路径依据 Seafile 官方文档，清华定制界面未登录复核。不要用账户 Token 或统一身份认证密码。Repo ID 取同一资料库地址 `/library/<repo_id>/…` 中的 ID，不是分享链接标识。没有入口时联系资料库所有者或管理员。

[完整配置与排错指南](https://github.com/THU-MEM/SkillMarket/blob/main/docs/TSINGHUA_CLOUD_SETUP.md) · [Token 官方说明](https://seafile-api.readme.io/reference/authentication)

凭据只从运行环境或包外配置获取，不写入技能、脚本或日志：
- 环境变量：`TSINGHUA_CLOUD_TOKEN` 和 `TSINGHUA_CLOUD_REPO_ID`，两者必须同时设置。
- 或全局 `--config /私密路径/credentials.json`；JSON字段为 `base_url`、`repo_id`、`api_token`。
- 或 `TSINGHUA_CLOUD_CONFIG` 指定配置路径；默认 `~/.config/tsinghua-cloud-drive/credentials.json`。
- 优先级：显式 `--config` → Token/Repo环境变量 → 配置路径环境变量 → 默认配置。POSIX配置文件权限须0600。
- 固定服务 `https://cloud.tsinghua.edu.cn`，不跟随重定向、不关闭TLS校验，不打印Token或临时下载/上传链接。

## 命令

以下交给 `terminal` 执行。`D`代表 `python3 <skill目录>/scripts/drive.py`，不是额外程序；Windows使用 `py -3`。

```text
D list /
D stat /项目/说明.txt
D search --path /项目 --name 说明 --recursive
D mkdir /项目/视频 --parents
D upload ./视频.mp4 --path /项目/视频/视频.mp4
D download /项目/视频/视频.mp4 --output ./下载.mp4
D read /项目/说明.txt
D write /项目/说明.txt --text '正文'
D write /项目/说明.txt --file ./新版.txt --overwrite
D rename /项目/说明.txt --name 新名字.txt
D move /项目/新名字.txt --to-dir /归档
D delete /项目/文件.txt --yes
D delete /项目/目录 --yes --recursive
```

重命名、移动和删除支持文件/文件夹。输出为JSON；完整参数见 `--help`。

## 必要规则

只操作用户授权的资料库和路径。删除、覆盖须明确授权；程序参数不代替授权。默认不覆盖同名文件，根目录禁止删除，非空目录须 `--recursive`，移动不合并同名目录。

上传/下载默认校验大小，不做哈希；小文本写入读回核对正文。用户需要时上传/写入可加 `--verify sha256`。变更后读回真实状态；超时先对账，不自动重发。

路径拒绝 `..` 等歧义；搜索超过上限会返回 `truncated`。单文件10GB及以上暂不支持，无分片/断点续传。不得将真实凭据放进交付ZIP。
