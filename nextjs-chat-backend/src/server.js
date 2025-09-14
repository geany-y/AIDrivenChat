require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000", // Next.jsフロントエンドのURL
        methods: ["GET", "POST"],
    },
});

// MongoDB接続
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB connection error:", err));

app.use(express.json());

/**
 * Socket.io用のJWT認証ミドルウェア。
 * クライアントからの接続時にトークンを検証し、ユーザー情報をソケットにアタッチします。
 * @param {Socket} socket - Socket.ioソケットオブジェクト
 * @param {Function} next - 次のミドルウェアに進むためのコールバック
 */
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error("Authentication error: No token provided"));
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return next(new Error("Authentication error: Invalid token"));
        }
        socket.user = decoded; // ユーザー情報をソケットにアタッチ
        next();
    });
});

app.get("/", (req, res) => {
    res.send("Chat Backend API is running");
});

/**
 * ユーザーモデルのスキーマ定義。
 * @typedef {Object} User
 * @property {string} username - ユーザー名 (必須、ユニーク)
 * @property {string} password - ハッシュ化されたパスワード (必須)
 */
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const User = mongoose.model("User", UserSchema);

/**
 * チャンネルモデルのスキーマ定義。
 * @typedef {Object} Channel
 * @property {string} name - チャンネル名 (必須、ユニーク)
 */
const ChannelSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
});
const Channel = mongoose.model("Channel", ChannelSchema);

/**
 * メッセージモデルのスキーマ定義。
 * @typedef {Object} Message
 * @property {mongoose.Schema.Types.ObjectId} channelId - チャンネルID (必須)
 * @property {mongoose.Schema.Types.ObjectId} userId - ユーザーID (必須)
 * @property {string} username - ユーザー名 (必須)
 * @property {string} content - メッセージ内容 (必須)
 * @property {mongoose.Schema.Types.ObjectId} [parentId] - 親メッセージID (スレッド用、オプション)
 * @property {Date} timestamp - タイムスタンプ (デフォルトは現在時刻)
 */
