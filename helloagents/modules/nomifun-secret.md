# nomifun-secret

> 路径: `crates/backend/nomifun-secret/`

## 功能

**浏览器凭据保险库（credential vault）**，为 browser-use 引擎提供加密存储 + 域名绑定 + fail-closed 解密。

- AES-256-GCM 加密每个凭据值（复用 nomifun-common 加密栈）
- 每个凭据绑定 allowed_origins，按 eTLD+1 归一化（编译期嵌入 Mozilla PSL）
- resolve 严格 fail-closed：origin 不匹配/名称未知/解密失败一律返回 None
- 落盘持久化（X2 vault）：JSON 文件 value 全是密文
- 浏览器身份全局共享

## 核心类型

| 类型 | 说明 |
|------|------|
| `SecretStore` | 核心内存存储: HashMap<String, SecretRecord> + AES key |
| `SecretRecord` | 加密记录: ciphertext + allowed_etld1 |
| `SecretValue` | 解密后值包装（Debug/Display 均输出 \<redacted\>） |
| `SecretListing` | 列表元数据（绝不携带 value） |

## 路由

（web feature 下）GET/POST/DELETE `/api/browser-secrets/{pet_id}`（list/register/remove）

## 依赖

**Workspace 内**: nomifun-common（加密栈）, nomifun-api-types(可选web), nomifun-auth(可选web)

## 被依赖

被 5 个 crate 依赖: nomifun-app(web), nomifun-ai-agent(默认纯逻辑), nomi-browser(默认), nomi-browser-engine(默认etld), nomifun-gateway(可选browser-use)
