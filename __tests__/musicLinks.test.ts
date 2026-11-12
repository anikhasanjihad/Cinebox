import {parseMusicLink, titleFromUrl} from '../src/lib/music/providers/links';

describe('parseMusicLink', () => {
  const id = 'dQw4w9WgXcQ';
  it('reads YouTube and YouTube Music links', () => {
    expect(parseMusicLink(`https://music.youtube.com/watch?v=${id}&list=RDAMVM${id}`)).toEqual({kind: 'youtube', videoId: id});
    expect(parseMusicLink(`https://www.youtube.com/watch?v=${id}`)).toEqual({kind: 'youtube', videoId: id});
    expect(parseMusicLink(`https://youtu.be/${id}?si=abc`)).toEqual({kind: 'youtube', videoId: id});
    expect(parseMusicLink(`https://m.youtube.com/shorts/${id}`)).toEqual({kind: 'youtube', videoId: id});
  });
  it('reads direct audio URLs', () => {
    expect(parseMusicLink('https://example.com/a/My_Song.mp3?x=1')).toEqual({kind: 'audio', url: 'https://example.com/a/My_Song.mp3?x=1'});
  });
  it('leaves ordinary text and other links alone', () => {
    expect(parseMusicLink('arijit singh')).toBeNull();
    expect(parseMusicLink('https://example.com/page')).toBeNull();
    expect(parseMusicLink('https://www.youtube.com/@channel')).toBeNull();
    expect(parseMusicLink('two words https://youtu.be/dQw4w9WgXcQ')).toBeNull();
  });
  it('makes a title from a file url', () => {
    expect(titleFromUrl('https://x.com/m/Tum_Hi%20Ho.mp3')).toBe('Tum Hi Ho');
  });
});