const MessageSchema = new mongoose.Schema({
    channelId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Channel",
        required: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    username: { type: String, required: true },
    content: { type: String, required: true },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
        default: null,
    }, // スレッド用
    timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", MessageSchema);

/**
 * ユーザーデータアクセスオブジェクト (Repository)。
 */
class UserRepository {
    /**
     * ユーザー名を指定してユーザーを検索します。
     * @param {string} username - 検索するユーザー名
     * @returns {Promise<User|null>} ユーザーオブジェクトまたはnull
     */
    async findByUsername(username) {
        return User.findOne({ username });
    }

    /**
     * 新しいユーザーを作成します。
     * @param {string} username - 作成するユーザー名
     * @param {string} passwordHash - ハッシュ化されたパスワード
     * @returns {Promise<User>} 作成されたユーザーオブジェクト
     */
    async create(username, passwordHash) {
        const user = new User({ username, password: passwordHash });
        await user.save();
        return user;
    }
}

/**
 * チャンネルデータアクセスオブジェクト (Repository)。
 */
class ChannelRepository {
    /**
     * すべてのチャンネルを取得します。
     * @returns {Promise<Channel[]>} チャンネルオブジェクトの配列
     */
    async findAll() {
        return Channel.find();
    }

    /**
     * IDを指定してチャンネルを検索します。
     * @param {string} id - 検索するチャンネルID
     * @returns {Promise<Channel|null>} チャンネルオブジェクトまたはnull
     */
    async findById(id) {
        return Channel.findById(id);
    }

    /**
     * 新しいチャンネルを作成します。
     * @param {string} name - 作成するチャンネル名
     * @returns {Promise<Channel>} 作成されたチャンネルオブジェクト
     */
    async create(name) {
        const channel = new Channel({ name });
        await channel.save();
        return channel;
    }
}

/**
 * メッセージデータアクセスオブジェクト (Repository)。
 */
class MessageRepository {
    /**
     * チャンネルIDを指定してメッセージを検索します。
     * @param {string} channelId - 検索するチャンネルID
     * @returns {Promise<Message[]>} メッセージオブジェクトの配列
     */
    async findByChannelId(channelId) {
        return Message.find({ channelId }).sort({ timestamp: 1 });
    }

    /**
     * 新しいメッセージを作成します。
     * @param {string} channelId - メッセージが属するチャンネルID
     * @param {string} userId - メッセージを送信したユーザーID
     * @param {string} username - メッセージを送信したユーザー名
     * @param {string} content - メッセージ内容
     * @param {string|null} [parentId=null] - 親メッセージID (スレッド用、オプション)
     * @returns {Promise<Message>} 作成されたメッセージオブジェクト
     */
    async create(channelId, userId, username, content, parentId = null) {
        const message = new Message({
            channelId,
            userId,
            username,
            content,
            parentId,
        });
        await message.save();
        return message;
    }

    /**
     * 親メッセージIDを指定してスレッドメッセージを検索します。
     * @param {string} parentId - 親メッセージID
     * @returns {Promise<Message[]>} スレッドメッセージオブジェクトの配列
     */
    async findThreadMessages(parentId) {
        return Message.find({ parentId }).sort({ timestamp: 1 });
    }
}

const userRepository = new UserRepository();
const channelRepository = new ChannelRepository();
const messageRepository = new MessageRepository();

/**
 * ユーザー認証のためのログインAPI。
 * ユーザー名とパスワードを受け取り、検証に成功した場合JWTを返します。
 * @param {Object} req - Expressリクエストオブジェクト
 * @param {Object} res - Expressレスポンスオブジェクト
 */
app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await userRepository.findByUsername(username);
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );
        // JWTトークンをHTTP Only Cookieとして設定
        res.cookie("jwt", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // 本番環境ではHTTPSを強制
            sameSite: "Lax", // CSRF対策
            maxAge: 3600000, // 1時間 (expiresInと同じ)
        });
        res.json({ message: "Login successful" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * すべてのチャンネルを取得するAPI。
 * @param {Object} req - Expressリクエストオブジェクト
 * @param {Object} res - Expressレスポンスオブジェクト
 */
app.get("/api/channels", async (req, res) => {
    try {
        const channels = await channelRepository.findAll();
        res.json(channels);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * 特定のチャンネルのメッセージ履歴を取得するAPI。
 * @param {Object} req - Expressリクエストオブジェクト
 * @param {Object} res - Expressレスポンスオブジェクト
 */
app.get("/api/channels/:channelId/messages", async (req, res) => {
    // ここにJWT認証ミドルウェアを追加することも可能
    // 例: authMiddleware (後で実装)
    try {
        const messages = await messageRepository.findByChannelId(
            req.params.channelId
        );
        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

/**
 * Socket.io接続イベントハンドラ。
 * クライアントが接続した際の処理を定義します。
 * @param {Socket} socket - 接続されたSocket.ioソケットオブジェクト
 */
io.on("connection", (socket) => {
    console.log("a user connected:", socket.user.username);

    // ユーザーのオンライン状態を管理 (簡易版)
    // 実際にはRedisなどを使って永続化・分散管理する
    socket.join("global"); // 全体チャットルームにデフォルトで参加

    socket.on("joinChannel", async (channelId) => {
        // 以前参加していたチャンネルから離脱
        Object.keys(socket.rooms).forEach((room) => {
            if (room !== socket.id && room !== "global") {
                // socket.idとglobalは離脱しない
                socket.leave(room);
            }
        });
        socket.join(channelId);
        console.log(`${socket.user.username} joined channel: ${channelId}`);
        // チャンネル参加時に過去メッセージを送信することも可能だが、API経由で取得する想定
    });

    socket.on(
        "sendMessage",
        async ({ channelId, content, parentId = null }) => {
            try {
                // ユーザーがチャンネルに参加しているか確認 (ゼロトラストの認可)
                if (!socket.rooms.has(channelId)) {
                    socket.emit(
                        "error",
                        "You are not authorized to send messages to this channel."
                    );
                    return;
                }

                const message = await messageRepository.create(
                    channelId,
                    socket.user.id,
                    socket.user.username,
                    content,
                    parentId
                );
                io.to(channelId).emit("receiveMessage", message); // 同じチャンネルの全員に送信
                console.log(
                    `Message from ${socket.user.username} in ${channelId}: ${content}`
                );
            } catch (err) {
                console.error("Error sending message:", err);
                socket.emit("error", "Failed to send message.");
            }
        }
    );

    socket.on("disconnect", () => {
        console.log("user disconnected:", socket.user.username);
        // オンライン状態の更新
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

/**
 * 開発用に初期ユーザーとチャンネルを作成します。
 * 本番環境ではこの関数は実行しないか、適切な初期化スクリプトに含めるべきです。
 * 初期ユーザーのパスワードは環境変数 INITIAL_USER_PASSWORD から読み込まれます。
 * 環境変数が設定されていない場合は "password" がデフォルトとして使用されます。
 */
async function createInitialData() {
    try {
        // ユーザーが存在しない場合のみ作成
        let user = await userRepository.findByUsername("testuser");
        if (!user) {
            const initialPassword =
                process.env.INITIAL_USER_PASSWORD || "password";
            const hashedPassword = await bcrypt.hash(initialPassword, 10);
            user = await userRepository.create("testuser", hashedPassword);
            console.log('Initial user "testuser" created.');
        }

        // チャンネルが存在しない場合のみ作成
        let generalChannel = await channelRepository.findById(
            "650d7e7e7e7e7e7e7e7e7e7e"
        ); // 仮のID
        if (!generalChannel) {
            generalChannel = await channelRepository.create("general");
            console.log('Initial channel "general" created.');
        }
        let randomChannel = await channelRepository.findById(
            "650d7e7e7e7e7e7e7e7e7e7f"
        ); // 仮のID
        if (!randomChannel) {
            randomChannel = await channelRepository.create("random");
            console.log('Initial channel "random" created.');
        }
    } catch (err) {
        console.error("Error creating initial data:", err);
    }
}

// サーバー起動時に初期データを作成
createInitialData(); // 開発時に一度実行したらコメントアウトするか、適切な起動スクリプトに含める
