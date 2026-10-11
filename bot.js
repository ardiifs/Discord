require('./keep_alive');

const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

async function joinChannel() {
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return console.log('Guild tidak ditemukan');

    const channel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID);
    if (!channel) return console.log('Channel tidak ditemukan');

    joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: true,
    });

    console.log(`Joined: ${channel.name}`);
  } catch (err) {
    console.error('Error joining channel:', err);
  }
}

client.once('ready', () => {
  console.log(`Bot ready: ${client.user.tag}`);
  joinChannel();
});

// Auto-reconnect jika di-kick
client.on('voiceStateUpdate', (oldState, newState) => {
  if (
    oldState.member.id === client.user.id &&
    oldState.channelId &&
    !newState.channelId
  ) {
    console.log('Bot di-kick, reconnecting dalam 5 detik...');
    setTimeout(() => joinChannel(), 5000);
  }
});

// Handle error agar bot tidak crash
client.on('error', (err) => {
  console.error('Client error:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

client.login(process.env.BOT_TOKEN);
