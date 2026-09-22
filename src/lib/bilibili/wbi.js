import forge from 'node-forge/lib/index.js';

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 48, 23, 3,
  8, 32, 15, 50, 10, 31, 41, 5,
  1, 6, 43, 28, 35, 27, 24, 13,
  9, 19, 30, 16, 25, 34, 39, 14,
  4, 29, 22, 44, 12, 33, 17, 26,
  20, 42, 45, 38, 37, 7, 21, 11,
  40, 36, 49, 52, 0, 51,
];

let cachedWbiKey = null;
let cachedWbiKeyExpiresAt = 0;

function getKeyFromUrl(url) {
  const filename = url.split('/').pop() || '';
  return filename.split('.')[0];
}

function getMixinKey(originalKey) {
  return MIXIN_KEY_ENC_TAB
    .map((index) => originalKey[index] || '')
    .join('')
    .slice(0, 32);
}

function md5(value) {
  const hash = forge.md.md5.create();
  hash.update(value, 'utf8');
  return hash.digest().toHex();
}

function encode(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

async function getWbiKey() {
  if (cachedWbiKey && Date.now() < cachedWbiKeyExpiresAt) {
    return cachedWbiKey;
  }

  const response = await fetch('https://api.bilibili.com/x/web-interface/nav', {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Bilibili nav request failed: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const imgUrl = payload?.data?.wbi_img?.img_url;
  const subUrl = payload?.data?.wbi_img?.sub_url;

  if (!imgUrl || !subUrl) {
    throw new Error('Bilibili nav response did not contain WBI keys');
  }

  const imgKey = getKeyFromUrl(imgUrl);
  const subKey = getKeyFromUrl(subUrl);

  cachedWbiKey = getMixinKey(imgKey + subKey);
  cachedWbiKeyExpiresAt = Date.now() + 6 * 60 * 60 * 1000;

  return cachedWbiKey;
}

function signParams(params, mixinKey) {
  const wts = Math.floor(Date.now() / 1000);

  const signedParams = {
    ...params,
    wts,
  };

  const query = Object.keys(signedParams)
    .sort()
    .map((key) => `${encode(key)}=${encode(signedParams[key])}`)
    .join('&');

  return {
    query,
    wRid: md5(query + mixinKey),
  };
}

export async function fetchUserVideos(uid) {
  const mixinKey = await getWbiKey();

  const params = {
    mid: String(uid),
    ps: '30',
    pn: '1',
    tid: '0',
    keyword: '',
    order: 'pubdate',
    platform: 'web',
    web_location: '1550101',
  };

  const { query, wRid } = signParams(params, mixinKey);

  const url =
    `https://api.bilibili.com/x/space/wbi/arc/search?${query}` +
    `&w_rid=${wRid}`;

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      referer: `https://space.bilibili.com/${uid}/video`,
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (response.status === 403 || response.status === 412) {
    throw new Error(`Bilibili API rejected request: HTTP ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`Bilibili API request failed: HTTP ${response.status}`);
  }

  const payload = await response.json();

  if (payload.code !== 0) {
    throw new Error(
      `Bilibili API returned code ${payload.code}: ${payload.message || 'unknown error'}`,
    );
  }

  return {
    username: payload?.data?.list?.name || String(uid),
    videos: payload?.data?.list?.vlist || [],
  };
}
