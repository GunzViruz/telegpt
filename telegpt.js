import OpenAI from "openai";
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Telegram bot with webhook
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
    webHook: {
        port: process.env.PORT || 4000; // Port number your server is running on
    }
});

const webhookUrl = process.env.WEBHOOK_URL; // Your publicly accessible HTTPS URL
bot.setWebHook(webhookUrl);

// Initialize OpenAI
const API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI(API_KEY);

// Load user data from JSON file
function loadUserData() {
    try {
        const data = fs.readFileSync('user_data.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

// Save user data to JSON file
function saveUserData(data) {
    fs.writeFileSync('user_data.json', JSON.stringify(data, null, 2), 'utf8');
}

// Check message limit per day
function checkMessageLimit(userId) {
    const userData = loadUserData();
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

    if (!userData[userId]) {
        userData[userId] = {
            username: "None",
            messages: 0,
            lastDate: today,
            messagesLog: []
        };
    }

    if (userData[userId].lastDate !== today) {
        userData[userId].messages = 0;
        userData[userId].lastDate = today;
    }

    if (userData[userId].messages < 49) {
        userData[userId].messages++;
        saveUserData(userData);
        return true;
    } else {
        return false;
    }
}

// Answer question using OpenAI
async function answerQuestion(userMessage, userId, username) {
    try {
        const userData = loadUserData();
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

        const messages = [{"role": "system", "content": "You are a helpful assistant."}];

        if (userData[userId] && userData[userId].context) {
            messages.push({"role": "user", "content": userData[userId].context});
        }

        messages.push({"role": "user", "content": userMessage});

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages
        });

        const botReply = response.choices[0].message.content;

        userData[userId].context = botReply;

        const userLog = userData[userId].messagesLog;
        const hasDuplicateMessage = userLog.some((log) => log.message === userMessage);
        
        if (!hasDuplicateMessage) {
            userData[userId].messagesLog.push({
                timestamp: new Date().toISOString(),
                message: userMessage
            });
        }

        saveUserData(userData);

        return botReply;
    } catch (error) {
        console.error('Error:', error);
        return "Sorry, I couldn't answer your question at the moment.";
    }
}

// Handle start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Explore Your Knowledge\n\nGunarGPT - Made With ❤️');
});

// Handle incoming messages via webhook
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    const userId = msg.from.id;
    const userMessage = msg.text;

    if (userMessage.toLowerCase() === '/start') {
        return;
    }

    if (checkMessageLimit(userId)) {
        const botReply = await answerQuestion(userMessage, userId);

        const userData = loadUserData();
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

        if (!userData[userId]) {
            userData[userId] = { messages: 0, lastDate: today, username: username, messagesLog: [] };
        } else {
            userData[userId].username = username;
        }

        const userLog = userData[userId].messagesLog;
        const hasDuplicateMessage = userLog.some((log) => log.message === userMessage);
        
        if (!hasDuplicateMessage) {
            userData[userId].messagesLog.push({
                timestamp: new Date().toISOString(),
                message: userMessage
            });
        }

        saveUserData(userData);

        bot.sendMessage(chatId, botReply);
    } else {
        bot.sendMessage(chatId, 'Sorry, you have reached the daily message limit.');
    }
});

console.log('Telegram bot is running...');
