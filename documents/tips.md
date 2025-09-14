# 開発TIPS: Next.js + Node.js + MongoDB on Minikube

このドキュメントは、Next.js (App Router)、Node.js (Socket.io)、MongoDBをminikube環境にデプロイする過程で遭遇した問題とその解決策をまとめたものです。

## 1. コマンド実行環境の選択と`&&`演算子の問題

*   **問題**: Windows環境のVS Codeターミナルで`&&`演算子を使ったコマンドチェーンが正しく解釈されない場合がある。特にPowerShellでは`&&`が有効なステートメント区切りではないとエラーになる。
*   **解決策**:
    *   WSL (Windows Subsystem for Linux) ターミナルを使用する。
    *   WSLターミナルがデフォルトシェルでない場合、`wsl bash -c "..."`のように明示的にWSLのbashでコマンドを実行する。

## 2. `npx create-next-app`の対話モードと`--src-dir`オプションの挙動

*   **問題**: `npx create-next-app`コマンドは対話形式で実行されるため、自動化されたスクリプトでは入力待ちで停止する。また、`--src-dir`オプションを指定しても、`src/app`ではなくルート直下に`app`ディレクトリが作成される場合がある。
*   **解決策**:
    *   対話形式の質問には、`--ts --eslint --tailwind --src-dir --app --import-alias "@/*"`のようにオプションを明示的に指定して非対話モードで実行する。
    *   `app/`ディレクトリのパスは、実際に作成されたディレクトリ構造に合わせて調整する。

## 3. Dockerグループへのユーザー追加後の反映

*   **問題**: `sudo usermod -aG docker $USER`を実行しても、現在のシェルセッションにはDockerグループへの変更がすぐに反映されない。
*   **解決策**: コマンド実行後、**現在のWSLターミナルを閉じて、新しいWSLターミナルセッションを開始**する必要がある。

## 4. minikubeのインストールと`PATH`の問題

*   **問題**: `sudo install`でインストールした`minikube`や`kubectl`コマンドが`PATH`に含まれていない、または`execute_command`ツールが新しいシェルで実行されるため`PATH`の変更が反映されない。
*   **解決策**:
    *   `minikube`や`kubectl`のバイナリが`/usr/local/bin`にインストールされていることを確認する。
    *   `echo $PATH`で`/usr/local/bin`が`PATH`に含まれているか確認する。含まれていない場合は、`.bashrc`や`.zshrc`に`export PATH="/usr/local/bin:$PATH"`を追加し、`source ~/.bashrc`などで反映させる。
    *   `execute_command`ツールで実行する場合は、`eval $(minikube docker-env)`を同じコマンドチェーンに含めることで、Dockerデーモンの設定を適用する。

## 5. minikubeクラスタの起動と`kubectl`コンテキストの問題

*   **問題**: `minikube start`が完了する前に次のコマンドを実行すると、`kubectl`がminikubeクラスタに接続できないエラー（`localhost:8080`への接続拒否）や、「`no context exists with the name: "minikube"`」エラーが発生する。
*   **解決策**:
    *   `minikube start --driver=docker`コマンドが完全に完了するまで待つ。
    *   `minikube update-context`を実行して、`kubectl`のコンテキストを修正する。
    *   `eval $(minikube docker-env)`と`kubectl config use-context minikube`を同じコマンドチェーンで実行し、確実に設定を適用する。
    *   `minikube delete`で既存のクラスタを削除してから`minikube start`で再作成することで、クリーンな状態から開始する。

## 6. Dockerイメージのビルドと`ErrImageNeverPull`エラー

*   **問題**: KubernetesのPodが`ErrImageNeverPull`ステータスになる。これは、ローカルでビルドしたDockerイメージがminikubeクラスタのDockerデーモンに存在しない場合に発生する。
*   **解決策**:
    *   `eval $(minikube docker-env)`を現在のシェルに適用し、その後に`docker build`コマンドを実行することで、minikubeのDockerデーモンでイメージをビルドする。
    *   ビルドが完了したら、`kubectl rollout restart deployment <deployment-name>`でDeploymentを再起動し、新しいイメージを強制的にプルさせる。

## 7. Next.js `Dockerfile`の`standalone`出力と`ENV`形式の警告

*   **問題**:
    *   `Dockerfile`で`/app/.next/standalone`が見つからないエラーが発生する。
    *   `Dockerfile`の`ENV`設定で`LegacyKeyValueFormat`の警告が出る。
*   **解決策**:
    *   `nextjs-chat-frontend/next.config.ts`に`output: 'standalone'`を追加する。
    *   `Dockerfile`の`ENV`設定を`ENV KEY=VALUE`形式に修正する（例: `ENV NODE_ENV=production`）。

## 8. MongoDB接続エラー (`ECONNREFUSED`) と認証設定

