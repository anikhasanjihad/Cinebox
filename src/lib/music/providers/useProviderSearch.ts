import {useCallback, useEffect, useState} from 'react';
import type {MusicTrack} from '../types';
import type {MusicProvider} from './types';
import {parseMusicLink} from './links';

const DEBOUNCE_MS = 450;
const SUGGEST_MS = 220;
const MIN_CHARS = 2;

/**
 * Drives the search box of an external provider: typing is debounced into a
 * search, Enter searches at once, an older answer never replaces a newer one,
 * and suggestions are fetched while the text is still being edited.
 */
export const useProviderSearch = (
  provider: MusicProvider | null,
  query: string,
) => {
  const providerId = provider?.id;
  const [committed, setCommitted] = useState('');
  const [nonce, setNonce] = useState(0);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    setCommitted('');
    setTracks([]);
    setError(null);
    setLoading(false);
    setSuggestions([]);
  }, [providerId]);

  // Typing becomes a search after a short pause.
  useEffect(() => {
    if (!providerId) {
      return;
    }
    const q = query.trim();
    if (!q) {
      setCommitted('');
      setTracks([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (q.length < MIN_CHARS) {
      return;
    }
    const timer = setTimeout(() => setCommitted(q), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, providerId]);

  useEffect(() => {
    if (!provider || !committed) {
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    // A pasted link opens that one track instead of running a text search.
    const job: Promise<MusicTrack[]> =
      provider.resolveLink && parseMusicLink(committed)
        ? provider
            .resolveLink(committed, controller.signal)
            .then(track => (track ? [track] : []))
        : provider.search(committed, controller.signal);
    job
      .then(result => {
        if (!controller.signal.aborted) {
          setTracks(result);
          setLoading(false);
        }
      })
      .catch(e => {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Search failed');
          setLoading(false);
        }
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, committed, nonce]);

  useEffect(() => {
    const q = query.trim();
    if (!provider?.suggestions || q.length < MIN_CHARS || q === committed) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      provider
        .suggestions?.(q, controller.signal)
        .then(list => {
          if (!controller.signal.aborted) {
            setSuggestions(list);
          }
        })
        .catch(() => {});
    }, SUGGEST_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, committed, providerId]);

  /** Search now (Enter, or tapping a suggestion). */
  const submit = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) {
        return;
      }
      setSuggestions([]);
      if (q === committed) {
        setNonce(n => n + 1);
      } else {
        setCommitted(q);
      }
    },
    [committed],
  );

  const retry = useCallback(() => setNonce(n => n + 1), []);

  return {committed, tracks, loading, error, suggestions, submit, retry};
};
