import createState from 'zustand';
import {Book, BookWithStories, Story} from "@bobs-bedtime-stories/shared";
import {callApi} from "../utils/api";

export interface StoriesState {
  books: BookWithStories[];
  fetchBooks: () => Promise<void>;
}

async function fetchStoriesOfBook(book: Book): Promise<Story[]> {
  try {
    return await callApi(`/books/${book.slug}/stories`, 'GET');
  } catch (e) {
    console.error(e);
    return [];
  }
}

export const useStories = createState<StoriesState>((set) => ({
  books: [],
  fetchBooks: async () => {
    const books = await callApi('/books', 'GET');
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
  }
}));
