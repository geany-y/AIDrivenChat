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

// ミドルウェア
app.use(express.json());

// JWT認証ミドルウェア (Socket.io用)
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

// ルートハンドラ (API)
app.get("/", (req, res) => {
    res.send("Chat Backend API is running");
});

// ユーザーモデル (簡易版)
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const User = mongoose.model("User", UserSchema);

// チャンネルモデル (簡易版)
const ChannelSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
});
const Channel = mongoose.model("Channel", ChannelSchema);

// メッセージモデル (簡易版)
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

// DAO/Repositoryパターン (簡易版)
class UserRepository {
    async findByUsername(username) {
        return User.findOne({ username });
    }
    async create(username, passwordHash) {
        const user = new User({ username, password: passwordHash });
        await user.save();
        return user;
    }
}

class ChannelRepository {
    async findAll() {
        return Channel.find();
    }
    async findById(id) {
        return Channel.findById(id);
    }
    async create(name) {
        const channel = new Channel({ name });
        await channel.save();
        return channel;
    }
}

class MessageRepository {
    async findByChannelId(channelId) {
        return Message.find({ channelId }).sort({ timestamp: 1 });
    }
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
    async findThreadMessages(parentId) {
        return Message.find({ parentId }).sort({ timestamp: 1 });
    }
}

const userRepository = new UserRepository();
const channelRepository = new ChannelRepository();
const messageRepository = new MessageRepository();

// 認証ルート
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
        res.json({ token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// チャンネル取得ルート (認証不要、初期データ取得用)
app.get("/api/channels", async (req, res) => {
    try {
        const channels = await channelRepository.findAll();
        res.json(channels);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// メッセージ履歴取得ルート (認証必要)
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

// Socket.io接続処理
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

// 初期ユーザーとチャンネルの作成 (開発用)
async function createInitialData() {
    try {
        // ユーザーが存在しない場合のみ作成
        let user = await userRepository.findByUsername("testuser");
        if (!user) {
            const hashedPassword = await bcrypt.hash("password", 10);
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
