import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  ScrollView,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {MaterialIcons} from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {SettingsStackParamList} from '../../App';
import {TVFocusable, TVFocusGuide} from '../../components/tv';
import {isTV} from '../../lib/tv';
import useAuthStore from '../../lib/zustand/authStore';
import {showAppDialog} from '../../lib/zustand/appDialogStore';
import useMusicStore from '../../lib/zustand/musicStore';
import {
  addMusicTrack,
  deleteMusicTrack,
  type PickedFile,
} from '../../lib/music/musicApi';
import {removeOfflineTrack} from '../../lib/music/musicOffline';
import type {MusicTrack} from '../../lib/music/types';
import {Badge, Group, InputRow, IOS, Row, Sheet} from './AdminPanel';

type Props = NativeStackScreenProps<SettingsStackParamList, 'MusicAdmin'>;

const titleFromFileName = (name: string): string =>
  name
    .replace(/\.[A-Za-z0-9]{2,5}$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Untitled';

const formatSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) {
    return '';
  }
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const toPicked = (asset: DocumentPicker.DocumentPickerAsset): PickedFile => ({
  uri: asset.uri,
  name: asset.name,
  mimeType: asset.mimeType,
  size: asset.size,
});

const MusicAdmin = ({navigation}: Props) => {
  const isAdmin = useAuthStore(s => s.isAdmin);
  const tracks = useMusicStore(s => s.tracks);
  const loading = useMusicStore(s => s.loading);

  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [cover, setCover] = useState<PickedFile | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      void useMusicStore.getState().loadTracks(true);
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      if (!isTV) {
        return;
      }
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (open && !busy) {
          setOpen(false);
        } else if (!open) {
          navigation.goBack();
        }
        return true;
      });
      return () => sub.remove();
    }, [navigation, open, busy]),
  );

  const reset = () => {
    setFiles([]);
    setCover(null);
    setTitle('');
    setArtist('');
    setAlbum('');
    setStatus('');
  };

  const pickAudio = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      multiple: true,
      // The upload streams from a real file:// path, so copy it to cache first.
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.length) {
      return;
    }
    const picked = result.assets.map(toPicked);
    setFiles(picked);
    setTitle(picked.length === 1 ? titleFromFileName(picked[0].name) : '');
  };

  const pickCover = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) {
      return;
    }
    setCover(toPicked(result.assets[0]));
  };

  const upload = async () => {
    if (!files.length || busy) {
      return;
    }
    setBusy(true);
    let done = 0;
    const failures: string[] = [];
    for (const file of files) {
      setStatus(`Uploading ${done + 1} of ${files.length}…`);
      try {
        await addMusicTrack({
          title:
            files.length === 1 && title.trim()
              ? title
              : titleFromFileName(file.name),
          artist,
          album,
          audio: file,
          cover,
        });
        done += 1;
      } catch (e) {
        failures.push(
          `${file.name}: ${e instanceof Error ? e.message : 'upload failed'}`,
        );
      }
    }
    await useMusicStore.getState().loadTracks(true);
    setBusy(false);
    setStatus('');
    if (failures.length) {
      showAppDialog({
        title: done ? 'Some uploads failed' : 'Upload failed',
        message: `${done} of ${files.length} uploaded.\n\n${failures.join('\n')}`,
        variant: 'warning',
        actions: [{label: 'OK'}],
      });
      // Keep only the files that failed, so the admin can retry them.
      setFiles(files.filter(f => failures.some(m => m.startsWith(`${f.name}:`))));
      return;
    }
    ToastAndroid.show(
      done === 1 ? 'Song added' : `${done} songs added`,
      ToastAndroid.SHORT,
    );
    reset();
    setOpen(false);
  };

  const confirmDelete = (track: MusicTrack) => {
    if (deletingId) {
      return;
    }
    showAppDialog({
      title: 'Delete song?',
      message: `“${track.title}” will be removed for every user, and its files deleted. This cannot be undone.`,
      variant: 'warning',
      actions: [
        {label: 'Cancel'},
        {
          label: 'Delete',
          variant: 'destructive',
          onPress: () => {
            setDeletingId(track.id);
            deleteMusicTrack(track)
              .then(async () => {
                await removeOfflineTrack(track.id);
                await useMusicStore.getState().loadTracks(true);
              })
              .catch(e =>
                showAppDialog({
                  title: 'Could not delete',
                  message: e instanceof Error ? e.message : String(e),
                  actions: [{label: 'OK'}],
                }),
              )
              .finally(() => setDeletingId(null));
          },
        },
      ],
    });
  };

  if (!isAdmin) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: IOS.bg,
          flex: 1,
          justifyContent: 'center',
        }}>
        <Text style={{color: IOS.secondary, fontSize: 17}}>
          Admins only.
        </Text>
      </View>
    );
  }

  const multiple = files.length > 1;

  return (
    <TVFocusGuide autoFocus trapFocusRight style={{flex: 1}}>
      <ScrollView
        focusable={false}
        style={{backgroundColor: IOS.bg}}
        contentContainerStyle={{paddingBottom: 80, paddingTop: 8}}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <TVFocusable
          onPress={() => navigation.goBack()}
          borderRadius={12}
          style={{
            alignItems: 'center',
            alignSelf: 'flex-start',
            flexDirection: 'row',
            marginLeft: 6,
            paddingHorizontal: 6,
            paddingVertical: 8,
          }}>
          <MaterialIcons name="chevron-left" size={30} color={IOS.tint} />
          <Text style={{color: IOS.tint, fontSize: 17, marginLeft: -2}}>
            Admin Panel
          </Text>
        </TVFocusable>
        <Text
          style={{
            color: IOS.label,
            fontSize: 34,
            fontWeight: '700',
            marginBottom: 18,
            marginLeft: 20,
            marginTop: 4,
          }}>
          Music
        </Text>

        <Group
          inset={58}
          footer="Pick one or many audio files (MP3, M4A, FLAC, WAV, OGG…). Title is taken from the file name; artist and album apply to every file in the batch.">
          <Row
            leading={<Badge icon="upload-file" color={IOS.green} />}
            title="Upload Music"
            tint={IOS.tint}
            onPress={() => {
              reset();
              setOpen(true);
            }}
          />
        </Group>

        {loading && tracks.length === 0 ? (
          <ActivityIndicator color={IOS.tint} style={{marginVertical: 30}} />
        ) : tracks.length === 0 ? (
          <Text
            style={{
              color: IOS.secondary,
              fontSize: 15,
              marginHorizontal: 32,
              textAlign: 'center',
            }}>
            No songs yet. Upload the first one above.
          </Text>
        ) : (
          <Group
            header={`Songs (${tracks.length})`}
            inset={72}
            footer="Tap a song to delete it for everyone.">
            {tracks.map(track => (
              <Row
                key={track.id}
                leading={
                  track.cover_url ? (
                    <Image
                      source={{uri: track.cover_url}}
                      style={{
                        borderRadius: 7,
                        height: 40,
                        marginRight: 12,
                        width: 40,
                      }}
                    />
                  ) : (
                    <Badge icon="music-note" color={IOS.purple} />
                  )
                }
                title={track.title}
                subtitle={
                  [track.artist, formatSize(track.size_bytes)]
                    .filter(Boolean)
                    .join(' · ') || undefined
                }
                trailing={
                  deletingId === track.id ? (
                    <ActivityIndicator color={IOS.red} />
                  ) : (
                    <MaterialIcons name="delete-outline" size={22} color={IOS.red} />
                  )
                }
                disabled={Boolean(deletingId)}
                onPress={() => confirmDelete(track)}
              />
            ))}
          </Group>
        )}
      </ScrollView>

      <Sheet
        visible={open}
        title="Upload Music"
        doneLabel="Upload"
        doneDisabled={!files.length}
        busy={busy}
        onCancel={() => {
          if (!busy) {
            setOpen(false);
          }
        }}
        onDone={upload}>
        <Group
          inset={58}
          footer={
            status ||
            (files.length
              ? `${files.length} file${files.length > 1 ? 's' : ''} selected`
              : undefined)
          }>
          <Row
            leading={<Badge icon="audio-file" color={IOS.blue} />}
            title="Choose audio file(s)"
            value={
              files.length === 1
                ? files[0].name
                : files.length > 1
                  ? `${files.length} files`
                  : undefined
            }
            chevron
            disabled={busy}
            onPress={pickAudio}
          />
          <Row
            leading={<Badge icon="image" color={IOS.orange} />}
            title="Cover image (optional)"
            value={cover?.name}
            chevron
            disabled={busy}
            onPress={pickCover}
          />
        </Group>
        <Group header={multiple ? 'Title (from file names)' : 'Title'}>
          <InputRow
            value={multiple ? '' : title}
            onChangeText={setTitle}
            placeholder={multiple ? 'Each file name is used' : 'Song title'}
          />
        </Group>
        <Group header="Artist">
          <InputRow value={artist} onChangeText={setArtist} placeholder="Artist" />
        </Group>
        <Group header="Album">
          <InputRow value={album} onChangeText={setAlbum} placeholder="Album" />
        </Group>
      </Sheet>
    </TVFocusGuide>
  );
};

export default MusicAdmin;
