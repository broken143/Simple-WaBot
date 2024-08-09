const { formatSize } = require('../../lib/func.js');
const { download } = require('../../lib/scraper/youtube.js');
const ufs = require('../../lib/ufs.js');

const isLimit = 70 * 1024 * 1024; // 70 MB

exports.cmd = {
    name: ['ytmp4'],
    command: ['ytmp4'],
    category: ['download'],
    detail: {
        desc: 'Descarga el video de YouTube.',
        use: '@url=[yt]'
    },
    setting: {
        error_react: true
    },
    async start({ msg, text }) {
        if (!text) {
            return msg.reply('*🚩 Ingresa el enlace del video de YouTube que deseas descargar.*');
        }
        
        if (!isYouTubeUrl(text)) {
            return msg.reply('*🚩 Por favor, ingresa un enlace válido de YouTube.*');
        }

        await msg.react('🕓');

        const video = await getVideo(text);

        if (!video) {
            await msg.react('✖');
            return msg.reply('*📛 | Ups, hubo un error al obtener el resultado.*');
        }

        const urlToUse = video.url || video.buffer;
        const sizeInBytes = await ufs(urlToUse);

        if (sizeInBytes >= isLimit) {
            const readableSize = await formatSize(sizeInBytes);
            const limitReadable = await formatSize(isLimit);
            await msg.react('✖');
            return msg.reply(`*📂 | El video pesa ${readableSize}, excede el límite máximo de descarga que es de ${limitReadable}.*`);
        }

        await msg.reply(video.title, { video: urlToUse });
        await msg.react('✅');
    }
};

async function getVideo(url) {
    let status, result;
    for (const version of ['V2', 'V3', 'V1']) {
        ({ status, result } = await download[version](url, 'video'));
        if (status) {
            const video = result.video.find(v => v.quality === '360p');
            if (video) return video;
        }
    }
    return null;
}

function isYouTubeUrl(url) {
    const regex = /^(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch|v|embed|shorts)\/?(?:\?.*v=|\/)?)([a-zA-Z0-9_-]+)/;
    return regex.test(url);
}