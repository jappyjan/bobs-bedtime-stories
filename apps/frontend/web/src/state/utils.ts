import {Story} from "@bobs-bedtime-stories/shared";

type StoryIdentifier = Pick<Story, 'bookSlug' | 'episode'>

export function getLocalStorageKeyOfStoryPlayState(story: StoryIdentifier) {
  return `bob-story-${story.bookSlug}-episode-${story.episode}-playstate`
}

type StoryPlayState = Pick<Story, 'startedListening' | 'finishedListening'>;

export function getLocalStorageStoryPlayState(story: StoryIdentifier) {
  const playStateKey = getLocalStorageKeyOfStoryPlayState(story);
  return JSON.parse(localStorage.getItem(playStateKey) ?? '{}') as StoryPlayState;
}

export function upsertLocalStorageStoryPlayState(story: StoryIdentifier, playState: Partial<StoryPlayState>) {
  const currentState = getLocalStorageStoryPlayState(story);
  const newState = {...currentState, ...playState};

  const playStateKey = getLocalStorageKeyOfStoryPlayState(story);
  localStorage.setItem(playStateKey, JSON.stringify(newState));
}
