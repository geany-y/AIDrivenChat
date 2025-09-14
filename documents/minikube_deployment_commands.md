# Minikube環境へのデプロイコマンド履歴

このドキュメントは、Next.js + Node.js + MongoDBアプリケーションをminikube環境にデプロイする過程で実行された主要なコマンドをまとめたものです。

## 1. minikubeクラスタの起動と設定

```bash
minikube start --driver=docker --memory=2048mb
eval $(minikube docker-env)
kubectl config use-context minikube
```

## 2. Dockerイメージのビルド (minikubeのDockerデーモンを使用)

```bash
eval $(minikube docker-env) && docker build -t nextjs-chat-backend:latest ./nextjs-chat-backend
eval $(minikube docker-env) && docker build -t nextjs-chat-frontend:latest ./nextjs-chat-frontend
```

## 3. Kubernetesマニフェストの適用

```bash
kubectl apply -f kubernetes/mongodb-deployment.yaml -f kubernetes/backend-deployment.yaml -f kubernetes/frontend-deployment.yaml
```

## 4. Podのステータス確認

```bash
kubectl get pods
```

## 5. minikubeのIPアドレス確認

```bash
minikube ip
```

## 6. フロントエンドサービスのNodePort確認

```bash
kubectl get service frontend-service -o jsonpath='{.spec.ports[0].nodePort}' | grep -E [0-9]+
```

## 7. `minikube tunnel`の実行 (ホストマシンからのアクセス用)

```bash
minikube tunnel
```

## 8. ブラウザでのアクセス (例)

*   minikube IP: `192.168.49.2`
*   フロントエンド NodePort: `30000` (固定)
*   バックエンド NodePort: `30001` (固定)

フロントエンドへのアクセス: `http://localhost:30000` (minikube tunnel実行後)
バックエンドへのアクセス: `http://localhost:30001` (minikube tunnel実行後)

## 9. ログの取得方法

*   **Deploymentのログ**:
    ```bash
    kubectl logs deployment/<deployment-name>
    ```
    例: `kubectl logs deployment/backend-deployment`
    例: `kubectl logs deployment/frontend-deployment`
    例: `kubectl logs deployment/mongodb-deployment`

---

**注意**: `minikube tunnel`はバックグラウンドで実行され続けるプロセスであり、ターミナルを閉じると停止します。また、`sudo`権限が必要な場合があります。
