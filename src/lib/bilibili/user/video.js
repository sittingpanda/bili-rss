import { renderRss2 } from '../../../utils/util';
import { fetchUserVideos } from '../wbi.js';

const deal = async (ctx) => {
  const { uid } = ctx.req.param();

  if (!/^\d+$/.test(uid)) {
    return ctx.json({ error: 'Invalid Bilibili UID' }, 400);
  }

  try {
    const { username, videos } = await fetchUserVideos(uid);

    const items = videos
      .filter((video) => video && video.bvid)
      .map((video) => {
        const link = `https://www.bilibili.com/video/${video.bvid}`;

        return {
          title: video.title || video.bvid,
          link,
          guid: link,
          description: video.description || '',
          author: video.author || username,
          pubDate: new Date(
            Number(video.created || 0) * 1000,
          ).toUTCString(),
          category: 'bilibili',
        };
      });

    const rss = renderRss2({
      title: `${username} 的 bilibili 视频`,
      link: `https://space.bilibili.com/${uid}/video`,
      description: `${username} 的 bilibili 视频`,
      language: 'zh-cn',
      items,
    });

    ctx.header('Content-Type', 'application/xml; charset=utf-8');

    return ctx.body(rss);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    const status =
      message.includes('timeout') || message.includes('timed out')
        ? 504
        : 502;

    return ctx.json(
      {
        error: 'Bilibili upstream request failed',
        message,
      },
      status,
    );
  }
};

const setup = (route) => {
  route.get('/bilibili/user/video/:uid', deal);
};

export default { setup };
