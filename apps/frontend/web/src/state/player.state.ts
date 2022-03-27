import createState from 'zustand';
import {BookWithStories} from "@bobs-bedtime-stories/shared";
import {environment} from "../environments/environment";
import {persist} from "zustand/middleware";
import {upsertLocalStorageStoryPlayState} from "./utils";
import {useStories} from "./stories.state";

interface NowPlaying {
  book: BookWithStories;
  episode: number;
}

export interface PlayerState {
  nowPlaying: null | NowPlaying;
  seekPosition: number;
  state: 'playing' | 'paused' | 'idle';
  play: (changeTo?: NowPlaying) => void;
  pause: () => void;
  seekTo: (position: number) => void;
  showPlayer: boolean;
  setPlayerVisibility: (visibility: boolean) => void;
  audio: HTMLAudioElement | null;
  audioLength: number;
  init: () => void;
  isLoading: boolean;
  isInitiated: boolean;
}

export const usePlayer = createState<PlayerState>(
  persist(
    (set, get) => ({
      audio: null,
      audioLength: 60,
      isLoading: false,
      isInitiated: false,
      init: () => {
        if (get().isInitiated) {
          console.log('Player already initiated');
          return;
        }

        set({
          isInitiated: true,
        });

        const audio = new Audio();
        set({
          audio,
        });

        audio.addEventListener(('loadeddata'), () => {
          setTimeout(() => {
            audio.dispatchEvent(new CustomEvent('durationchange'));
          }, 50);
          set({
            isLoading: false
          });
        });

        audio.addEventListener(('loadstart'), () => {
          set({
            isLoading: true,
          });
        });

        audio.addEventListener('durationchange', () => {
          let audioLength = get().audioLength;
          if (audio.duration !== Infinity) {
            audioLength = audio.duration;
          }

          set({
            audioLength,
          });
        });

        audio.addEventListener('timeupdate', () => {
          set({
            seekPosition: audio.currentTime,
          });

          const nowPlaying = get().nowPlaying;
          if (!nowPlaying) {
            return;
          }

          if (audio.currentTime > (audio.duration - 10)) {
            upsertLocalStorageStoryPlayState({
              bookSlug: nowPlaying.book.slug,
              episode: nowPlaying.episode,
            }, {
              finishedListening: true,
            });
            useStories.setState((state) => {
              state.updateEpisode({
                bookSlug: nowPlaying.book.slug,
                episode: nowPlaying.episode,
                finishedListening: true,
              });
            });
          }
        });

        audio.addEventListener('ended', () => {
          set({
            state: 'paused',
          });
        });

        audio.addEventListener('pause', () => {
          set({
            state: 'paused',
          });
        });

        audio.addEventListener('play', () => {
          set({
            state: 'playing',
          });
        });

        set((state) => {
          const newState = {
            ...state,
          }

          if (newState.nowPlaying) {
            const story = newState.nowPlaying.book.stories.find((story) => story.episode === newState.nowPlaying?.episode);
            if (story) {
              audio.src = `${environment.cdnEndpoint}/${story.audioS3Key}`;
              audio.load();
              audio.currentTime = newState.seekPosition;
            } else {
              newState.nowPlaying = null;
              newState.state = 'idle';
            }
          }

          if (newState.state === 'playing') {
            newState.state = 'paused';
          }

          return newState;
        });
      },
      nowPlaying: null,
      seekPosition: 0,
      state: 'idle',
      showPlayer: false,
      setPlayerVisibility: (visibility: boolean) => set((state) => ({...state, showPlayer: visibility})),
      play: (changeTo?: NowPlaying) => {
        set((state) => {
          const newBaseState = {
            ...state,
            state: 'playing',
            showPlayer: true,
            seekPosition: 0,
          } as PlayerState;

          if (changeTo) {
            upsertLocalStorageStoryPlayState({
              bookSlug: changeTo.book.slug,
              episode: changeTo.episode,
            }, {
              startedListening: true,
            });
            useStories.setState((state) => {
              state.updateEpisode({
                bookSlug: changeTo.book.slug,
                episode: changeTo.episode,
                startedListening: true,
              });
            });
          }

          if (state.audio) {
            const story = changeTo?.book.stories.find(story => story.episode === changeTo.episode);

            if (story) {
              newBaseState.isLoading = true;
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              newBaseState.audio!.src = `${environment.cdnEndpoint}/${story.audioS3Key}`;
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              newBaseState.audio!.load();
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              newBaseState.audio!.currentTime = newBaseState.seekPosition;
            }

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            newBaseState.audio!.play();
          }

          if (!changeTo) {
            return newBaseState
          }

          if (newBaseState.nowPlaying && newBaseState.nowPlaying.book.slug === changeTo.book.slug && newBaseState.nowPlaying.episode === changeTo.episode) {
            return newBaseState;
          }

          return {
            ...newBaseState,
            seekPosition: 0,
            nowPlaying: changeTo
          };
        });
      },
      pause: () => {
        set((state) => {
          state.audio?.pause();
          return {state: 'paused'};
        });
      },
      seekTo: (position: number) => {
        set((state) => {
          if (state.audio) {
            state.audio.currentTime = position;
          }
          return {
            ...state,
            seekPosition: position,
          }
        });
      },
    }),
    {
      name: 'player',
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) => ![
            'isLoading',
            'audio',
            'isInitiated',
          ].includes(key))
        ),
      merge: (prev, next) => ({
        ...prev,
        ...next,
      }),
    }
  )
);

