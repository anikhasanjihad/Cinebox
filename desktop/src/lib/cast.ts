import {invoke} from '@tauri-apps/api/core';

/** A TV / speaker found on the local network (DLNA / UPnP). */
export interface CastDevice { name: string; control: string }

export const castSupported = () => '__TAURI_INTERNALS__' in window;

export const discoverDevices = async (): Promise<CastDevice[]> => {
  const list = await invoke<Array<[string, string]>>('cast_discover');
  return list.map(([name, control]) => ({name, control}));
};
export const castPlay = (d: CastDevice, url: string, title: string) => invoke<void>('cast_play', {control: d.control, url, title});
export const castStop = (d: CastDevice) => invoke<void>('cast_stop', {control: d.control});
export const castPause = (d: CastDevice) => invoke<void>('cast_pause', {control: d.control});
export const castResume = (d: CastDevice) => invoke<void>('cast_resume', {control: d.control});
