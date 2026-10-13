# OnlyPhoto 名称迁移（2026-10-13）

正式产品名为 **OnlyPhoto**，工程包名、日志前缀、导出文件前缀和新数据库默认文件名使用 `onlyphoto`。

## 已有部署

- 保留现有 `.env.local`、数据库和上传目录。仅将 `APP_NAME` 更新为 `OnlyPhoto`；已有 `DATABASE_URL` 继续指向原数据库，不能直接套用新的默认路径，否则会打开一个空数据库。
- 新安装默认使用 `file:./data/onlyphoto.db`。若要给已有数据库文件改名，先停止所有服务、备份数据库及 WAL/SHM 文件，完成 SQLite checkpoint 后再改名，并同步修改 `DATABASE_URL`。
- 启动前执行 `pnpm db:migrate`。迁移 `0001_onlyphoto_budget` 将旧预算账本转入新标识，保留已用次数与额度；若新旧账本同时存在，累计次数并采用较低额度，不因改名增加可用预算。
- 新建演示账号使用 `demo.a@onlyphoto.local` 和 `demo.b@onlyphoto.local`。已有账号的邮箱与登录凭据保持原样，不批量改写用户数据。
- 重新构建并重启应用；已安装的 PWA 可能需要重新安装才能刷新系统缓存中的显示名称。

## 历史记录与远端

- `artifacts/environment.json`、`docs/DEVELOPMENT_EVIDENCE.md` 和既有截图是 2026-10-11 的历史证据，保留当时的路径与图像，不冒充本次重新运行的结果。当前文档中的旧验证结果也不是本次改名的验证结果。
- `docs/ASSET_SOURCES.md` 与 `scripts/fetch-assets.mjs` 中的旧图片 seed 是第三方素材标识，保留以维持来源可追溯性及下载结果的一致性。
- 数据迁移中的旧账本标识用于识别历史数据，不能替换。
- GitHub 仓库 URL 暂保留原地址；当前连接具备代码推送权限，但没有仓库管理权限。仓库所有者可在 Settings → General 将仓库名称改为 `OnlyPhoto`，随后更新 README 仓库链接及本地 origin。

## 本次验证

- 全仓文本审查：当前产品与工程命名均已更新，旧名称仅保留于上述兼容、素材、历史与有效远端地址中。
- SQLite 内存数据库验证：空库、旧账本、新旧账本并存及重复执行迁移，确认用量不丢失、额度不增加。
- 当前环境未安装项目依赖，安装请求受网络权限限制；本次未完成 lint、类型检查、应用测试、构建及截图重录，不能沿用旧报告宣称通过。
