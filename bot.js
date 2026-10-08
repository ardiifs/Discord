require('./keep_alive');

const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus
} = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

let connection = null;
let player = null;
let currentIndex = 0;

function getMusicFiles() {
  const musicDir = path.join(__dirname, 'music');
  if (!fs.existsSync(musicDir)) {
    fs.mkdirSync(musicDir);
    console.log('Folder music/ dibuat, masukkan file MP3 ke sana');
    return [];
  }
  return fs.readdirSync(musicDir)
    .filter(f => f.endsWith('.mp3') || f.endsWith('.ogg'))
    .map(f => path.join(musicDir, f));
}

function playNext() {
  const files = getMusicFiles();
  if (files.length === 0) {
    console.log('Tidak ada file musik');
    return;
  }

  if (currentIndex >= files.length) currentIndex = 0;

  const file = files[currentIndex];
  console.log(`Playing: ${path.basename(file)}`);

  const resource = createAudioResource(file);
  player.play(resource);
  currentIndex++;
}

async function joinChannel() {
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return console.log('Guild tidak ditemukan');

    const channel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID);
    if (!channel) return console.log('Channel tidak ditemukan');

    connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    player = createAudioPlayer();
    connection.subscribe(player);

    // Auto play lagu berikutnya saat selesai
    player.on(AudioPlayerStatus.Idle, () => {
      setTimeout(() => playNext(), 1000);
    });

    // Auto retry kalau error
    player.on('error', (err) => {
      console.error('Player error:', err.message);
      setTimeout(() => playNext(), 3000);
    });

    // Auto reconnect kalau disconnect
    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log('Disconnected, reconnecting...');
      setTimeout(() => joinChannel(), 5000);
    });

    // Langsung putar
    playNext();
    console.log(`Joined: ${channel.name}`);

  } catch (err) {
    console.error('Error:', err);
    setTimeout(() => joinChannel(), 10000);
  }
}

// Auto reconnect kalau di-kick
client.on('voiceStateUpdate', (oldState, newState) => {
  if (
    oldState.member?.id === client.user.id &&
    oldState.channelId &&
    !newState.channelId
  ) {
    console.log('Bot di-kick, reconnecting dalam 5 detik...');
    setTimeout(() => joinChannel(), 5000);
  }
});

client.once('ready', () => {
  console.log(`Bot ready: ${client.user.tag}`);
  joinChannel();
});

client.on('error', (err) => console.error('Client error:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));

client.login(process.env.BOT_TOKEN);
