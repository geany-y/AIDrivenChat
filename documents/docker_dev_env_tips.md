# Docker開発環境構築TIPS: Next.js + Node.js + MongoDB

このドキュメントは、Next.js (App Router)、Node.js (Socket.io)、MongoDBをDocker Composeで開発環境として構築する過程で遭遇した問題とその解決策をまとめたものです。

## 1. `docker-compose.yml`の修正点

### 1.1. `healthcheck`の廃止と原因

*   **問題**: `mongodb`サービスおよび`backend`サービスで`healthcheck`がエラーとなり、コンテナが`healthy`とならず起動しない。
*   **原因1**: 各イメージのディストリビューションに存在しないコマンド（例: `mongo`シェル、`nc`）を`healthcheck`の`test`コマンドで用いていたため。`mongo:latest`イメージには`mongo`シェルがデフォルトで含まれていない場合がある。
*   **原因2**: Dockerで動作させる場合、ユーザーによってはコマンドへのパスはフルパスで記載しないと動作しない（例: `/usr/bin/npm`）。
*   **解決策**: `healthcheck`を一時的に廃止し、`depends_on`のみで起動順序を制御する。より堅牢なヘルスチェックを実装する場合は、コンテナイメージに依存コマンド（例: `curl`、`netcat`）を追加するか、より汎用的なTCP接続チェック（例: `exec 3<>/dev/tcp/localhost/27017 || exit 1`）を使用する必要がある。

## 2. `nextjs-chat-frontend/Dockerfile`の修正点

### 2.1. `root`ユーザーでの動作設定

*   **問題**: `frontend`コンテナで`npm run dev`する際に、`/app/.next`の権限がなくエラーとなる。
*   **解決策**: コンテナ内で`root`ユーザーで動作するように設定を変更する。
    *   `USER nextjs`の行を削除するか、`USER root`に変更する。

### 2.2. `.next`ディレクトリのクリーンアップ

*   **補足**: `.next`はビルドしたファイルやキャッシュを保存する一時ディレクトリであるため、コンテナ起動時に不要なファイルが残らないように削除を追加することが望ましい（バグ調査の際の原因の切り分けが行いやすいように常に古いファイルが残らない状態で実行したい）。
*   **解決策**: `Dockerfile`または`docker-compose.yml`の`command`で、開発サーバー起動前に`.next`ディレクトリを削除するコマンドを追加する。

### 2.3. `npm install`から`npm ci`への変更

*   **補足**: `npm install`を`npm ci`に変更し、`package-lock.json`に準じたもののみインストールするように変更（効率化のため）。
*   **解決策**: `Dockerfile`の`RUN npm install`を`RUN npm ci`に修正する。

### 2.4. `node_modules`のコピー

*   **問題**: `runner`ステージで`node_modules`ディレクトリ内が空となり`next`が動かない。
*   **解決策**: `builder`ステージで`npm install`を実行した後、`node_modules`ディレクトリを`runner`ステージにコピーする。
    *   `COPY --from=builder /app/node_modules ./node_modules`を追加する。

### 2.5. `CMD`の実行内容の変更

*   **問題**: Dockerでコマンドを実行する場合、実行ユーザーの権限や`PATH`が通っていない可能性から`next`コマンドを認識しない。
*   **解決策**: `CMD`の実行内容を、`next`コマンドをフルパスで呼び出すように変更する。
    *   例: `CMD ["node", "node_modules/next/dist/bin/next", "dev"]`

## 3. `nextjs-chat-frontend/package.json`の修正点

### 3.1. `scripts`に`cdev`を追加

*   **問題**: Dockerでコマンドを実行する場合、実行ユーザーの権限や`PATH`が通っていない可能性から`next`コマンドを認識しない。
*   **解決策**: `package.json`の`scripts`セクションに、`next`コマンドをフルパスで呼び出す`cdev`スクリプトを追加する。
    ```json
    "scripts": {
      "dev": "next dev --turbopack",
      "build": "next build",
      "start": "next start",
      "lint": "next lint",
      "cdev": "node node_modules/next/dist/bin/next dev"
    }
    ```
    そして、`Dockerfile`の`CMD`を`CMD ["npm", "run", "cdev"]`に変更する。

## 4. デバッグ方法

1.  `docker logs <container-name>`でログ内容を確認し、ステップバイステップで解決する。
2.  コンテナの動作を保持するための`CMD`を`tail -f /dev/null`など、必ず成功するコマンドに変更し、コンテナ内にアクセスして`Dockerfile`で行っていることを試し、エラーがないか確認し、ステップバイステップで解決する。
    *   コンテナにアクセス: `docker exec -it <container-name> bash`

---

**プロジェクト固有の考慮事項: WSL上のホストからのアクセス**

このプロジェクトでは、「WSL上のホストからアクセスする (frontendもbackendも)」という視点が常に重要となります。今後の考察や作業において、この点を最優先で考慮し、すべての設定やデプロイ戦略に反映させる必要があります。特に、ブラウザからアクセスするURLと、Kubernetesクラスタ内部でのサービス間通信のURLを明確に区別し、それぞれに適切な設定を行うことが肝要です。
