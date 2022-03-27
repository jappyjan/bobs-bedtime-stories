import createState from 'zustand';
import {Book, BookWithStories, Story} from "@bobs-bedtime-stories/shared";
import {callApi} from "../utils/api";
import {persist} from "zustand/middleware"
import {getLocalStorageStoryPlayState} from "./utils";

type AddBookParams = Omit<Book, 'slug' | 'coverImageUrl'>;

interface AddStoryParams extends Pick<Story, 'bookSlug'> {
  audioFile: Blob;
}

export interface StoriesState {
  books: BookWithStories[];
  fetchBooks: () => Promise<void>;
  addBook: (data: AddBookParams) => Promise<BookWithStories>;
  addStory: (data: AddStoryParams) => Promise<Story>;
  updateEpisode: (updateData: Pick<Story, 'bookSlug' | 'episode'> & Partial<Story>) => void;
}

async function fetchStoriesOfBook(book: Book): Promise<Story[]> {
  try {
    const stories = await callApi<Story[]>(`/books/${book.slug}/stories`, 'GET');
    return stories.map((story) => {
      const playStateOfStory = getLocalStorageStoryPlayState(story);
      Object.assign(story, playStateOfStory);

      return story;
    });
  } catch (e) {
    console.error(e);
    return [];
  }
}

export const useStories = createState<StoriesState>(
  persist(
    (set, _get) => ({
      books: [],
      fetchBooks: async () => {
        const books = await callApi<Book[]>('/books', 'GET');
        await Promise.all(books.map(async (book: Book) => {
          const stories = await fetchStoriesOfBook(book);
          set((state) => {
            const otherBooks = state.books.filter(b => b.slug !== book.slug);
            const newBooks = [
              ...otherBooks,
              {
                ...book,
                stories: stories.sort((a, b) => a.episode < b.episode ? -1 : 1),
              }
            ];
            return {
              ...state,
              books: newBooks.sort((a, b) => a.title < b.title ? -1 : 1)
            }
          });
        }));
      },
      addBook: async (data: AddBookParams) => {
        const book = await callApi<Book>('/books', 'POST', {
          title: data.title,
          description: data.description,
        });

        const bookWithStories = {
          ...book,
          stories: [],
        };

        set((state) => {
          return {
            ...state,
            books: [
              ...state.books,
              bookWithStories,
            ]
          };
        });

        return bookWithStories;
      },
      addStory: async (data: AddStoryParams) => {
        const {story, audioUploadUrlData} = await callApi<{
          story: Story, audioUploadUrlData: {
            url: string;
            fields: Record<string, string>;
          }
        }>(
          `/books/${data.bookSlug}/stories`,
          'POST'
        );

        const formData = new FormData();
        Object.entries(audioUploadUrlData.fields).forEach(([k, v]) => {
          formData.append(k, v);
        });
        formData.append('file', data.audioFile);
        formData.append('Content-Type', 'audio/wav');
        await fetch(audioUploadUrlData.url, {
          method: 'POST',
          body: formData,
        });

        set((state) => {
          return {
            ...state,
            books: state.books.map((book) => {
              if (book.slug === data.bookSlug) {
                book.stories.push(story);
              }
              return book;
            })
          }
        });
        return story;
      },
      updateEpisode: (updateData: Pick<Story, 'bookSlug' | 'episode'> & Partial<Story>) => {
        set((state) => {
          return {
            ...state,
            books: state.books.map((book) => {
              if (book.slug !== updateData.bookSlug) {
                return book;
              }

              return {
                ...book,
                stories: book.stories.map((story) => {
                  if (story.episode !== updateData.episode) {
                    return story;
                  }

                  return {
                    ...story,
                    ...updateData,
                  }
                }),
              }
            }),
          }
        });
      }
    }),
    {
      name: 'stories',
      merge: (prev, next) => ({
        ...prev,
        ...next,
      }),
    }
  ),
);
