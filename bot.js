require('./keep_alive');

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  NoSubscriberBehavior,
  StreamType,
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

// Konfigurasi Channel
const TEXT_CHANNEL_ID = process.env.CHANNEL_ID || process.env.TEXT_CHANNEL_ID || '1558823059572662323';
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID || '';
const GUILD_ID = process.env.GUILD_ID || '';

// Daftar Playlist
const PLAYLIST = [
  {
    name: 'DJ Set 1',
    detail: 'Part 1',
    file: 'DJ_part1.mp3',
  },
  {
    name: 'DJ Set 2',
    detail: 'Part 2',
    file: 'DJ_part2.mp3',
  },
  {
    name: 'DJ Set 3',
    detail: 'Part 3',
    file: 'DJ_part3.mp3',
  },
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

let connection = null;
let player = null;
let currentIndex = 0;
let isPlaying = false;
let currentProcess = null;
let controlMessage = null;

// Fungsi pembuat Embed & Buttons
function buildPlayerUI() {
  const currentTrack = PLAYLIST[currentIndex];

  const embed = new EmbedBuilder()
    .setTitle('🎧 DJ AFK Music Controller')
    .setColor(isPlaying ? 0x00FFA3 : 0x5865F2)
    .setDescription(
      isPlaying
        ? `🟢 **Sedang Memutar:**\n🎵 **${currentTrack.name}** (${currentTrack.detail})\n📁 File: \`${currentTrack.file}\``
        : '⏹️ **Status:** Berhenti / Siap Memutar\nSilakan pilih playlist di bawah untuk mulai memutar!'
    )
    .addFields(
      {
        name: '📜 Daftar Playlist',
        value: PLAYLIST.map((item, idx) => {
          const pointer = isPlaying && idx === currentIndex ? '▶️ ' : '▫️ ';
          return `${pointer}**${idx + 1}. ${item.name}** (${item.detail})`;
        }).join('\n'),
      }
    )
    .setFooter({ text: '24/7 DJ Music Bot • Koyeb & GitHub Ready' })
    .setTimestamp();

  // Tombol Playlist (DJ Set 1, DJ Set 2, DJ Set 3)
  const playlistRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('play_0')
      .setLabel('DJ Set 1')
      .setEmoji('🎵')
      .setStyle(isPlaying && currentIndex === 0 ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('play_1')
      .setLabel('DJ Set 2')
      .setEmoji('🎵')
      .setStyle(isPlaying && currentIndex === 1 ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('play_2')
      .setLabel('DJ Set 3')
      .setEmoji('🎵')
      .setStyle(isPlaying && currentIndex === 2 ? ButtonStyle.Success : ButtonStyle.Primary)
  );

  // Tombol Kontrol (Stop, Skip)
  const controlRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('stop_music')
      .setLabel('Stop')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!isPlaying),
    new ButtonBuilder()
      .setCustomId('skip_music')
      .setLabel('Skip')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [playlistRow, controlRow] };
}

// Update UI controller pesan di channel
async function updateUI() {
  if (!controlMessage) return;
  try {
    const ui = buildPlayerUI();
    await controlMessage.edit(ui);
  } catch (err) {
    console.error('Gagal memperbarui UI controller:', err.message);
  }
}

// Hentikan proses ffmpeg yang sedang aktif
function stopCurrentProcess() {
  if (currentProcess) {
    try {
      currentProcess.kill('SIGKILL');
    } catch (e) {}
    currentProcess = null;
  }
}

// Putar lagu berdasarkan index
function playTrack(index) {
  if (index < 0 || index >= PLAYLIST.length) index = 0;
  currentIndex = index;

  const track = PLAYLIST[currentIndex];
  const filePath = path.join(__dirname, 'music', track.file);

  if (!fs.existsSync(filePath)) {
    console.error(`File musik tidak ditemukan: ${filePath}`);
    return;
  }

  stopCurrentProcess();

  console.log(`Memutar: ${track.name} (${track.file})`);

  currentProcess = spawn(ffmpegPath, [
    '-i', filePath,
    '-analyzeduration', '0',
    '-loglevel', 'error',
    '-c:a', 'libopus',
    '-b:a', '128k',
    '-ar', '48000',
    '-ac', '2',
    '-page_duration', '20000', // 20ms per page agar selaras dengan Discord Opus frame
    '-flush_packets', '1',     // Flush packet langsung ke stream tanpa delay buffering
    '-f', 'ogg',
    'pipe:1',
  ]);

  currentProcess.stderr.on('data', d => console.error('ffmpeg error:', d.toString()));
  currentProcess.on('error', err => console.error('ffmpeg spawn error:', err));

  const resource = createAudioResource(currentProcess.stdout, {
    inputType: StreamType.OggOpus,
  });

  resource.playStream.on('error', err => console.error('Stream error:', err));

  if (!player) {
    player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });
    setupPlayerEvents();
  }

  if (connection) {
    connection.subscribe(player);
  }

  player.play(resource);
  isPlaying = true;

  updateUI();
}

// Setup Event Audio Player
function setupPlayerEvents() {
  player.on(AudioPlayerStatus.Idle, () => {
    if (isPlaying) {
      console.log('Lagu selesai, otomatis lanjut ke track berikutnya...');
      currentIndex = (currentIndex + 1) % PLAYLIST.length;
      playTrack(currentIndex);
    }
  });

  player.on('error', err => {
    console.error('Player error:', err.message);
    if (isPlaying) {
      setTimeout(() => {
        currentIndex = (currentIndex + 1) % PLAYLIST.length;
        playTrack(currentIndex);
      }, 2000);
    }
  });
}

