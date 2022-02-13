import createState from 'zustand';
import {BookWithStories} from "@bobs-bedtime-stories/shared";
import {environment} from "../environments/environment";

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
  init: () => void;
}

export const usePlayer = createState<PlayerState>((set) => ({
  audio: null,
  init: () => {
    const audio = new Audio();

    set({
      audio,
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
      } as PlayerState;

      if (state.audio) {
        const story = changeTo?.book.stories.find(story => story.episode === changeTo.episode);

        if (story) {
          newBaseState.audio!.src = `${environment.cdnEndpoint}/${story.audioS3Key}`;
          newBaseState.audio!.load();
          newBaseState.audio!.currentTime = newBaseState.seekPosition;
        }

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
        console.log('seekTo', position, state.audio);
        state.audio.currentTime = position;
      }
      return {
        ...state,
        seekPosition: position,
      }
    });
  },
}));

