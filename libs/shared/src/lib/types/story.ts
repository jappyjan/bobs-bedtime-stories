export interface Story {
  bookSlug: string;
  episode: number;
  date: string;
  audioUrl: string;
  audioLength: number;
  description: string;
  imageUrls: string[];
  videoUrls: string[];
  externalLinks: string[];
}