// Stop Audio
function stopPlayback() {
  isPlaying = false;
  stopCurrentProcess();
  if (player) {
    player.stop(true);
  }
  updateUI();
  console.log('Playback dihentikan');
}

// Skip ke track selanjutnya
function skipTrack() {
  currentIndex = (currentIndex + 1) % PLAYLIST.length;
  playTrack(currentIndex);
}

// Masuk ke Voice Channel
async function joinVoice(targetChannel) {
  try {
    let voiceChannel = targetChannel;

    if (!voiceChannel && VOICE_CHANNEL_ID) {
      if (GUILD_ID) {
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID).catch(() => null);
        if (guild) {
          voiceChannel = guild.channels.cache.get(VOICE_CHANNEL_ID) || await guild.channels.fetch(VOICE_CHANNEL_ID).catch(() => null);
        }
      }
      if (!voiceChannel) {
        voiceChannel = client.channels.cache.get(VOICE_CHANNEL_ID) || await client.channels.fetch(VOICE_CHANNEL_ID).catch(() => null);
      }
    }

    if (!voiceChannel) {
      console.log('Tidak ada Voice Channel yang ditentukan.');
      return null;
    }

    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });

    if (!player) {
      player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play },
      });
      setupPlayerEvents();
    }

    connection.subscribe(player);

    connection.on(VoiceConnectionStatus.Disconnected, () => {
      console.log('Voice disconnected, mencoba reconnect dalam 5 detik...');
      setTimeout(() => joinVoice(voiceChannel), 5000);
    });

    console.log(`Berhasil join Voice Channel: ${voiceChannel.name}`);
    return connection;
  } catch (err) {
    console.error('Gagal join Voice Channel:', err);
    return null;
  }
}

// Kirim atau update pesan Controller Embed + Button saat bot start
async function sendControllerMessage() {
  try {
    let textChannel = null;

    if (GUILD_ID) {
      const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID).catch(() => null);
      if (guild) {
        textChannel = guild.channels.cache.get(TEXT_CHANNEL_ID) || await guild.channels.fetch(TEXT_CHANNEL_ID).catch(() => null);
      }
    }

    if (!textChannel) {
      textChannel = await client.channels.fetch(TEXT_CHANNEL_ID).catch(err => {
        console.error(`Tidak dapat menemukan channel ${TEXT_CHANNEL_ID}:`, err.message);
        return null;
      });
    }

    if (!textChannel || !textChannel.isTextBased()) {
      console.log(`Channel ${TEXT_CHANNEL_ID} bukan text channel atau tidak ditemukan.`);
      return;
    }

    // Bersihkan pesan controller lama yang dikirim oleh bot sebelumnya agar channel tetap rapi
    try {
      const recentMessages = await textChannel.messages.fetch({ limit: 10 });
      const oldMsg = recentMessages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
      if (oldMsg) {
        await oldMsg.delete().catch(() => {});
      }
    } catch (e) {}

    const ui = buildPlayerUI();
    controlMessage = await textChannel.send(ui);
    console.log(`Controller Embed & Button berhasil dikirim ke channel: ${textChannel.name} (${TEXT_CHANNEL_ID})`);
  } catch (err) {
    console.error('Gagal mengirim controller embed:', err);
  }
}

// Handle Klik Tombol (Interaction)
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;

  // Pastikan bot berada di Voice Channel jika user klik play/skip
  if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
    const userVoice = interaction.member?.voice?.channel;
    if (userVoice) {
      await joinVoice(userVoice);
    } else if (VOICE_CHANNEL_ID) {
      await joinVoice();
    } else {
      await interaction.reply({
        content: '⚠️ Kamu harus masuk ke Voice Channel terlebih dahulu, atau atur `VOICE_CHANNEL_ID` di environment variables!',
        ephemeral: true,
      });
      return;
    }
  }

  await interaction.deferUpdate().catch(() => {});

  if (customId === 'play_0') {
    playTrack(0);
  } else if (customId === 'play_1') {
    playTrack(1);
  } else if (customId === 'play_2') {
    playTrack(2);
  } else if (customId === 'stop_music') {
    stopPlayback();
  } else if (customId === 'skip_music') {
    skipTrack();
  }
});

// Event Voice State Update (Reconnect jika ter-kick)
client.on('voiceStateUpdate', (oldState, newState) => {
  if (oldState.member?.id === client.user.id && oldState.channelId && !newState.channelId) {
    console.log('Bot terputus dari voice, menyambung ulang dalam 5 detik...');
    setTimeout(() => joinVoice(), 5000);
  }
});

// Bot Siap
client.once('ready', async () => {
  console.log(`=================================`);
  console.log(`Bot siap: ${client.user.tag}`);
  console.log(`Target Channel ID: ${TEXT_CHANNEL_ID}`);
  console.log(`=================================`);

  // Kirim embed + button ke channel target
  await sendControllerMessage();

  // Otomatis join voice jika VOICE_CHANNEL_ID disetel
  if (VOICE_CHANNEL_ID) {
    await joinVoice();
  }
});

client.on('error', err => console.error('Client error:', err));
process.on('unhandledRejection', err => console.error('Unhandled Rejection:', err));

client.login(process.env.BOT_TOKEN);
