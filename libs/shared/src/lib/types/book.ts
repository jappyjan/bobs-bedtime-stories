import {Story} from "./story";

export interface Book {
  title: string;
  slug: string;
  description: string;
  coverImageUrl?: string;
}

export type BookWithStories = Book & {
  stories: Story[];
};
