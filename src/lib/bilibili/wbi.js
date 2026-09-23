const API_URL = 'https://api.bilibili.com/x/space/arc/search';

export async function fetchUserVideos(uid) {
  const url = new URL(API_URL);
  url.searchParams.set('mid', String(uid));
  url.searchParams.set('pn', '1');
  url.searchParams.set('ps', '30');
  url.searchParams.set('order', 'pubdate');
  url.searchParams.set('jsonp', 'jsonp');

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      referer: 'https://space.bilibili.com/' + uid + '/video',
      'user-agent': 'Mozilla/5.0',
    },
  });

  if (response.status === 403 || response.status === 412) {
    throw new Error('Bilibili API rejected request: HTTP ' + response.status);
  }

  if (!response.ok) {
    throw new Error('Bilibili API request failed: HTTP ' + response.status);
  }

  const payload = await response.json();

  if (payload.code !== 0) {
    throw new Error(
      'Bilibili API returned code ' + payload.code + ': ' + (payload.message || 'unknown error'),
    );
  }

  const list = payload && payload.data && payload.data.list;

  return {
    username: (list && list.name) || String(uid),
    videos: Array.isArray(list && list.vlist) ? list.vlist : [],
  };
}
.js';kk'kn
