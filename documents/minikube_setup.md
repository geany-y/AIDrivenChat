# Minikube環境構築手順 (WSL2上)

このドキュメントは、WSL2環境にminikubeをセットアップし、Kubernetesクラスタをローカルで実行するための手順をまとめたものです。

## 1. Dockerのインストールと設定

minikubeはDockerをドライバーとして使用するため、まずDocker Engineをインストールします。

1.  **既存のDocker関連パッケージの削除 (もしあれば)**:
    ```bash
    sudo apt remove docker docker-engine docker.io containerd runc -y
    sudo apt autoremove -y
    ```
    *   **試行錯誤の経緯**: `containerd.io`と`containerd`の競合エラーが発生したため、既存のDocker関連パッケージを完全に削除する必要がありました。
2.  **Docker公式リポジトリの設定**:
    ```bash
    sudo apt update
    sudo apt install ca-certificates curl -y
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    ```
3.  **Docker Engineのインストール**:
    ```bash
    sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
    ```
4.  **Dockerグループへのユーザー追加**:
    ```bash
    sudo usermod -aG docker $USER
    ```
    **重要**: このコマンドを実行した後、**現在のWSLターミナルを閉じて、新しいWSLターミナルセッションを開始**してください。これにより、Dockerグループへの変更が反映されます。
5.  **Dockerの動作確認**:
    新しいターミナルで以下のコマンドを実行し、Dockerが正しく動作することを確認します。
    ```bash
    docker run hello-world
    ```
    "Hello from Docker!"のようなメッセージが表示されれば成功です。

## 2. kubectlのインストール

kubectlはKubernetesクラスタを操作するためのコマンドラインツールです。

1.  **kubectlバイナリのダウンロード**:
    ```bash
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    ```
2.  **実行権限の付与とPATHへの移動**:
    ```bash
    sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
    ```
3.  **ダウンロードしたファイルの削除**:
    ```bash
    rm kubectl
    ```
4.  **kubectlの動作確認**:
    ```bash
    kubectl version --client
    ```

## 3. minikubeのインストール

minikubeはローカルKubernetesクラスタを簡単にセットアップするためのツールです。

1.  **minikubeバイナリのダウンロード**:
    ```bash
    curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
    ```
2.  **実行権限の付与とPATHへの移動**:
    ```bash
    sudo install minikube-linux-amd64 /usr/local/bin/minikube
    ```
    *   **試行錯誤の経緯**: `minikube`コマンドが`PATH`に含まれていない、または`execute_command`ツールが新しいシェルで実行されるため`PATH`の変更が反映されない問題が発生しました。手動での`PATH`確認と設定が必要でした。
3.  **ダウンロードしたファイルの削除**:
    ```bash
    rm minikube-linux-amd64
    ```
4.  **minikubeの動作確認**:
    ```bash
    minikube version
    ```

## 4. minikubeクラスタの起動と設定

すべてのツールがインストールされたら、minikubeクラスタを起動し、`kubectl`が正しく連携するように設定します。

1.  **既存のminikubeクラスタの削除 (メモリ設定変更のため)**:
    ```bash
    minikube delete
    ```
    *   **試行錯誤の経緯**: 既存のminikubeクラスタのメモリサイズを変更できないため、一度削除してから再作成する必要がありました。
2.  **minikubeの起動**:
    ```bash
    minikube start --driver=docker --memory=2048mb
    ```
    *   **試行錯誤の経緯**: 起動時にメモリ割り当てに関する警告が出たため、`--memory`オプションで明示的にメモリを割り当てました。
    *   これにより、Dockerドライバーを使用してminikubeクラスタが起動します。初回起動時はイメージのダウンロードなどがあるため、時間がかかる場合があります。
3.  **Dockerデーモンをminikubeに切り替える**:
    ```bash
    eval $(minikube docker-env)
    ```
    *   このコマンドは、現在のシェルセッションでDockerコマンドがminikubeクラスタ内のDockerデーモンと通信するように設定します。これにより、minikubeクラスタ内で使用するDockerイメージを直接ビルドできるようになります。
    *   **試行錯誤の経緯**: `execute_command`ツールが新しいシェルセッションでコマンドを実行するため、`eval $(minikube docker-env)`が正しく適用されない問題が発生しました。イメージビルドとデプロイのコマンドチェーンに含めることで解決しました。
4.  **kubectlコンテキストの設定**:
    ```bash
    kubectl config use-context minikube
    ```
    *   **試行錯誤の経緯**: `kubectl`がminikubeクラスタに接続できないエラー（`localhost:8080`への接続拒否）や、「`no context exists with the name: "minikube"`」エラーが発生しました。`minikube update-context`でコンテキストを修正する必要がありました。
5.  **minikubeのステータス確認**:
    ```bash
    minikube status
    ```
    `host: Running`、`kubelet: Running`、`apiserver: Running`と表示されれば、クラスタは完全に起動しています。

これで、WSL2上にminikube環境が構築され、アプリケーションをデプロイする準備が整いました。

## 5. ホスト設定の追加

minikube環境でIngress経由でアプリケーションにアクセスするためには、以下のホスト名を`C:\Windows\System32\drivers\etc\hosts`ファイルに追加する必要があります。

1.  **minikubeのIPアドレスを確認**:
    ```bash
    minikube ip
    ```
    このコマンドで表示されるIPアドレスをメモします。

2.  **hostsファイルの編集**:
    管理者権限でテキストエディタ（例: メモ帳）を開き、`C:\Windows\System32\drivers\etc\hosts`ファイルを開きます。
    ファイルの最後に以下の行を追加します。`[minikube_ip]`は上記で確認したminikubeのIPアドレスに置き換えてください。

    ```
    [minikube_ip] chat.local
    [minikube_ip] api.chat.local
    ```

    例:
    ```
    192.168.49.2 chat.local
    192.168.49.2 api.chat.local
    ```

    これにより、ブラウザから`http://chat.local`や`http://api.chat.local`でアプリケーションにアクセスできるようになります。