*   **問題**: バックエンドサーバーからMongoDBへの接続で`ECONNREFUSED`エラーが発生する。MongoDB Podは`Running`だが、認証に失敗している可能性がある。
*   **解決策**:
    *   `kubernetes/mongodb-deployment.yaml`でMongoDBの`command: ["mongod", "--auth"]`を削除し、`MONGO_INITDB_ROOT_USERNAME`、`MONGO_INITDB_ROOT_PASSWORD`、`MONGO_INITDB_DATABASE`環境変数を設定する。これにより、MongoDB Dockerイメージが起動時に認証ユーザーを自動作成し、認証を有効にする。
    *   バックエンドの`server.js`で`createInitialData()`関数をコメントアウト解除し、初期ユーザーとチャンネルを作成する。

## 9. Next.jsフロントエンドからバックエンドへの接続 (`ERR_CONNECTION_REFUSED`)

*   **問題**: Next.jsフロントエンドがバックエンドAPI (`http://localhost:5000`) に接続できない。minikube環境では`localhost`はクラスタ外部を指すため、クラスタ内部のサービスには直接アクセスできない。
*   **解決策**:
    *   `backend-service`の`type`を`ClusterIP`から`NodePort`に変更する。
    *   フロントエンドの環境変数`NEXT_PUBLIC_BACKEND_URL`と`NEXT_PUBLIC_SOCKET_IO_URL`を、minikubeのIPアドレスとバックエンドサービスのNodePortに設定する（例: `http://<minikube-ip>:<backend-nodeport>`）。
    *   `nextjs-chat-frontend/Dockerfile`で`ARG`と`ENV`を使用して、ビルド時にこれらの環境変数を設定する。
    *   `kubectl rollout restart deployment frontend-deployment`でフロントエンドDeploymentを再起動し、新しい環境変数を適用する。

## 10. Ingressを使用したホストマシンからのアクセスとポートの問題

*   **問題**: Ingressを設定しても、ホストマシン（Windows）のブラウザからIngressで設定したホスト名（例: `chat.local`）にアクセスすると、`ERR_CONNECTION_TIMED_OUT`が発生する。また、`minikube service`コマンドで動的に割り当てられるポート番号が、フロントエンドの環境変数設定を困難にする。
*   **解決策**:
    *   **`/etc/hosts`の修正**: ホストマシン（Windows）の`C:\Windows\System32\drivers\etc\hosts`ファイルに、minikubeのIPアドレスとIngressのホスト名（例: `192.168.49.2 chat.local`、`192.168.49.2 api.chat.local`）のマッピングを追加する。これにより、ブラウザがIngressコントローラーにリクエストを送信できるようになる。
    *   **Ingressの`rewrite-target`アノテーションの削除**: Next.jsのApp Routerでは不要であり、問題を引き起こす可能性があるため、`nginx.ingress.kubernetes.io/rewrite-target: /`アノテーションを削除する。
    *   **環境変数の設定**:
        *   `kubernetes/frontend-deployment.yaml`の`NEXT_PUBLIC_BACKEND_URL`と`NEXT_PUBLIC_SOCKET_IO_URL`の`value`を、Ingressで設定するバックエンドのホスト名（例: `http://api.chat.local`）に設定する。
        *   `kubernetes/backend-deployment.yaml`の`FRONTEND_URL`の`value`を、Ingressで設定するフロントエンドのホスト名（例: `http://chat.local`）に設定する。
    *   **`minikube service ingress --url`コマンドの利用**: Ingressコントローラーが公開するポートは動的に割り当てられるため、`minikube service ingress --url`コマンドを実行して、IngressコントローラーのURL（例: `http://127.0.0.1:<動的なポート>`）を取得し、ブラウザでアクセスする。
    *   **TIPS**: `minikube service <service-name> --url`コマンドは、ホストマシンとWSL2間のポートフォワーディングを自動的に設定し、ブラウザから`http://127.0.0.1:<割り当てられたポート>`でアクセスできるようにする。

## 11. プロジェクト固有の考慮事項: WSL上のホストからのアクセス

*   **問題**: このプロジェクトでは、「WSL上のホストからアクセスする (frontendもbackendも)」という視点が常に重要となる。
*   **解決策**: 今後の考察や作業において、この点を最優先で考慮し、すべての設定やデプロイ戦略に反映させる。特に、ブラウザからアクセスするURLと、Kubernetesクラスタ内部でのサービス間通信のURLを明確に区別し、それぞれに適切な設定を行うことが肝要である。

## 12. コマンド実行に関する遵守事項

*   **`docker compose up`の実行**: 必ず`-d`オプションを付与する（`docker compose up -d`）。これにより、Docker Composeがバックグラウンドで実行され、Clineが新しいコマンドを実行する際にプロセスがkillされる可能性を懸念するため。また、ユーザー自身がコンソールを利用するためには、バックグラウンドに処理を移す方がシステム効率が良い。
*   **フォアグラウンド処理の継続**: フォアグラウンドで処理を継続するコマンドを実行する際には、デタッチオプションを付ける（あれば）。ない場合は、私に手動でコマンドを実行する依頼を行う。
*   **Next.js開発モードの初期化時間**: Next.jsをdevモードで実行する際は、ビルドなど初期化処理があるために、ユーザーからのスループットに6000ミリ秒程時間を要することがある。ブラウザを開いてすぐは、画面がホワイトアウトし何も表示されないが、次のコマンドを実行したりしないこと（もしくはスループットを考慮し、次のタスクの内容を決定・実行すること）。
