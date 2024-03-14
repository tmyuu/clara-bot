// !pnpm install dotenv discord.js axios
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { fork } from 'child_process';

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN;
const targetChannelId = process.env.TARGET_CHANNEL_ID;
const doneEmojiId = process.env.DONE_EMOJI_ID;

class BotLogger {
    static formatLog(level, message) {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] ${message}`;
    }
}

class MessageBuilder {
    static buildBottleEmptyMessage() {
        const channelId = targetChannelId;
        const customEmoji = `<:42_done:${doneEmojiId}>`;
        const embed = new EmbedBuilder()
            .setColor('#ffffff')
            .setTitle('AC07-1(白)のボトルが空になりました。')
            .setDescription(`交換対応した方はこのメッセージにリアクション ${customEmoji} をつけてください！`)
            .setTimestamp();
        return { channelId, embed };
    }

    static buildBottleReplacedMessage(userId, seconds) {
        return new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle(`ボトルが交換されました！`)
            .setDescription(`${userId} さんがボトルを交換してくれました！\n交換までにかかった時間は${seconds}秒です。`)
            .setTimestamp();
    }    
}

class MessagePoster {
    constructor(client) {
        this.client = client;
    }

    async postMessage(channelId, embed) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel.isTextBased()) {
                throw new Error(`Channel ${channelId} is not text-based.`);
            }
            const sentMessage = await channel.send({ embeds: [embed] });
            console.log(BotLogger.formatLog('INFO', `Message sent successfully. Message ID: ${sentMessage.id}`));
            return { messageId: sentMessage.id, channelId };
        } catch (error) {
            console.error(BotLogger.formatLog('ERROR', `Failed to send message: ${error}`));
            await this.notifyError(channelId, `An error occurred: ${error.message}`);
            process.exit(1);
        }
    }

    async notifyError(channelId, errorMessage) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel.isTextBased()) return;
            await channel.send({ content: errorMessage });
        } catch (error) {
            console.error(BotLogger.formatLog('ERROR', `Failed to notify error: ${error}`));
            process.exit(1);
        }
    }
}

class ReactionHandler {
    constructor(client, onMessageProcessedCallback) {
        this.client = client;
        this.watchedMessageIds = new Map();
        this.onMessageProcessedCallback = onMessageProcessedCallback;
    }

    setupReactionListener() {
        this.client.on('messageReactionAdd', async (reaction, user) => {
            if (user.bot) return;

            const messageId = reaction.message.id;
            const reactionEmoji = reaction.emoji.name;
            const userName = user.username;

            if (reactionEmoji === '42_done' && this.watchedMessageIds.has(messageId)) {
                console.log(BotLogger.formatLog('INFO', `Reaction 42_done detected from userName: ${userName} for messageId: ${messageId}`));

                const messageTime = this.watchedMessageIds.get(messageId);
                const reactionTime = Date.now();
                const timeTaken = ((reactionTime - messageTime) / 1000).toFixed(2);

                const embed = MessageBuilder.buildBottleReplacedMessage(`<@${user.id}>`, timeTaken);
                try {
                    const sentMessage = await reaction.message.channel.send({ embeds: [embed] });
                    console.log(BotLogger.formatLog('INFO', `Bottle replaced message sent successfully. messageId: ${sentMessage.id}`));
                    this.onMessageProcessedCallback();
                } catch (error) {
                    console.error(BotLogger.formatLog('ERROR', `Failed to send bottle replaced message: ${error}`));
                }

                this.watchedMessageIds.delete(messageId);
                fork('postUserId.js', [user.username]);
            } else if (!user.bot) {
                console.log(BotLogger.formatLog('INFO', `Reaction ${reactionEmoji} detected from userName: ${userName} for messageId: ${messageId}`));
            }
        });
    }

    watchMessage(messageId, timestamp) {
        this.watchedMessageIds.set(messageId, timestamp);
    }
}

class DiscordBot {
    constructor(token) {
        this.token = token;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions,
            ]
        });
        this.childProcess = null;
        this.reactionHandler = new ReactionHandler(this.client, () => this.restartChildProcess());
    }

    async initialize() {
        this.client.once('ready', () => {
            console.log(BotLogger.formatLog('INFO', 'Bot is ready!'));
            this.reactionHandler.setupReactionListener();
            this.startChildProcess();
        });

        await this.client.login(this.token);
    }

    startChildProcess() {
        if (this.childProcess) {
            this.childProcess.kill();
        }

        this.childProcess = fork('getBottleStatus.js');

        this.childProcess.on('message', async (message) => {
            if (message.type === 'statusFalse') {
                const { channelId, embed } = MessageBuilder.buildBottleEmptyMessage();
                const messagePoster = new MessagePoster(this.client);
                const { messageId } = await messagePoster.postMessage(channelId, embed);
                if (messageId) {
                    this.reactionHandler.watchMessage(messageId, Date.now());
                }
            }
        });
    }

    restartChildProcess() {
        console.log(BotLogger.formatLog('INFO', 'Restarting child process...'));
        this.startChildProcess();
    }
}

const bot = new DiscordBot(token);
bot.initialize();