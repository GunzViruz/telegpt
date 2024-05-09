import OpenAI from "openai";
import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import request from 'request';

dotenv.config();

// Initialize Telegram bot with webhook
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
    webHook: {
        port: process.env.PORT || 4000 // Port number your server is running on
    }
});

const webhookUrl = process.env.WEBHOOK_URL; // Your publicly accessible HTTPS URL
bot.setWebHook(webhookUrl);

// Initialize OpenAI
const API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI(API_KEY);

// Answer question using OpenAI
async function answerQuestion(userMessage, userId, username) {
    try {
        const messages = [{"role": "system", "content": "You are a helpful assistant."}];

        messages.push({"role": "user", "content": userMessage});

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages
        });

        const botReply = response.choices[0].message.content;

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
    const userMessage = msg.text;

    if (userMessage.toLowerCase() === '/start') {
        return;
    }

    const botReply = await answerQuestion(userMessage);

    bot.sendMessage(chatId, botReply);
});

// Make HTTP request to webhook URL
request(webhookUrl, function(error, response, html) {
    if (!error) {
        if (200 == response.statusCode) {
            console.log('Webhook request successful.');
        }
    } else {
        console.error('Error making webhook request:', error);
    }
}).on('error', function(e) {
    console.error('Error making webhook request:', e);
}).end();

console.log('Telegram bot is running...');
