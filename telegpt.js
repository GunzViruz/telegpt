import OpenAI from "openai";
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Konfigurasi API Key OpenAI
const API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI(API_KEY);

// Konfigurasi Token Bot Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Fungsi untuk memuat data pengguna dari file JSON
function loadUserData() {
  try {
    const data = fs.readFileSync('user_data.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

// Fungsi untuk menyimpan data pengguna ke file JSON
function saveUserData(data) {
  fs.writeFileSync('user_data.json', JSON.stringify(data, null, 2), 'utf8');
}

// Fungsi untuk memeriksa batasan pesan per hari
function checkMessageLimit(userId) {
  const userData = loadUserData();
  const today = new Date().toISOString().split('T')[0]; // Format tanggal: YYYY-MM-DD

  if (!userData[userId]) {
    userData[userId] = {
      username: "None", // Tambahkan username dengan nilai "None" jika tidak tersedia
      messages: 0,
      lastDate: today,
      messagesLog: []
    };
  }

  if (userData[userId].lastDate !== today) {
    userData[userId] = {
      username: userData[userId].username,
      messages: 0,
      lastDate: today,
      messagesLog: []
    };
  }

  if (userData[userId].messages < 49) {
    userData[userId].messages++;
    saveUserData(userData);
    return true; // Pengguna belum mencapai batasan
  } else {
    return false; // Pengguna telah mencapai batasan
  }
}

// Fungsi untuk menjawab pertanyaan dengan OpenAI
async function answerQuestion(userMessage, userId, username) {
  try {
    const userData = loadUserData();
    const today = new Date().toISOString().split('T')[0]; // Format tanggal: YYYY-MM-DD

    // Membuat percakapan multi-turn dengan konteks
    const messages = [
      {"role": "system", "content": "You are a helpful assistant."}
    ];

    if (userData[userId] && userData[userId].context) {
      messages.push({"role": "user", "content": userData[userId].context});
    }

    messages.push({"role": "user", "content": userMessage});

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages
    });

    const botReply = response.choices[0].message.content;

    // Memperbarui konteks pengguna
    userData[userId].context = botReply;

    // Cek apakah pesan pengguna sudah ada di log sebelum menyimpan
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
    console.error('Terjadi kesalahan:', error);
    return "Maaf, saya tidak dapat menjawab pertanyaan Anda saat ini.";
  }
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Explore Your Knowledge\n\nGunarGPT - Made With ❤️');
});

// Event handler untuk pesan yang diterima dari Telegram
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username; // Mendapatkan username pengguna
  const userId = msg.from.id;
  const userMessage = msg.text;

  if (userMessage.toLowerCase() === '/start') {
    // Jika pesan hanya berisi '/start', maka abaikan
    return;
  }

  if (checkMessageLimit(userId)) {
    const botReply = await answerQuestion(userMessage, userId);

    // Memperbarui struktur userData dengan username pengguna
    const userData = loadUserData();
    const today = new Date().toISOString().split('T')[0]; // Format tanggal: YYYY-MM-DD

    if (!userData[userId]) {
      userData[userId] = { messages: 0, lastDate: today, username: username, messagesLog: [] };
    } else {
      userData[userId].username = username;
    }

    // Cek apakah pesan pengguna sudah ada di log sebelum menyimpan
    const userLog = userData[userId].messagesLog;
    const hasDuplicateMessage = userLog.some((log) => log.message === userMessage);
    
    if (!hasDuplicateMessage) {
      // Menyimpan pesan pengguna ke dalam log hanya jika tidak ada duplikat
      userData[userId].messagesLog.push({
        timestamp: new Date().toISOString(),
        message: userMessage
      });
    }

    saveUserData(userData);

    // Mengirim balasan dari OpenAI ke Telegram
    bot.sendMessage(chatId, botReply);
  } else {
    // Pengguna telah mencapai batasan
    bot.sendMessage(chatId, 'Maaf, Anda telah mencapai batasan pesan harian.\n\nSorry, you have reached the daily message limit.');
  }
});

console.log('Bot Telegram sedang berjalan...');
