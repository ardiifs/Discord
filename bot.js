require('./keep_alive');

const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
} = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;

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
    return [];
  }
  const files = fs.readdirSync(musicDir)
    .filter(f => f.endsWith('.mp3') || f.endsWith('.ogg'))
    .map(f => path.join(musicDir, f));
  console.log(`Found ${files.length} music files`);
  return files;
}

function playNext() {
  const files = getMusicFiles();
  if (files.length === 0) {
    console.log('Tidak ada file musik');
    return;
  }
  if (currentIndex >= files.length) currentIndex = 0;

  const file = files[currentIndex];
  console.log(`Playing (${currentIndex + 1}/${files.length}): ${path.basename(file)}`);

  try {
    // Pakai ffmpeg spawn langsung untuk decode MP3 ke PCM
    const { spawn } = require('child_process');
    const ffmpeg = spawn(ffmpegPath, [
      '-i', file,
      '-analyzeduration', '0',
      '-loglevel', '0',
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1'
    ]);

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: require('@discordjs/voice').StreamType.Raw,
    });

    player.play(resource);
    currentIndex++;
  } catch (err) {
    console.error('Error playing:', err.message);
    currentIndex++;
    setTimeout(() => playNext(), 3000);
  }
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

    player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });

    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
      console.log('Track ended, playing next...');
      setTimeout(() => playNext(), 1000);
    });

    player.on('error', (err) => {
      console.error('Player error:', err.message);
      setTimeout(() => playNext(), 3000);
    });

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log('Disconnected, reconnecting...');
      setTimeout(() => joinChannel(), 5000);
    });

    playNext();
    console.log(`Joined: ${channel.name}`);

  } catch (err) {
    console.error('Error joining channel:', err);
    setTimeout(() => joinChannel(), 10000);
  }
}

client.on('voiceStateUpdate', (oldState, newState) => {
  if (
    oldState.member?.id === client.user.id &&
    oldState.channelId &&
    !newState.channelId
  ) {
    console.log('Bot di-kick, reconnecting...');
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
